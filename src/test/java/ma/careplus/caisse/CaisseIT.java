package ma.careplus.caisse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
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
 * Caisse quotidienne (variante A — agrégation à la volée).
 *
 * SCÉNARIOS COUVERTS :
 *  1. Caisse vide aujourd'hui → total=0, count=0, byMode liste les 5 modes à 0.
 *  2. Encaissement ESPÈCES + CHEQUE le jour J → byMode reflète les 2 lignes,
 *     total et count agrégés correctement.
 *  3. Caisse d'hier (date=...) → bornée correctement (0 si rien n'a été
 *     encaissé hier).
 *  4. RBAC : SECRETAIRE peut consulter, mais un utilisateur sans rôle est 403
 *     (testé indirectement via le statut 401 sans token).
 *  5. Factures émises du jour → invoicesIssuedTotal/Count > 0 quand au moins
 *     une facture est émise dans la fenêtre.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class CaisseIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Caisse-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    String medEmail;
    UUID secId;
    String secEmail;
    UUID patientId;
    UUID consultationId;
    UUID actId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Cleanup en respectant les FKs
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM catalog_tariff");
        jdbc.update("DELETE FROM clinical_consultation_prestation");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM scheduling_appointment_reason WHERE code = 'CONSULT-CAI-REASON'");
        jdbc.update("DELETE FROM catalog_act WHERE code = 'CONSULT-CAI'");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        int year = java.time.Year.now().getValue();
        jdbc.update("UPDATE billing_invoice_sequence SET next_value = 1 WHERE year = ?", year);

        // Médecin
        medId = UUID.randomUUID();
        medEmail = "med-caisse-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Caisse', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        // Secrétaire (RBAC)
        secId = UUID.randomUUID();
        secEmail = "sec-caisse-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Caisse', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);

        // Acte + tarif
        actId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_act (id, code, name, default_price, vat_rate, active, type,
                    created_at, updated_at)
                VALUES (?, 'CONSULT-CAI', 'Consultation Caisse Test', 200.00, 0, TRUE, 'CONSULTATION',
                    now(), now())
                """, actId);
        jdbc.update("""
                INSERT INTO catalog_tariff (id, act_id, tier, amount, effective_from, created_at, updated_at)
                VALUES (gen_random_uuid(), ?, 'NORMAL', 200.00, '2020-01-01', now(), now())
                """, actId);

        // Motif RDV
        UUID reasonId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment_reason (id, code, label, duration_minutes, default_act_id,
                    active, created_at, updated_at)
                VALUES (?, 'CONSULT-CAI-REASON', 'Consultation Caisse', 30, ?, TRUE, now(), now())
                """, reasonId, actId);

        // Patient + RDV + consultation BROUILLON pour tests de paiement
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Caisse', 'Patient', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        UUID appointmentId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment (id, patient_id, practitioner_id, reason_id,
                    start_at, end_at, status, type, walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, now(), now() + interval '30 minutes', 'EN_CONSULTATION',
                    'CONSULTATION', FALSE, FALSE, 0, now(), now())
                """, appointmentId, patientId, medId, reasonId);

        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, appointment_id,
                    status, version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId, appointmentId);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Test 1 : caisse vide aujourd'hui ──────────────────────────────────────

    @Test
    void emptyCaisse_today_returnsZeroes() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/caisse").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0.0))
                .andExpect(jsonPath("$.count").value(0))
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        // 5 modes (ESPECES, CHEQUE, CB, VIREMENT, TIERS_PAYANT) tous à 0
        assertThat(body.get("byMode")).hasSize(5);
        for (JsonNode mode : body.get("byMode")) {
            assertThat(mode.get("amount").asDouble()).isEqualTo(0.0);
            assertThat(mode.get("count").asLong()).isEqualTo(0L);
        }
        assertThat(body.get("date").asText())
                .isEqualTo(LocalDate.now(ZoneId.of("Africa/Casablanca")).toString());
    }

    // ── Test 2 : 2 paiements (espèces + chèque) → byMode et total agrégés ─────

    @Test
    void mixedPayments_today_aggregatedByMode() throws Exception {
        String token = bearer(medEmail);

        // Crée + signe consultation, attend brouillon, émet
        String invoiceId = createIssuedInvoice(token);

        // Encaisse 100 ESPECES + 50 CHEQUE
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/payments")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":100.00,\"mode\":\"ESPECES\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/payments")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":50.00,\"mode\":\"CHEQUE\",\"reference\":\"CHQ-1\"}"))
                .andExpect(status().isOk());

        MvcResult r = mockMvc.perform(get("/api/caisse").header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.get("total").asDouble()).isEqualTo(150.0);
        assertThat(body.get("count").asLong()).isEqualTo(2L);

        double cash = 0, cheque = 0;
        long cashCount = 0, chequeCount = 0;
        for (JsonNode mode : body.get("byMode")) {
            String m = mode.get("mode").asText();
            if ("ESPECES".equals(m)) {
                cash = mode.get("amount").asDouble();
                cashCount = mode.get("count").asLong();
            }
            if ("CHEQUE".equals(m)) {
                cheque = mode.get("amount").asDouble();
                chequeCount = mode.get("count").asLong();
            }
        }
        assertThat(cash).isEqualTo(100.0);
        assertThat(cashCount).isEqualTo(1L);
        assertThat(cheque).isEqualTo(50.0);
        assertThat(chequeCount).isEqualTo(1L);

        // Facture émise du jour
        assertThat(body.get("invoicesIssuedCount").asLong()).isGreaterThanOrEqualTo(1L);
        assertThat(body.get("invoicesIssuedTotal").asDouble()).isGreaterThan(0.0);
    }

    // ── Test 3 : caisse d'hier (date param) → vide ─────────────────────────────

    @Test
    void yesterdayCaisse_isEmpty() throws Exception {
        String token = bearer(medEmail);

        // Encaisse aujourd'hui
        String invoiceId = createIssuedInvoice(token);
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/payments")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":50.00,\"mode\":\"ESPECES\"}"))
                .andExpect(status().isOk());

        // Caisse d'hier doit être vide (le paiement est bien aujourd'hui)
        LocalDate yesterday = LocalDate.now(ZoneId.of("Africa/Casablanca")).minusDays(1);
        mockMvc.perform(get("/api/caisse").param("date", yesterday.toString())
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0.0))
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.date").value(yesterday.toString()));
    }

    // ── Test 4 : RBAC — SECRETAIRE autorisée ──────────────────────────────────

    @Test
    void secretaireCanReadCaisse() throws Exception {
        String token = bearer(secEmail);
        mockMvc.perform(get("/api/caisse").header("Authorization", token))
                .andExpect(status().isOk());
    }

    // ── Test 5 : sans token → 401 ─────────────────────────────────────────────

    @Test
    void anonymousAccess_returns401() throws Exception {
        mockMvc.perform(get("/api/caisse"))
                .andExpect(status().isUnauthorized());
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private String createIssuedInvoice(String token) throws Exception {
        mockMvc.perform(post("/api/consultations/" + consultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        String invoiceId = await().atMost(Duration.ofSeconds(5)).until(() -> {
            try {
                MvcResult r = mockMvc.perform(get("/api/consultations/" + consultationId + "/invoice")
                                .header("Authorization", token)).andReturn();
                if (r.getResponse().getStatus() == 200) {
                    return objectMapper.readTree(r.getResponse().getContentAsString())
                            .get("id").asText();
                }
            } catch (Exception ignored) {}
            return null;
        }, id -> id != null);

        mockMvc.perform(post("/api/invoices/" + invoiceId + "/issue")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        return invoiceId;
    }
}
