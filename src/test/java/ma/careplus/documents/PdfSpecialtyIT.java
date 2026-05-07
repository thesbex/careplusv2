package ma.careplus.documents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V032 — verifies that {@code identity_user.specialty} is rendered in the
 * generated ordonnance PDF when set, and absent otherwise.
 *
 * <p>Uses Apache PDFBox (already on the classpath via openhtmltopdf) to extract
 * the text layer from the PDF, then asserts the specialty string is present.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PdfSpecialtyIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Pdf-Specialty-Pwd-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    @BeforeEach
    void wipe() {
        rateLimitFilter.clearBucketsForTests();
        // Wipe domain rows in correct order
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_assignment");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");
    }

    private record Setup(String email, UUID medId, UUID patientId, UUID consultationId, UUID medicationId) {}

    private Setup seed(String specialty) {
        String email = "spec-doc-" + UUID.randomUUID() + "@test.ma";
        UUID medId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    specialty, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Hicham', 'Tazi', ?, TRUE, 0, 0, ?, ?)
                """, medId, email, passwordEncoder.encode(PWD), specialty,
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", medId, ROLE_MEDECIN);

        UUID patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'PdfPatient', 'Test', 'M', '1990-01-01', 'PDF-001',
                        0, 0, 'ACTIF', now(), now())
                """, patientId);

        UUID consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId);

        UUID medicationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags,
                    favorite, active, created_at, updated_at)
                VALUES (?, 'Doliprane 1g', 'Paracétamol', 'comprimé', '1g', 'antalgique',
                        TRUE, TRUE, now(), now())
                """, medicationId);
        return new Setup(email, medId, patientId, consultationId, medicationId);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private byte[] generatePdf(Setup s, String token) throws Exception {
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
                """, s.medicationId());
        MvcResult r = mockMvc.perform(post("/api/consultations/" + s.consultationId() + "/prescriptions")
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

    private String extractText(byte[] pdf) throws Exception {
        try (PDDocument doc = PDDocument.load(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    /** "Pédiatre" via unicode escape — independent of source-file encoding. */
    private static final String SPECIALTY_PEDIATRE = "Pédiatre";
    private static final String SPECIALTY_CARDIO = "Cardiologue";

    @Test
    void specialtyIsRenderedWhenSet() throws Exception {
        Setup s = seed(SPECIALTY_PEDIATRE);
        String token = bearer(s.email());

        byte[] pdf = generatePdf(s, token);
        assertThat(pdf).hasSizeGreaterThan(0);
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");

        String text = extractText(pdf);
        assertThat(text)
                .as("L'ordonnance doit afficher la spécialité du médecin sous son nom.")
                .contains(SPECIALTY_PEDIATRE);
    }

    @Test
    void specialtyAbsent_pdfHasNoSpecialtyMarker() throws Exception {
        Setup s = seed(null); // No specialty set
        String token = bearer(s.email());

        byte[] pdf = generatePdf(s, token);
        assertThat(pdf).hasSizeGreaterThan(0);
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");

        String text = extractText(pdf);
        // Sanity: the practitioner's name still renders.
        assertThat(text).contains("Hicham");
        // No specialty injected → none of the typical labels present.
        assertThat(text)
                .as("Sans spécialité configurée, aucun bloc spécialité ne doit apparaître.")
                .doesNotContain(SPECIALTY_PEDIATRE)
                .doesNotContain(SPECIALTY_CARDIO);
    }
}
