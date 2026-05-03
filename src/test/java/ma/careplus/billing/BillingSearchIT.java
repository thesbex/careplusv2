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
 * IT for {@code GET /api/invoices/search} — filters + pagination + KPIs.
 *
 * <p>Seeds invoices directly in SQL (skips the consultation-sign event flow) to keep the
 * test fast and deterministic on dates / amounts / payment modes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class BillingSearchIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Search-Test-2026!";
    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    String medEmail;
    UUID secId;
    String secEmail;
    UUID patientA;
    UUID patientB;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Cleanup
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Users
        medId = UUID.randomUUID();
        medEmail = "med-search-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Search', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        secId = UUID.randomUUID();
        secEmail = "sec-search-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Search', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);

        // Patients
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

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /** Helper: insert an EMISE invoice with given issued_at + net_amount + paid_total. */
    private UUID seedInvoice(String number, UUID patientId, OffsetDateTime issuedAt,
                             BigDecimal net, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, number, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    issued_at, version, created_at, updated_at)
                VALUES (?, ?, ?, ?::varchar,
                    ?, 0, ?, 0, ?, 0,
                    ?, 0, now(), now())
                """, id, number, patientId, status,
                net, net, net, issuedAt);
        return id;
    }

    /** Helper: insert a payment for an invoice, also updates paid_total + status if total reached. */
    private void seedPayment(UUID invoiceId, BigDecimal amount, String mode, OffsetDateTime receivedAt) {
        UUID payId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_payment (id, invoice_id, method, amount, received_at, received_by,
                    created_at)
                VALUES (?, ?, ?, ?, ?, ?, now())
                """, payId, invoiceId, mode, amount, receivedAt, medId);
        jdbc.update("""
                UPDATE billing_invoice SET paid_total = paid_total + ?,
                    status = CASE WHEN paid_total + ? >= net_amount THEN 'PAYEE_TOTALE'
                                  WHEN paid_total + ? > 0 THEN 'PAYEE_PARTIELLE'
                                  ELSE status END
                WHERE id = ?
                """, amount, amount, amount, invoiceId);
    }

    private OffsetDateTime casa(int y, int m, int d, int h) {
        return java.time.LocalDateTime.of(y, m, d, h, 0).atZone(CASA).toOffsetDateTime();
    }

    // ── Test 1: aucun filtre → tout, ordre issued_at DESC NULLS LAST ─────────

    @Test
    void search_noFilters_returnsAllOrderedByIssuedDesc() throws Exception {
        // 3 invoices: march, april, draft (no issued_at)
        seedInvoice("2026-000001", patientA, casa(2026, 3, 15, 10), new BigDecimal("300.00"), "EMISE");
        seedInvoice("2026-000002", patientA, casa(2026, 4, 10, 10), new BigDecimal("400.00"), "EMISE");
        UUID draft = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    version, created_at, updated_at)
                VALUES (?, ?, 'BROUILLON', 0, 0, 0, 0, 100.00, 0, 0, now(), now())
                """, draft, patientA);

        String token = bearer(medEmail);
        MvcResult r = mockMvc.perform(get("/api/invoices/search").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(3))
                .andReturn();
        JsonNode items = objectMapper.readTree(r.getResponse().getContentAsString()).get("items");
        // Order: april (latest issued), march, draft (NULL issued_at)
        assertThat(items.get(0).get("number").asText()).isEqualTo("2026-000002");
        assertThat(items.get(1).get("number").asText()).isEqualTo("2026-000001");
        assertThat(items.get(2).get("status").asText()).isEqualTo("BROUILLON");
    }

    // ── Test 2: dateField=ISSUED, plage avril ────────────────────────────────

    @Test
    void search_dateFieldIssued_excludesOutsideRange() throws Exception {
        seedInvoice("2026-000010", patientA, casa(2026, 3, 31, 10), new BigDecimal("100"), "EMISE");
        seedInvoice("2026-000011", patientA, casa(2026, 4, 15, 10), new BigDecimal("200"), "EMISE");
        seedInvoice("2026-000012", patientA, casa(2026, 5, 1, 10), new BigDecimal("300"), "EMISE");

        String token = bearer(medEmail);
        mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "ISSUED")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].number").value("2026-000011"));
    }

    // ── Test 3: dateField=PAID, facture émise mars + payée avril ─────────────

    @Test
    void search_dateFieldPaid_matchesByPaymentDate() throws Exception {
        UUID inv = seedInvoice("2026-000020", patientA, casa(2026, 3, 15, 10),
                new BigDecimal("500"), "EMISE");
        seedPayment(inv, new BigDecimal("500"), "ESPECES", casa(2026, 4, 5, 14));

        String token = bearer(medEmail);
        // Paid filter: facture présente
        mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "PAID")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(1));
        // Issued filter: facture absente (émise en mars)
        mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "ISSUED")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(0));
    }

    // ── Test 4: status multi-valué OR ────────────────────────────────────────

    @Test
    void search_multiStatus_unionSemantics() throws Exception {
        seedInvoice("2026-000030", patientA, casa(2026, 4, 1, 10), new BigDecimal("100"), "EMISE");
        UUID inv2 = seedInvoice("2026-000031", patientA, casa(2026, 4, 2, 10),
                new BigDecimal("200"), "EMISE");
        seedPayment(inv2, new BigDecimal("200"), "CB", casa(2026, 4, 2, 11));
        UUID draft = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    version, created_at, updated_at)
                VALUES (?, ?, 'BROUILLON', 0, 0, 0, 0, 50, 0, 0, now(), now())
                """, draft, patientA);

        String token = bearer(medEmail);
        mockMvc.perform(get("/api/invoices/search")
                        .param("status", "EMISE", "PAYEE_TOTALE")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(2));
    }

    // ── Test 5: paymentMode multi — facture mixte CB+ESPECES présente ────────

    @Test
    void search_multiPaymentMode_existsSemantics() throws Exception {
        UUID mixed = seedInvoice("2026-000040", patientA, casa(2026, 4, 1, 10),
                new BigDecimal("500"), "EMISE");
        seedPayment(mixed, new BigDecimal("200"), "CB", casa(2026, 4, 1, 11));
        seedPayment(mixed, new BigDecimal("300"), "ESPECES", casa(2026, 4, 1, 12));
        UUID fullCb = seedInvoice("2026-000041", patientA, casa(2026, 4, 2, 10),
                new BigDecimal("400"), "EMISE");
        seedPayment(fullCb, new BigDecimal("400"), "CB", casa(2026, 4, 2, 11));

        String token = bearer(medEmail);
        // Filter ESPECES: only the mixed invoice
        MvcResult r = mockMvc.perform(get("/api/invoices/search")
                        .param("paymentMode", "ESPECES")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andReturn();
        assertThat(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("items").get(0).get("number").asText()).isEqualTo("2026-000040");
    }

    // ── Test 6: amountMin / amountMax bornes inclusives ──────────────────────

    @Test
    void search_amountBounds_inclusive() throws Exception {
        seedInvoice("2026-000050", patientA, casa(2026, 4, 1, 10), new BigDecimal("499.99"), "EMISE");
        seedInvoice("2026-000051", patientA, casa(2026, 4, 2, 10), new BigDecimal("500.00"), "EMISE");
        seedInvoice("2026-000052", patientA, casa(2026, 4, 3, 10), new BigDecimal("999.99"), "EMISE");
        seedInvoice("2026-000053", patientA, casa(2026, 4, 4, 10), new BigDecimal("1000.00"), "EMISE");
        seedInvoice("2026-000054", patientA, casa(2026, 4, 5, 10), new BigDecimal("1000.01"), "EMISE");

        String token = bearer(medEmail);
        mockMvc.perform(get("/api/invoices/search")
                        .param("amountMin", "500")
                        .param("amountMax", "1000")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(3));
    }

    // ── Test 7: combinaison from + status + amountMin (AND strict) ───────────

    @Test
    void search_combination_isAndStrict() throws Exception {
        UUID payee = seedInvoice("2026-000060", patientA, casa(2026, 4, 1, 10),
                new BigDecimal("600"), "EMISE");
        seedPayment(payee, new BigDecimal("600"), "CB", casa(2026, 4, 1, 11));
        seedInvoice("2026-000061", patientA, casa(2026, 4, 2, 10),
                new BigDecimal("100"), "EMISE"); // monto trop petit
        seedInvoice("2026-000062", patientA, casa(2026, 3, 1, 10),
                new BigDecimal("700"), "EMISE"); // hors plage

        String token = bearer(medEmail);
        mockMvc.perform(get("/api/invoices/search")
                        .param("dateField", "ISSUED")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .param("status", "PAYEE_TOTALE")
                        .param("amountMin", "500")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].number").value("2026-000060"));
    }

    // ── Test 8: TZ Casablanca — facture émise 23:30 le 30/04 incluse ─────────

    @Test
    void search_dateRange_respectsCasablancaTZ() throws Exception {
        seedInvoice("2026-000070", patientA, casa(2026, 4, 30, 23), new BigDecimal("100"), "EMISE");

        String token = bearer(medEmail);
        mockMvc.perform(get("/api/invoices/search")
                        .param("from", "2026-04-30")
                        .param("to", "2026-04-30")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(1));
    }

    // ── Test 9: pagination ───────────────────────────────────────────────────

    @Test
    void search_pagination_pageSize() throws Exception {
        for (int i = 1; i <= 25; i++) {
            seedInvoice(String.format("2026-%06d", 100 + i), patientA,
                    casa(2026, 4, i % 28 + 1, 10), new BigDecimal("100"), "EMISE");
        }

        String token = bearer(medEmail);
        mockMvc.perform(get("/api/invoices/search")
                        .param("page", "0")
                        .param("size", "10")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(25))
                .andExpect(jsonPath("$.items.length()").value(10))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10));

        mockMvc.perform(get("/api/invoices/search")
                        .param("page", "2")
                        .param("size", "10")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.items.length()").value(5));
    }

    // ── Test 10: KPIs agrégés sur l'ensemble filtré ──────────────────────────

    @Test
    void search_kpis_areComputedOnFilteredSet() throws Exception {
        UUID a = seedInvoice("2026-000080", patientA, casa(2026, 4, 1, 10),
                new BigDecimal("200"), "EMISE");
        seedPayment(a, new BigDecimal("100"), "ESPECES", casa(2026, 4, 1, 11));
        seedInvoice("2026-000081", patientA, casa(2026, 4, 2, 10),
                new BigDecimal("300"), "EMISE");
        // hors filtre
        seedInvoice("2026-000082", patientA, casa(2026, 5, 1, 10),
                new BigDecimal("999"), "EMISE");

        String token = bearer(medEmail);
        mockMvc.perform(get("/api/invoices/search")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .header("Authorization", token))
                .andExpect(jsonPath("$.totalCount").value(2))
                .andExpect(jsonPath("$.totalNet").value(500.00))
                .andExpect(jsonPath("$.totalPaid").value(100.00))
                .andExpect(jsonPath("$.totalRemaining").value(400.00));
    }

    // ── Test 11: RBAC — secrétaire OK, médecin OK ────────────────────────────

    @Test
    void search_rbac_allRolesAllowed() throws Exception {
        seedInvoice("2026-000090", patientA, casa(2026, 4, 1, 10),
                new BigDecimal("100"), "EMISE");

        mockMvc.perform(get("/api/invoices/search").header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/invoices/search").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk());
    }
}
