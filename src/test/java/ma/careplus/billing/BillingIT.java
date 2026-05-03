package ma.careplus.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.OffsetDateTime;
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
 * Integration tests for J7 billing module.
 * Tests the full lifecycle: consultation sign → draft invoice → issue → payment → credit note.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class BillingIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Billing-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    String medEmail;
    UUID secId;
    String secEmail;
    UUID normalPatientId;
    UUID premiumPatientId;
    UUID consultationId;
    UUID premiumConsultationId;
    UUID actId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up in dependency order (credit_note_id FK must be nulled before deleting credit notes)
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM catalog_tariff");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM scheduling_appointment_reason WHERE code = 'CONSULT-BIL-REASON'");
        jdbc.update("DELETE FROM catalog_act WHERE code = 'CONSULT-BIL'");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Reset sequence for consistent test numbering
        int year = java.time.Year.now().getValue();
        jdbc.update("UPDATE billing_invoice_sequence SET next_value = 1 WHERE year = ?", year);

        // Create médecin user
        medId = UUID.randomUUID();
        medEmail = "med-billing-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Billing', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        // Create secrétaire user
        secId = UUID.randomUUID();
        secEmail = "sec-billing-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Billing', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);

        // Create a catalog act
        actId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_act (id, code, name, default_price, vat_rate, active, type,
                    created_at, updated_at)
                VALUES (?, 'CONSULT-BIL', 'Consultation Billing Test', 350.00, 0, TRUE, 'CONSULTATION',
                    now(), now())
                """, actId);

        // Add tariff for NORMAL tier
        jdbc.update("""
                INSERT INTO catalog_tariff (id, act_id, tier, amount, effective_from, created_at, updated_at)
                VALUES (gen_random_uuid(), ?, 'NORMAL', 350.00, '2020-01-01', now(), now())
                """, actId);

        // Add tariff for PREMIUM tier (same price, discount comes from config_patient_tier)
        jdbc.update("""
                INSERT INTO catalog_tariff (id, act_id, tier, amount, effective_from, created_at, updated_at)
                VALUES (gen_random_uuid(), ?, 'PREMIUM', 350.00, '2020-01-01', now(), now())
                """, actId);

        // Create appointment reason linked to the act
        UUID reasonId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment_reason (id, code, label, duration_minutes, default_act_id,
                    active, created_at, updated_at)
                VALUES (?, 'CONSULT-BIL-REASON', 'Consultation Billing', 30, ?, TRUE, now(), now())
                """, reasonId, actId);

        // Create NORMAL patient
        normalPatientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Normal', 'Patient', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, normalPatientId);

        // Create PREMIUM patient
        premiumPatientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Premium', 'Patient', 'F', 'PREMIUM', 0, 0, 'ACTIF', now(), now())
                """, premiumPatientId);

        // Create appointment for normal patient
        UUID appointmentId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment (id, patient_id, practitioner_id, reason_id,
                    start_at, end_at, status, type, walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, now(), now() + interval '30 minutes', 'EN_CONSULTATION',
                    'CONSULTATION', FALSE, FALSE, 0, now(), now())
                """, appointmentId, normalPatientId, medId, reasonId);

        // Create consultation in BROUILLON for normal patient
        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, appointment_id,
                    status, version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, normalPatientId, medId, appointmentId);

        // Create appointment for premium patient
        UUID premiumAppointmentId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment (id, patient_id, practitioner_id, reason_id,
                    start_at, end_at, status, type, walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, now(), now() + interval '30 minutes', 'EN_CONSULTATION',
                    'CONSULTATION', FALSE, FALSE, 0, now(), now())
                """, premiumAppointmentId, premiumPatientId, medId, reasonId);

        // Create consultation in BROUILLON for premium patient
        premiumConsultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, appointment_id,
                    status, version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, premiumConsultationId, premiumPatientId, medId, premiumAppointmentId);
    }

    // ── Token helper ──────────────────────────────────────────────────────────

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Test 1: sign consultation → draft invoice created ─────────────────────

    @Test
    void signConsultation_createsDraftInvoice() throws Exception {
        String token = bearer(medEmail);

        // Sign the consultation
        mockMvc.perform(post("/api/consultations/" + consultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // AFTER_COMMIT listener runs async — wait briefly
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                mockMvc.perform(get("/api/consultations/" + consultationId + "/invoice")
                                .header("Authorization", token))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value("BROUILLON"))
                        .andExpect(jsonPath("$.number").doesNotExist())
        );
    }

    // ── Test 2: PREMIUM patient gets discount applied ─────────────────────────

    @Test
    void signConsultation_premiumPatientGetsDiscount() throws Exception {
        String token = bearer(medEmail);

        // Sign the premium patient's consultation
        mockMvc.perform(post("/api/consultations/" + premiumConsultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // Wait for invoice creation
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            MvcResult r = mockMvc.perform(get("/api/consultations/" + premiumConsultationId + "/invoice")
                            .header("Authorization", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("BROUILLON"))
                    .andReturn();
            JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
            // PREMIUM gets 10% discount: 350 * 10% = 35, net = 315
            double totalAmount = body.get("totalAmount").asDouble();
            double discountAmount = body.get("discountAmount").asDouble();
            double netAmount = body.get("netAmount").asDouble();
            assertThat(totalAmount).isEqualTo(350.0);
            assertThat(discountAmount).isGreaterThan(0.0);
            assertThat(netAmount).isLessThan(totalAmount);
        });
    }

    // ── Test 3: médecin adjusts total ─────────────────────────────────────────

    @Test
    void adjustTotal_persistsDiscountAmount() throws Exception {
        String token = bearer(medEmail);

        // Sign to create draft invoice
        mockMvc.perform(post("/api/consultations/" + consultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                mockMvc.perform(get("/api/consultations/" + consultationId + "/invoice")
                                .header("Authorization", token))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value("BROUILLON"))
        );

        // Adjust total
        mockMvc.perform(put("/api/consultations/" + consultationId + "/invoice-total")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"discountAmount\": 50.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.discountAmount").value(50.0));
    }

    // ── Test 4: issue invoice → sequential number assigned ───────────────────

    @Test
    void issueInvoice_assignsSequentialNumber() throws Exception {
        String token = bearer(medEmail);

        // Create and sign consultation
        mockMvc.perform(post("/api/consultations/" + consultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        String invoiceId = await().atMost(Duration.ofSeconds(5)).until(() -> {
            try {
                MvcResult r = mockMvc.perform(get("/api/consultations/" + consultationId + "/invoice")
                                .header("Authorization", token))
                        .andReturn();
                if (r.getResponse().getStatus() == 200) {
                    JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
                    return body.get("id").asText();
                }
            } catch (Exception ignored) {}
            return null;
        }, id -> id != null);

        // Issue the invoice
        int year = java.time.Year.now().getValue();
        MvcResult r = mockMvc.perform(post("/api/invoices/" + invoiceId + "/issue")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(year + "-000001"))
                .andExpect(jsonPath("$.issuedAt").exists())
                .andReturn();

        // Verify it's now EMISE
        mockMvc.perform(get("/api/invoices/" + invoiceId).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EMISE"));
    }

    // ── Test 5: second invoice gets incremented number ────────────────────────

    @Test
    void issueSecondInvoice_numberIncremented() throws Exception {
        String token = bearer(medEmail);

        // Sign normal consultation + issue invoice 1
        mockMvc.perform(post("/api/consultations/" + consultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        String inv1Id = await().atMost(Duration.ofSeconds(5)).until(() -> {
            try {
                MvcResult r = mockMvc.perform(get("/api/consultations/" + consultationId + "/invoice")
                                .header("Authorization", token)).andReturn();
                if (r.getResponse().getStatus() == 200) {
                    return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
                }
            } catch (Exception ignored) {}
            return null;
        }, id -> id != null);

        mockMvc.perform(post("/api/invoices/" + inv1Id + "/issue").header("Authorization", token))
                .andExpect(status().isOk());

        // Sign premium consultation + issue invoice 2
        mockMvc.perform(post("/api/consultations/" + premiumConsultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        String inv2Id = await().atMost(Duration.ofSeconds(5)).until(() -> {
            try {
                MvcResult r = mockMvc.perform(get("/api/consultations/" + premiumConsultationId + "/invoice")
                                .header("Authorization", token)).andReturn();
                if (r.getResponse().getStatus() == 200) {
                    return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
                }
            } catch (Exception ignored) {}
            return null;
        }, id -> id != null);

        int year = java.time.Year.now().getValue();
        mockMvc.perform(post("/api/invoices/" + inv2Id + "/issue").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(year + "-000002"));
    }

    // ── Test 6: record full payment → PAYEE_TOTALE ───────────────────────────

    @Test
    void recordFullPayment_statusPayeeTotale() throws Exception {
        String token = bearer(medEmail);

        // Create issued invoice
        String invoiceId = createIssuedInvoice(token, consultationId);

        // Get the net amount
        MvcResult inv = mockMvc.perform(get("/api/invoices/" + invoiceId)
                        .header("Authorization", token))
                .andReturn();
        double netAmount = objectMapper.readTree(inv.getResponse().getContentAsString())
                .get("netAmount").asDouble();

        // Record full payment
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/payments")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": " + netAmount + ", \"mode\": \"ESPECES\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(netAmount));

        // Check status
        mockMvc.perform(get("/api/invoices/" + invoiceId).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYEE_TOTALE"));
    }

    // ── Test 7: partial payment → PAYEE_PARTIELLE ────────────────────────────

    @Test
    void recordPartialPayment_statusPayeePartielle() throws Exception {
        String token = bearer(medEmail);

        // Use premium consultation for this test (requires separate sign)
        String invoiceId = createIssuedInvoice(token, consultationId);

        // Record partial payment (much less than total)
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/payments")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 50.00, \"mode\": \"CHEQUE\", \"reference\": \"CHQ-001\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/invoices/" + invoiceId).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYEE_PARTIELLE"));
    }

    // ── Test 8: credit note → original ANNULEE, credit note has negative amount ─

    @Test
    void issueCreditNote_originalAnnulee_creditNoteNegative() throws Exception {
        String token = bearer(medEmail);

        String invoiceId = createIssuedInvoice(token, consultationId);

        MvcResult cnResult = mockMvc.perform(post("/api/invoices/" + invoiceId + "/credit-note")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Erreur de facturation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creditNoteId").exists())
                .andExpect(jsonPath("$.originalInvoiceId").value(invoiceId))
                .andExpect(jsonPath("$.reason").value("Erreur de facturation"))
                .andReturn();

        // Original invoice must be ANNULEE
        mockMvc.perform(get("/api/invoices/" + invoiceId).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULEE"));

        // Amount must be negative
        JsonNode cn = objectMapper.readTree(cnResult.getResponse().getContentAsString());
        assertThat(cn.get("amount").asDouble()).isLessThan(0);
    }

    // ── Test 9: issue already-EMISE invoice → 409 ────────────────────────────

    @Test
    void issueAlreadyEmiseInvoice_returns409() throws Exception {
        String token = bearer(medEmail);

        String invoiceId = createIssuedInvoice(token, consultationId);

        // Try to issue again → 409
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/issue")
                        .header("Authorization", token))
                .andExpect(status().isConflict());
    }

    // ── Test 10: prestations performed during consultation appear in draft ────
    //
    // Régression V016 : le médecin ajoute des prestations (ECG, piqûre…) dans
    // l'écran consultation. Sans le câblage côté billing, le brouillon de
    // facture ne contenait QUE la ligne consultation par défaut. Ce test
    // verrouille la correction : les prestations doivent apparaître comme
    // lignes de facture supplémentaires avec leur snapshot de prix.
    @Test
    void signConsultation_appendsPrestationLinesToDraftInvoice() throws Exception {
        String token = bearer(medEmail);

        // Récupérer 2 prestations du seed V016 (ECG = 200 MAD, PIQURE = 50 MAD)
        UUID ecgId = jdbc.queryForObject(
                "SELECT id FROM catalog_prestation WHERE code = 'ECG'", UUID.class);
        UUID piqureId = jdbc.queryForObject(
                "SELECT id FROM catalog_prestation WHERE code = 'PIQURE'", UUID.class);

        // Ajouter 2 prestations à la consultation BEFORE signing
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + ecgId + "\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + piqureId
                                + "\",\"unitPrice\":60,\"quantity\":2}"))
                .andExpect(status().isCreated());

        // Signer la consultation
        mockMvc.perform(post("/api/consultations/" + consultationId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // Le brouillon doit avoir : 350 (consult NORMAL) + 200 (ECG) + 60×2 (piqûre)
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            MvcResult r = mockMvc.perform(get("/api/consultations/" + consultationId + "/invoice")
                            .header("Authorization", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("BROUILLON"))
                    .andReturn();
            JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
            // Total = 350 (consult) + 200 (ECG) + 120 (piqûre 60×2) = 670
            assertThat(body.get("totalAmount").asDouble()).isEqualTo(670.0);
            // Lignes : 1 consult + 1 ECG + 1 piqûre = 3
            assertThat(body.get("lines")).hasSize(3);
            // Lignes prestations identifiables par leur description
            boolean hasEcg = false, hasPiqure = false;
            for (JsonNode line : body.get("lines")) {
                String desc = line.get("description").asText();
                if (desc.toLowerCase().contains("électrocardiogramme") || desc.contains("ECG")) {
                    hasEcg = true;
                    assertThat(line.get("totalPrice").asDouble()).isEqualTo(200.0);
                }
                if (desc.toLowerCase().contains("piqûre") || desc.toLowerCase().contains("injection")) {
                    hasPiqure = true;
                    assertThat(line.get("quantity").asDouble()).isEqualTo(2.0);
                    assertThat(line.get("unitPrice").asDouble()).isEqualTo(60.0);
                    assertThat(line.get("totalPrice").asDouble()).isEqualTo(120.0);
                }
            }
            assertThat(hasEcg).as("Ligne ECG présente").isTrue();
            assertThat(hasPiqure).as("Ligne piqûre (override prix)").isTrue();
        });
    }

    // ── Helper: create an issued invoice ─────────────────────────────────────

    private String createIssuedInvoice(String token, UUID consultId) throws Exception {
        // Sign consultation
        mockMvc.perform(post("/api/consultations/" + consultId + "/sign")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // Wait for draft invoice
        String invoiceId = await().atMost(Duration.ofSeconds(5)).until(() -> {
            try {
                MvcResult r = mockMvc.perform(get("/api/consultations/" + consultId + "/invoice")
                                .header("Authorization", token)).andReturn();
                if (r.getResponse().getStatus() == 200) {
                    return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
                }
            } catch (Exception ignored) {}
            return null;
        }, id -> id != null);

        // Issue the invoice
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/issue")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        return invoiceId;
    }
}
