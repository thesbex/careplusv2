package ma.careplus.hospitalization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.HashMap;
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
 * QA10-2 — Prestations de séjour hospitalier.
 *
 * Scenarios:
 *   P1  add prestation → 201, champs persistés, liste = 1 entrée.
 *   P2  list prestations → GET retourne la prestation.
 *   P3  delete prestation → 204, plus en base.
 *   P4  delete après facturation → 409 STAY_ALREADY_INVOICED.
 *   P5  RBAC : ASSISTANT (lecture seule) ne peut pas ajouter → 403.
 *   P6  invoicing with prestation : admit → prestation 120×2 → discharge → invoice
 *       → total = nuit hébergement (400) + prestation (240) = 640, ligne "Oxygène" présente.
 *   P7  StayDetailView expose prestations + prestationsTotal.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class StayPrestationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_prestit_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000005");
    private static final String PWD = "PrestIT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medecinEmail;
    String assistantEmail;
    UUID patientId;
    UUID bedA;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM hospitalization_stay_prestation");
        jdbc.update("DELETE FROM hospitalization_bed_assignment");
        jdbc.update("DELETE FROM hospitalization_stay");
        jdbc.update("DELETE FROM hospitalization_bed");
        jdbc.update("DELETE FROM hospitalization_room");
        jdbc.update("DELETE FROM hospitalization_ward");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID medId = UUID.randomUUID();
        medecinEmail = "prest-med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Med', 'Prest', TRUE, 0, 0, now(), now())
                """, medId, medecinEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        UUID assistantId = UUID.randomUUID();
        assistantEmail = "prest-asst-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Asst', 'Prest', TRUE, 0, 0, now(), now())
                """, assistantId, assistantEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                assistantId, ROLE_ASSISTANT);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Bennani', 'Karim', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        UUID wardId = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_ward (id, code, label_fr) VALUES (?, 'CHIR', 'Chirurgie')", wardId);
        UUID roomId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO hospitalization_room (id, ward_id, code, label_fr, room_class, daily_rate)
                VALUES (?, ?, '201', 'Chambre 201', 'INDIVIDUELLE', 400)
                """, roomId, wardId);
        bedA = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_bed (id, room_id, code, status) VALUES (?, ?, 'Lit 1', 'LIBRE')",
                bedA, roomId);
    }

    // ── Token helpers ──────────────────────────────────────────────────────────

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String medecinBearer() throws Exception { return bearer(medecinEmail); }
    private String assistantBearer() throws Exception { return bearer(assistantEmail); }

    // ── Stay lifecycle helpers ─────────────────────────────────────────────────

    private String admit(String token) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", patientId, "bedId", bedA, "admissionReason", "Post-op"))))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private void discharge(String token, String stayId) throws Exception {
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE"))))
                .andExpect(status().isOk());
    }

    private String addPrestation(String token, String stayId, String label, double price, double qty)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("label", label);
        body.put("unitPrice", price);
        body.put("quantity", qty);
        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/prestations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    // ── Tests ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("P1. add prestation → 201, label/price/lineTotal corrects, 1 ligne en base")
    void p1_addPrestation() throws Exception {
        String token = medecinBearer();
        String stayId = admit(token);

        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/prestations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "label", "Oxygène",
                                "unitPrice", 120,
                                "quantity", 2))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.label").value("Oxygène"))
                .andExpect(jsonPath("$.unitPrice").value(120))
                .andExpect(jsonPath("$.quantity").value(2))
                .andExpect(jsonPath("$.lineTotal").value(240))
                .andExpect(jsonPath("$.stayId").value(stayId));

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM hospitalization_stay_prestation WHERE stay_id = ?::uuid",
                Integer.class, stayId);
        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("P2. list prestations → GET retourne la prestation ajoutée")
    void p2_listPrestations() throws Exception {
        String token = medecinBearer();
        String stayId = admit(token);
        addPrestation(token, stayId, "Repas", 50, 1);

        mockMvc.perform(get("/api/hospitalization/stays/" + stayId + "/prestations")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].label").value("Repas"))
                .andExpect(jsonPath("$[0].lineTotal").value(50));
    }

    @Test
    @DisplayName("P3. delete prestation → 204, plus en base")
    void p3_deletePrestation() throws Exception {
        String token = medecinBearer();
        String stayId = admit(token);
        String prestId = addPrestation(token, stayId, "Pansement", 80, 1);

        mockMvc.perform(delete("/api/hospitalization/stays/" + stayId + "/prestations/" + prestId)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM hospitalization_stay_prestation WHERE id = ?::uuid",
                Integer.class, prestId);
        assertThat(count).isZero();
    }

    @Test
    @DisplayName("P4. delete après facturation → 409 STAY_ALREADY_INVOICED")
    void p4_deleteAfterInvoice() throws Exception {
        String token = medecinBearer();
        String stayId = admit(token);
        String prestId = addPrestation(token, stayId, "Oxygène", 120, 2);

        discharge(token, stayId);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // Séjour maintenant FACTURE → delete doit retourner 409
        mockMvc.perform(delete("/api/hospitalization/stays/" + stayId + "/prestations/" + prestId)
                        .header("Authorization", token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STAY_ALREADY_INVOICED"));
    }

    @Test
    @DisplayName("P5. RBAC : ASSISTANT ne peut pas ajouter de prestation → 403")
    void p5_rbacAssistantForbidden() throws Exception {
        String medToken = medecinBearer();
        String stayId = admit(medToken);

        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/prestations")
                        .header("Authorization", assistantBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "label", "Test", "unitPrice", 10))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("P6. admit → prestation Oxygène 120×2 → discharge → invoice : " +
            "total = hebergement(400) + prestation(240) = 640, ligne Oxygène présente")
    void p6_invoiceIncludesPrestations() throws Exception {
        String token = medecinBearer();
        String stayId = admit(token);

        // Ajouter prestation "Oxygène" 120 × 2 = 240
        addPrestation(token, stayId, "Oxygène", 120, 2);

        discharge(token, stayId);

        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").isNotEmpty())
                .andReturn();
        String invoiceId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("invoiceId").asText();

        // Séjour FACTURE
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM hospitalization_stay WHERE id = ?::uuid", String.class, stayId);
        assertThat(dbStatus).isEqualTo("FACTURE");

        // net_amount = 1 nuit × 400 (hebergement) + 120×2 (Oxygène) = 640
        BigDecimal net = jdbc.queryForObject(
                "SELECT net_amount FROM billing_invoice WHERE id = ?::uuid",
                BigDecimal.class, invoiceId);
        assertThat(net).isEqualByComparingTo("640");

        // 2 lignes de facture : 1 hébergement + 1 Oxygène
        Integer lineCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM billing_invoice_line WHERE invoice_id = ?::uuid",
                Integer.class, invoiceId);
        assertThat(lineCount).isEqualTo(2);

        // La ligne "Oxygène" existe avec le bon total
        Integer oxygenLines = jdbc.queryForObject(
                "SELECT COUNT(*) FROM billing_invoice_line WHERE invoice_id = ?::uuid AND description = 'Oxygène'",
                Integer.class, invoiceId);
        assertThat(oxygenLines).isEqualTo(1);

        BigDecimal oxygenTotal = jdbc.queryForObject(
                "SELECT line_total FROM billing_invoice_line WHERE invoice_id = ?::uuid AND description = 'Oxygène'",
                BigDecimal.class, invoiceId);
        assertThat(oxygenTotal).isEqualByComparingTo("240");
    }

    @Test
    @DisplayName("P7. StayDetailView expose prestations + prestationsTotal dans le détail du séjour")
    void p7_stayDetailViewIncludesPrestations() throws Exception {
        String token = medecinBearer();
        String stayId = admit(token);
        addPrestation(token, stayId, "Consultation spécialiste", 300, 1);

        mockMvc.perform(get("/api/hospitalization/stays/" + stayId)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prestations.length()").value(1))
                .andExpect(jsonPath("$.prestations[0].label").value("Consultation spécialiste"))
                .andExpect(jsonPath("$.prestations[0].lineTotal").value(300))
                .andExpect(jsonPath("$.prestationsTotal").value(300));
    }
}
