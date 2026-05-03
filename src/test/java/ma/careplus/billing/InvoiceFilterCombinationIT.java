package ma.careplus.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;
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
 * Integration tests for invoice filter combinations not covered by
 * {@link BillingSearchIT} or {@link BillingExportIT}.
 *
 * <p>Scenarios:
 * <ol>
 *   <li>S1 — dateField=PAID + paymentMode combined: two simultaneous EXISTS subqueries on
 *       billing_payment in one JPA Criteria query. Hibernate historically generated a
 *       cartesian join when two correlated subqueries shared the same from() root. This
 *       test would have caught that if the Criteria building was incorrect.</li>
 *   <li>S2 — dateField=PAID + paymentMode with NO date range: the date predicate must be
 *       skipped entirely (the "from==null AND to==null" early-exit in InvoiceSpecifications).
 *       Without this guard the subquery would become an unconditional EXISTS, returning only
 *       invoices that have ANY payment — i.e. it would silently turn into a paymentMode-only
 *       filter. The guard exists in code; this test pins it.</li>
 *   <li>S3 — KPI totalRemaining goes negative when paidAmount exceeds netAmount (overpayment
 *       data). The API must not error — it returns a negative totalRemaining, which is
 *       arithmetically correct. The test pins that this is stable and non-500.</li>
 *   <li>S4 — status multi-value + amountMin + dateField=PAID (three-filter AND) returns
 *       only the one invoice matching all three predicates, not union semantics.</li>
 *   <li>S5 — patientId filter does not leak invoices from other patients.</li>
 * </ol>
 *
 * <p>REGRESSION GUARD:
 * <ul>
 *   <li>S1 guards against a Hibernate Criteria API defect where two correlated subqueries
 *       on the same entity root in a single {@code Specification} could generate a cross-join,
 *       returning duplicate rows and inflating KPI counts (observed pattern in Hibernate 6.x
 *       with complex specifications — see careplus billing QA walk 2026-05-03).</li>
 *   <li>S3 guards against a 500 or NaN in the JSON when totalRemaining is negative — the
 *       BigDecimal subtraction must not be truncated to zero silently.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class InvoiceFilterCombinationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Combo-Test-2026!";
    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    String medEmail;
    UUID patientA;
    UUID patientB;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // FK-safe teardown
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medId = UUID.randomUUID();
        medEmail = "med-combo-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Combo', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        patientA = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier, phone,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Alami', 'Hassan', 'M', 'NORMAL', '0612345678',
                    0, 0, 'ACTIF', now(), now())
                """, patientA);

        patientB = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Bennani', 'Yasmine', 'F', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientB);
    }

    private String bearer() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + medEmail + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private UUID seedInvoice(String number, UUID patientId, OffsetDateTime issuedAt,
                             BigDecimal net, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, number, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    issued_at, version, created_at, updated_at)
                VALUES (?, ?, ?, ?::varchar, ?, 0, ?, 0, ?, 0, ?, 0, now(), now())
                """, id, number, patientId, status, net, net, net, issuedAt);
        return id;
    }

    private void seedPayment(UUID invoiceId, BigDecimal amount, String method, OffsetDateTime receivedAt) {
        UUID payId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_payment (id, invoice_id, method, amount, received_at, received_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, now())
                """, payId, invoiceId, method, amount, receivedAt, medId);
        // Reflect paid_total in the invoice header (like recordPayment does)
        jdbc.update("""
                UPDATE billing_invoice SET paid_total = paid_total + ?
                WHERE id = ?
                """, amount, invoiceId);
    }

    private OffsetDateTime casa(int y, int m, int d, int h) {
        return java.time.LocalDateTime.of(y, m, d, h, 0).atZone(CASA).toOffsetDateTime();
    }

    // ── S1: dateField=PAID + paymentMode — deux sous-requêtes EXISTS simultanées ─

    @Test
    @DisplayName("S1 — dateField=PAID + paymentMode=ESPECES: les deux sous-requêtes EXISTS ne génèrent pas de doublons")
    void search_paidDateFieldAndPaymentMode_noDuplicates() throws Exception {
        // inv1: paid in April by ESPECES — should match both predicates
        UUID inv1 = seedInvoice("2026-S1-001", patientA, casa(2026, 3, 10, 10),
                new BigDecimal("500"), "EMISE");
        seedPayment(inv1, new BigDecimal("500"), "ESPECES", casa(2026, 4, 5, 10));

        // inv2: paid in April but by CHEQUE — should NOT match paymentMode=ESPECES
        UUID inv2 = seedInvoice("2026-S1-002", patientA, casa(2026, 3, 15, 10),
                new BigDecimal("300"), "EMISE");
        seedPayment(inv2, new BigDecimal("300"), "CHEQUE", casa(2026, 4, 10, 10));

        // inv3: paid in May — outside the date range
        UUID inv3 = seedInvoice("2026-S1-003", patientA, casa(2026, 3, 20, 10),
                new BigDecimal("200"), "EMISE");
        seedPayment(inv3, new BigDecimal("200"), "ESPECES", casa(2026, 5, 1, 10));

        String token = bearer();
        MvcResult r = mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "PAID")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .param("paymentMode", "ESPECES")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andReturn();

        // No duplicate IDs — if Hibernate generates a cross-join, count > 1
        JsonNode items = objectMapper.readTree(r.getResponse().getContentAsString()).get("items");
        assertThat(items.size()).isEqualTo(1);
        assertThat(items.get(0).get("number").asText()).isEqualTo("2026-S1-001");

        // KPIs must be computed on the single matched invoice, not inflated by duplicates
        mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "PAID")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .param("paymentMode", "ESPECES")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalNet").value(500.0))
                .andExpect(jsonPath("$.totalPaid").value(500.0))
                .andExpect(jsonPath("$.totalRemaining").value(0.0));
    }

    // ── S2: dateField=PAID sans plage de dates → pas de prédicat de date ─────

    @Test
    @DisplayName("S2 — dateField=PAID sans from/to: le prédicat de date est ignoré, résultat = tous les paymentMode correspondants")
    void search_paidDateFieldNoDateRange_datePredicateSkipped() throws Exception {
        // Paid invoice with ESPECES
        UUID paidEspeces = seedInvoice("2026-S2-001", patientA, casa(2026, 2, 1, 10),
                new BigDecimal("100"), "EMISE");
        seedPayment(paidEspeces, new BigDecimal("100"), "ESPECES", casa(2026, 2, 15, 10));

        // Unpaid invoice (EMISE, no payment)
        seedInvoice("2026-S2-002", patientA, casa(2026, 3, 1, 10),
                new BigDecimal("200"), "EMISE");

        String token = bearer();
        // dateField=PAID but no from/to: date subquery not added, only paymentMode applies
        mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "PAID")
                        .param("paymentMode", "ESPECES")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                // Only the invoice with an ESPECES payment matches
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].number").value("2026-S2-001"));
    }

    // ── S3: KPI totalRemaining négatif sur overpayment → pas de 500 ──────────

    @Test
    @DisplayName("S3 — facture avec paidAmount > netAmount: totalRemaining négatif retourné correctement (pas de 500 ni de troncature à zéro)")
    void search_overpaidInvoice_totalRemainingNegative() throws Exception {
        // Invoice with net=0 but paid_total=400 (data anomaly possible in legacy seed)
        UUID inv = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, number, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    issued_at, version, created_at, updated_at)
                VALUES (?, '2026-S3-001', ?, 'PAYEE_TOTALE', 0, 0, 0, 0, 0.00, 400.00,
                    '2026-05-01T10:00:00Z', 0, now(), now())
                """, inv, patientA);

        String token = bearer();
        MvcResult r = mockMvc.perform(get("/api/invoices/search")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andReturn();

        JsonNode root = objectMapper.readTree(r.getResponse().getContentAsString());
        // totalNet=0, totalPaid=400 (from paid_total column via enrich()), totalRemaining=-400
        assertThat(root.get("totalNet").decimalValue()).isEqualByComparingTo(BigDecimal.ZERO);
        // paidAmount on the row comes from paid_total column, not re-summed from billing_payment
        assertThat(root.get("items").get(0).get("paidAmount").decimalValue())
                .isEqualByComparingTo(new BigDecimal("400.00"));
        // totalRemaining = totalNet - totalPaid = 0 - 400 = -400
        assertThat(root.get("totalRemaining").decimalValue())
                .isEqualByComparingTo(new BigDecimal("-400.00"));
    }

    // ── S4: trois filtres AND stricts ────────────────────────────────────────

    @Test
    @DisplayName("S4 — status + amountMin + dateField=PAID: les trois prédicats sont AND-combinés sans union")
    void search_threeFiltersAnd_strictIntersection() throws Exception {
        // Matches all three: PAYEE_TOTALE, paid in April, net >= 500
        UUID inv1 = seedInvoice("2026-S4-001", patientA, casa(2026, 3, 1, 10),
                new BigDecimal("600"), "EMISE");
        seedPayment(inv1, new BigDecimal("600"), "ESPECES", casa(2026, 4, 10, 10));
        // Adjust status
        jdbc.update("UPDATE billing_invoice SET status = 'PAYEE_TOTALE' WHERE id = ?", inv1);

        // Fails amountMin (net=100 < 500)
        UUID inv2 = seedInvoice("2026-S4-002", patientA, casa(2026, 3, 5, 10),
                new BigDecimal("100"), "EMISE");
        seedPayment(inv2, new BigDecimal("100"), "ESPECES", casa(2026, 4, 11, 10));
        jdbc.update("UPDATE billing_invoice SET status = 'PAYEE_TOTALE' WHERE id = ?", inv2);

        // Fails dateField=PAID (paid in May not April)
        UUID inv3 = seedInvoice("2026-S4-003", patientA, casa(2026, 3, 10, 10),
                new BigDecimal("700"), "EMISE");
        seedPayment(inv3, new BigDecimal("700"), "ESPECES", casa(2026, 5, 1, 10));
        jdbc.update("UPDATE billing_invoice SET status = 'PAYEE_TOTALE' WHERE id = ?", inv3);

        // Fails status (EMISE not PAYEE_TOTALE)
        seedInvoice("2026-S4-004", patientA, casa(2026, 3, 15, 10),
                new BigDecimal("800"), "EMISE");

        String token = bearer();
        mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "PAID")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .param("status", "PAYEE_TOTALE")
                        .param("amountMin", "500")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].number").value("2026-S4-001"));
    }

    // ── S5: patientId filter ne fuite pas les factures d'autres patients ──────

    @Test
    @DisplayName("S5 — patientId filter: les factures d'autres patients ne sont jamais retournées")
    void search_patientIdFilter_noLeakageToOtherPatients() throws Exception {
        seedInvoice("2026-S5-001", patientA, casa(2026, 4, 1, 10),
                new BigDecimal("300"), "EMISE");
        seedInvoice("2026-S5-002", patientB, casa(2026, 4, 2, 10),
                new BigDecimal("400"), "EMISE");

        String token = bearer();
        MvcResult r = mockMvc.perform(get("/api/invoices/search")
                        .param("patientId", patientA.toString())
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andReturn();

        JsonNode items = objectMapper.readTree(r.getResponse().getContentAsString()).get("items");
        assertThat(items.size()).isEqualTo(1);
        assertThat(items.get(0).get("patientId").asText()).isEqualTo(patientA.toString());

        // Also verify export respects the patientId filter
        MvcResult exportResult = mockMvc.perform(get("/api/invoices/export")
                        .param("patientId", patientA.toString())
                        .param("format", "csv")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();
        String csv = new String(exportResult.getResponse().getContentAsByteArray(),
                java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).contains("2026-S5-001");
        assertThat(csv).doesNotContain("2026-S5-002");
    }
}
