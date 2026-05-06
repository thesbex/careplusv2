package ma.careplus.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.OffsetDateTime;
import java.util.UUID;
import javax.imageio.ImageIO;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * F16 — vérifie que la signature configurée est bien injectée dans
 * les PDF d'ordonnance (et symétriquement, qu'aucune erreur n'est levée
 * quand la signature n'est pas configurée).
 *
 * Approche : on compare la taille du PDF sans signature vs avec signature
 * pour la même ordonnance. Avec un PNG de 32×16 transparent embed en base64,
 * le PDF doit être notablement plus gros (l'image est rasterisée par
 * openhtmltopdf dans un stream PDF).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PrescriptionPdfWithSignatureIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Sig-Pdf-Pwd-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String medAdminEmail;
    private UUID medId;
    private UUID patientId;
    private UUID consultationId;
    private UUID medicationId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        // Reset signature
        jdbc.update("UPDATE configuration_clinic_settings "
                + "SET signature_blob = NULL, signature_mime = NULL, signature_uploaded_at = NULL");

        // Wipe domain rows (order matters)
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Médecin + admin (même utilisateur)
        medAdminEmail = "med-admin-" + UUID.randomUUID() + "@test.ma";
        medId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Test', TRUE, 0, 0, ?, ?)
                """, medId, medAdminEmail, passwordEncoder.encode(PWD),
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", medId, ROLE_MEDECIN);
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", medId, ROLE_ADMIN);

        // Patient
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'Benjelloun', 'Samir', 'M', '1985-06-15', 'S-SIG-001',
                        0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Consultation
        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId);

        // Médicament
        medicationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags,
                    favorite, active, created_at, updated_at)
                VALUES (?, 'Doliprane 1g', 'Paracétamol', 'comprimé', '1g', 'antalgique',
                        TRUE, TRUE, now(), now())
                """, medicationId);
    }

    private String bearer() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + medAdminEmail + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /** Génère un PNG transparent valide. */
    private static byte[] tinyPng(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "PNG", baos);
        return baos.toByteArray();
    }

    private byte[] generatePdfForFreshPrescription(String token) throws Exception {
        String body = String.format("""
                {
                  "type": "DRUG",
                  "allergyOverride": false,
                  "lines": [
                    {
                      "medicationId": "%s",
                      "dosage": "1 cp",
                      "frequency": "3x/jour",
                      "duration": "5 jours"
                    }
                  ]
                }
                """, medicationId);
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated()).andReturn();
        String rxId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText();
        return mockMvc.perform(get("/api/prescriptions/" + rxId + "/pdf")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
    }

    @Test
    void pdfSizeGrowsAfterSignatureUpload() throws Exception {
        String token = bearer();

        // 1. PDF sans signature : généré sans erreur, magic bytes %PDF
        byte[] pdfNoSig = generatePdfForFreshPrescription(token);
        assertThat(pdfNoSig).hasSizeGreaterThan(0);
        assertThat(new String(pdfNoSig, 0, 4)).isEqualTo("%PDF");

        // 2. Upload une signature (PNG 100×40 = environ 200-400 octets bruts,
        //    mais l'embed PDF garde le stream image qui pèse plus que le HTML
        //    sans <img>).
        byte[] png = tinyPng(100, 40);
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // 3. PDF avec signature : toujours valide, taille > sans signature
        byte[] pdfWithSig = generatePdfForFreshPrescription(token);
        assertThat(pdfWithSig).hasSizeGreaterThan(0);
        assertThat(new String(pdfWithSig, 0, 4)).isEqualTo("%PDF");
        assertThat(pdfWithSig.length)
                .as("Le PDF avec signature doit être plus gros (image embed)")
                .isGreaterThan(pdfNoSig.length);

        // 4. Suppression : retour à un PDF sans image
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/settings/signature")
                        .header("Authorization", token))
                .andExpect(status().isNoContent());
        byte[] pdfAfterDelete = generatePdfForFreshPrescription(token);
        assertThat(pdfAfterDelete).hasSizeGreaterThan(0);
        assertThat(new String(pdfAfterDelete, 0, 4)).isEqualTo("%PDF");
        // Tolérance ~5% pour bruit zlib ; on vérifie surtout que la taille
        // redescend significativement vs avec signature.
        assertThat(pdfAfterDelete.length)
                .as("PDF après delete doit être plus petit que le PDF avec signature")
                .isLessThan(pdfWithSig.length);
    }
}
