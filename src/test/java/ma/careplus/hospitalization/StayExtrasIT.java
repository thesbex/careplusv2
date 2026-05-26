package ma.careplus.hospitalization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
 * Extras hospitalisation : constantes au lit (C), séjours patient (dossier),
 * PDF compte-rendu (C), règle de comptage des journées (D2), cloisonnement (E).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class StayExtrasIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_stayx_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "StayX-IT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String med1Email; UUID med1Id;
    String med2Email; UUID med2Id;
    UUID patientId;
    UUID bedA;
    UUID roomId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM hospitalization_bed_assignment");
        jdbc.update("DELETE FROM hospitalization_stay");
        jdbc.update("DELETE FROM hospitalization_bed");
        jdbc.update("DELETE FROM hospitalization_room");
        jdbc.update("DELETE FROM hospitalization_ward");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM configuration_clinic_settings");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        med1Id = UUID.randomUUID();
        med1Email = seedMedecin(med1Id, "med1");
        med2Id = UUID.randomUUID();
        med2Email = seedMedecin(med2Id, "med2");

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Cherkaoui', 'Ahmed', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        UUID wardId = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_ward (id, code, label_fr) VALUES (?, 'MAT', 'Maternité')", wardId);
        roomId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO hospitalization_room (id, ward_id, code, label_fr, room_class, daily_rate)
                VALUES (?, ?, '102', 'Chambre 102', 'INDIVIDUELLE', 400)
                """, roomId, wardId);
        bedA = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_bed (id, room_id, code, status) VALUES (?, ?, 'Lit A', 'LIBRE')", bedA, roomId);
    }

    private String seedMedecin(UUID id, String prefix) {
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'M', 'D', TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, ROLE_MEDECIN);
        return email;
    }

    private void insertConfig(boolean strictIsolation, String dayRule) {
        jdbc.update("""
                INSERT INTO configuration_clinic_settings (id, name, address, city, phone,
                    agenda_strict_isolation, stay_billing_day_rule)
                VALUES (?, 'Clinique', 'Addr', 'Casa', '+212', ?, ?)
                """, UUID.randomUUID(), strictIsolation, dayRule);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String admit(String bearer, UUID attending) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("patientId", patientId);
        body.put("bedId", bedA);
        if (attending != null) body.put("attendingPractitionerId", attending);
        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    @Test
    @DisplayName("X1. constantes au lit : POST → 200 persisté avec stay_id, GET → 1 entrée")
    void x1_vitals() throws Exception {
        String b = bearer(med1Email);
        String stayId = admit(b, med1Id);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/vitals")
                        .header("Authorization", b)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("systolicMmhg", 120, "diastolicMmhg", 80))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.systolicMmhg").value(120));

        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_vital_signs WHERE stay_id = ?::uuid", Integer.class, stayId);
        assertThat(linked).isEqualTo(1);

        mockMvc.perform(get("/api/hospitalization/stays/" + stayId + "/vitals").header("Authorization", b))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    @DisplayName("X2. séjours du patient : GET /stays?patientId → 1")
    void x2_listForPatient() throws Exception {
        String b = bearer(med1Email);
        admit(b, med1Id);
        mockMvc.perform(get("/api/hospitalization/stays?patientId=" + patientId).header("Authorization", b))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].patientLastName").value("Cherkaoui"));
    }

    @Test
    @DisplayName("X3. PDF compte-rendu : GET summary-pdf → 200 application/pdf")
    void x3_pdf() throws Exception {
        String b = bearer(med1Email);
        String stayId = admit(b, med1Id);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                .header("Authorization", b).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE", "dischargeSummary", "RAS"))))
                .andExpect(status().isOk());
        MvcResult r = mockMvc.perform(get("/api/hospitalization/stays/" + stayId + "/summary-pdf").header("Authorization", b))
                .andExpect(status().isOk())
                .andExpect(c -> assertThat(c.getResponse().getContentType()).contains("application/pdf"))
                .andReturn();
        assertThat(r.getResponse().getContentAsByteArray().length).isGreaterThan(500);
    }

    // QA10-1 — le CR de séjour doit honorer logo_position=WATERMARK (filigrane).
    // Régression : le service ne cuisait pas l'alpha dans le PNG (openhtmltopdf
    // ignore l'opacité CSS sur les rasters) → filigrane non appliqué. Ce test
    // exerce le chemin WATERMARK (applyTransparency sur un vrai PNG) et vérifie
    // que le PDF se génère bien.
    @Test
    @DisplayName("X3b. PDF compte-rendu avec logo WATERMARK → 200 %PDF (filigrane cuit côté serveur)")
    void x3b_pdfWithWatermarkLogo() throws Exception {
        jdbc.update("""
                INSERT INTO configuration_clinic_settings (id, name, address, city, phone,
                    agenda_strict_isolation, stay_billing_day_rule, logo_blob, logo_mime, logo_position)
                VALUES (?, 'Clinique', 'Addr', 'Casa', '+212', FALSE, 'NUITS', ?, 'image/png', 'WATERMARK')
                """, UUID.randomUUID(), pngBytes());

        String b = bearer(med1Email);
        String stayId = admit(b, med1Id);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                .header("Authorization", b).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE", "dischargeSummary", "RAS"))))
                .andExpect(status().isOk());

        byte[] pdf = mockMvc.perform(get("/api/hospitalization/stays/" + stayId + "/summary-pdf")
                        .header("Authorization", b))
                .andExpect(status().isOk())
                .andExpect(c -> assertThat(c.getResponse().getContentType()).contains("application/pdf"))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(pdf.length).isGreaterThan(500);
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
    }

    /** Petit PNG 32×32 valide (décodable par ImageIO) pour exercer le filigrane. */
    private static byte[] pngBytes() throws Exception {
        java.awt.image.BufferedImage img =
                new java.awt.image.BufferedImage(32, 32, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = img.createGraphics();
        g.setColor(new java.awt.Color(0x0E, 0x7A, 0x6B));
        g.fillRect(0, 0, 32, 32);
        g.dispose();
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", bos);
        return bos.toByteArray();
    }

    @Test
    @DisplayName("X4. règle JOURS_ENTAMES : 1 jour de séjour facturé 2 journées (vs 1 en NUITS)")
    void x4_dayRule() throws Exception {
        insertConfig(false, "JOURS_ENTAMES");
        String b = bearer(med1Email);
        String stayId = admit(b, med1Id);
        // Antidater l'affectation d'une journée pleine. On recule de 25 h (et non 24 h)
        // pour rester strictement dans l'intervalle ]1 jour, 2 jours[ malgré l'écart
        // d'horloge sub-seconde entre le now() SQL (from_at) et l'Instant.now() applicatif
        // posé à la sortie (to_at) : floor des jours = 1 → JOURS_ENTAMES = 2, de façon
        // déterministe (un recul de 24 h exactement rendait le test flaky).
        jdbc.update("UPDATE hospitalization_bed_assignment SET from_at = now() - interval '25 hours' WHERE stay_id = ?::uuid", stayId);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                .header("Authorization", b).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE"))))
                .andExpect(status().isOk());
        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice").header("Authorization", b))
                .andExpect(status().isOk()).andReturn();
        String invoiceId = objectMapper.readTree(r.getResponse().getContentAsString()).get("invoiceId").asText();
        BigDecimal net = jdbc.queryForObject(
                "SELECT net_amount FROM billing_invoice WHERE id = ?::uuid", BigDecimal.class, invoiceId);
        // 2 journées entamées × 400 = 800 (en NUITS ce serait 1 × 400 = 400).
        assertThat(net).isEqualByComparingTo("800");
    }

    @Test
    @DisplayName("X5. cloisonnement strict : un médecin ne voit pas le séjour d'un autre")
    void x5_cloisonnement() throws Exception {
        insertConfig(true, "NUITS");
        // med1 admet le patient, attending = med1.
        admit(bearer(med1Email), med1Id);

        // med1 voit son séjour.
        mockMvc.perform(get("/api/hospitalization/stays/queue").header("Authorization", bearer(med1Email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        // med2 ne le voit pas (cloisonnement strict, ≥2 médecins).
        mockMvc.perform(get("/api/hospitalization/stays/queue").header("Authorization", bearer(med2Email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
