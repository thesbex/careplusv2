package ma.careplus.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
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
 * IT for {@code GET /api/dashboard/financial} — F1 Dashboard, partie financière.
 *
 * <p>Seeds invoices directly via SQL (skips the consultation/payment workflow)
 * for deterministic dates and amounts. Validates RBAC, structure, calculation
 * correctness on caJour/caMois/caYTD/caMoisN1, ca12Mois shape, caParActe
 * sorting + cap, impayés filtering, and tauxEncaissement bounds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class FinancialDashboardIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Dashboard-Fin-Test-2026!";
    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String adminEmail;
    String secEmail;
    String asstEmail;

    UUID medId;
    UUID patientId;
    UUID actConsultId;
    UUID actEcgId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Cleanup billing graph + dependents
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM catalog_act WHERE code IN ('FIN-CONSULT','FIN-ECG','FIN-ECHO','FIN-X')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'DashFin'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN (SELECT id FROM identity_user WHERE email LIKE '%-fin-dashboard-%@test.ma')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN (SELECT id FROM identity_user WHERE email LIKE '%-fin-dashboard-%@test.ma')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE '%-fin-dashboard-%@test.ma'");

        // Users
        medId = createUser("med", ROLE_MEDECIN);
        medEmail = lastEmail;
        UUID adminId = createUser("admin", ROLE_ADMIN);
        adminEmail = lastEmail;
        UUID secId = createUser("sec", ROLE_SECRETAIRE);
        secEmail = lastEmail;
        UUID asstId = createUser("asst", ROLE_ASSISTANT);
        asstEmail = lastEmail;

        // Patient (single one — invoices only need a patient FK)
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'DashFin', 'Patient', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Catalog acts
        actConsultId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_act (id, code, name, default_price, vat_rate, active, type,
                    created_at, updated_at)
                VALUES (?, 'FIN-CONSULT', 'Consultation', 200.00, 0, TRUE, 'CONSULTATION', now(), now())
                """, actConsultId);
        actEcgId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_act (id, code, name, default_price, vat_rate, active, type,
                    created_at, updated_at)
                VALUES (?, 'FIN-ECG', 'Électrocardiogramme', 150.00, 0, TRUE, 'PRESTATION', now(), now())
                """, actEcgId);
    }

    private String lastEmail;

    private UUID createUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-fin-dashboard-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'F', 'D', TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        this.lastEmail = email;
        return id;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Invoice seeding helpers ───────────────────────────────────────────────

    /** Insert a paid invoice (PAYEE_TOTALE) issued at the given Casa-local instant. */
    private UUID insertPaidInvoice(OffsetDateTime issuedAtCasa, BigDecimal total) {
        return insertInvoice(issuedAtCasa, "PAYEE_TOTALE", total, total);
    }

    private UUID insertInvoice(OffsetDateTime issuedAtCasa, String status,
                                BigDecimal total, BigDecimal paidTotal) {
        UUID id = UUID.randomUUID();
        String number = (issuedAtCasa == null)
                ? null
                : String.format("%d-%06d", issuedAtCasa.getYear(),
                        Math.abs(id.hashCode()) % 999999);
        jdbc.update("""
                INSERT INTO billing_invoice (id, number, patient_id, status,
                    total, discount_amount, net_amount, paid_total,
                    issued_at, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 0, now(), now())
                """,
                id, number, patientId, status,
                total, total, paidTotal,
                issuedAtCasa);
        return id;
    }

    private void insertLine(UUID invoiceId, UUID actId, String description,
                             BigDecimal unitPrice, BigDecimal quantity) {
        jdbc.update("""
                INSERT INTO billing_invoice_line (id, invoice_id, position, act_id,
                    description, unit_price, quantity, vat_rate, line_total, created_at)
                VALUES (gen_random_uuid(), ?, 0, ?, ?, ?, ?, 0, ?, now())
                """,
                invoiceId, actId, description, unitPrice, quantity,
                unitPrice.multiply(quantity));
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    void getFinancialDashboard_returns200WithFullStructureForMedecin() throws Exception {
        String token = bearer(medEmail);

        MvcResult res = mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caJour").exists())
                .andExpect(jsonPath("$.caMois").exists())
                .andExpect(jsonPath("$.caYTD").exists())
                .andExpect(jsonPath("$.caMoisN1").exists())
                .andExpect(jsonPath("$.ca12Mois").isArray())
                .andExpect(jsonPath("$.caParActe").isArray())
                .andExpect(jsonPath("$.impayesTotal").exists())
                .andExpect(jsonPath("$.impayesCount").exists())
                .andExpect(jsonPath("$.tauxEncaissement").exists())
                .andReturn();

        JsonNode body = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(body.get("ca12Mois").size()).isEqualTo(12);
    }

    @Test
    void getFinancialDashboard_returns200ForAdmin() throws Exception {
        String token = bearer(adminEmail);
        mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk());
    }

    @Test
    void getFinancialDashboard_401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/dashboard/financial"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getFinancialDashboard_403ForSecretaire() throws Exception {
        String token = bearer(secEmail);
        mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isForbidden());
    }

    @Test
    void getFinancialDashboard_403ForAssistant() throws Exception {
        String token = bearer(asstEmail);
        mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isForbidden());
    }

    @Test
    void caMois_sumsOnlyInvoicesOfCurrentMonth() throws Exception {
        // 3 paid invoices, 2 in current month (200 + 350 = 550), 1 in last month (ignored).
        OffsetDateTime midMonth = nowCasa();
        insertPaidInvoice(midMonth, new BigDecimal("200.00"));
        insertPaidInvoice(midMonth.minusHours(2), new BigDecimal("350.00"));
        insertPaidInvoice(firstOfPreviousMonthCasa().plusDays(5), new BigDecimal("999.00"));

        String token = bearer(medEmail);
        MvcResult res = mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk()).andReturn();

        JsonNode body = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(body.get("caMois").decimalValue()).isEqualByComparingTo(new BigDecimal("550.00"));
        assertThat(body.get("caMoisN1").decimalValue()).isEqualByComparingTo(new BigDecimal("999.00"));
    }

    @Test
    void ca12Mois_returnsExactly12EntriesAscendingWithCurrentMonthLast() throws Exception {
        insertPaidInvoice(nowCasa(), new BigDecimal("100.00"));

        String token = bearer(medEmail);
        MvcResult res = mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk()).andReturn();

        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString()).get("ca12Mois");
        assertThat(arr.size()).isEqualTo(12);

        YearMonth currentMonth = YearMonth.from(LocalDate.now(CASA));
        String expectedFirst = String.format("%04d-%02d",
                currentMonth.minusMonths(11).getYear(), currentMonth.minusMonths(11).getMonthValue());
        String expectedLast = String.format("%04d-%02d",
                currentMonth.getYear(), currentMonth.getMonthValue());
        assertThat(arr.get(0).get("month").asText()).isEqualTo(expectedFirst);
        assertThat(arr.get(11).get("month").asText()).isEqualTo(expectedLast);
        assertThat(arr.get(11).get("amount").decimalValue())
                .isGreaterThanOrEqualTo(new BigDecimal("100.00"));
    }

    @Test
    void caParActe_sortedDescAndCappedAtTen() throws Exception {
        // 2 paid invoices in the current month, lines on different acts.
        OffsetDateTime now = nowCasa();
        UUID inv1 = insertPaidInvoice(now, new BigDecimal("500.00"));
        insertLine(inv1, actConsultId, "Consultation", new BigDecimal("200.00"), BigDecimal.ONE);
        insertLine(inv1, actEcgId, "ECG", new BigDecimal("150.00"), new BigDecimal("2")); // 300

        UUID inv2 = insertPaidInvoice(now.minusHours(3), new BigDecimal("400.00"));
        insertLine(inv2, actConsultId, "Consultation", new BigDecimal("200.00"), new BigDecimal("2")); // 400

        String token = bearer(medEmail);
        MvcResult res = mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk()).andReturn();

        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString()).get("caParActe");
        assertThat(arr.size()).isLessThanOrEqualTo(10);
        assertThat(arr.size()).isGreaterThanOrEqualTo(2);
        // Sorted desc by amount
        for (int i = 1; i < arr.size(); i++) {
            assertThat(arr.get(i - 1).get("amount").decimalValue())
                    .isGreaterThanOrEqualTo(arr.get(i).get("amount").decimalValue());
        }
        // Top should be FIN-CONSULT (200 + 400 = 600) > FIN-ECG (300)
        assertThat(arr.get(0).get("acteCode").asText()).isEqualTo("FIN-CONSULT");
        assertThat(arr.get(0).get("amount").decimalValue())
                .isEqualByComparingTo(new BigDecimal("600.00"));
        assertThat(arr.get(0).get("count").asLong()).isEqualTo(2L);
    }

    @Test
    void impayes_countsOnlyEmiseInvoices() throws Exception {
        // 2 EMISE = impayés, 1 PAYEE_TOTALE = ignored, 1 ANNULEE = ignored
        OffsetDateTime now = nowCasa();
        insertInvoice(now, "EMISE", new BigDecimal("100.00"), BigDecimal.ZERO);
        insertInvoice(now, "EMISE", new BigDecimal("250.00"), new BigDecimal("50.00")); // partially paid but still EMISE → restant=200
        insertInvoice(now, "PAYEE_TOTALE", new BigDecimal("400.00"), new BigDecimal("400.00"));
        insertInvoice(now, "ANNULEE", new BigDecimal("999.00"), BigDecimal.ZERO);

        String token = bearer(medEmail);
        MvcResult res = mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk()).andReturn();

        JsonNode body = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(body.get("impayesCount").asLong()).isEqualTo(2L);
        // 100 (restant) + 200 (250-50) = 300
        assertThat(body.get("impayesTotal").decimalValue())
                .isEqualByComparingTo(new BigDecimal("300.00"));
    }

    @Test
    void tauxEncaissement_isWithinZeroAndOne() throws Exception {
        OffsetDateTime now = nowCasa();
        insertPaidInvoice(now, new BigDecimal("800.00"));
        insertInvoice(now, "EMISE", new BigDecimal("200.00"), BigDecimal.ZERO);

        String token = bearer(medEmail);
        MvcResult res = mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk()).andReturn();

        JsonNode body = objectMapper.readTree(res.getResponse().getContentAsString());
        BigDecimal taux = body.get("tauxEncaissement").decimalValue();
        assertThat(taux).isBetween(BigDecimal.ZERO, BigDecimal.ONE);
        // 800 / (800 + 200) = 0.8000
        assertThat(taux).isEqualByComparingTo(new BigDecimal("0.8000"));
    }

    @Test
    void tauxEncaissement_isOneWhenNoActivity() throws Exception {
        // Default state: no invoices at all → no impayés, no CA — taux par convention = 1.
        String token = bearer(medEmail);
        MvcResult res = mockMvc.perform(get("/api/dashboard/financial").header("Authorization", token))
                .andExpect(status().isOk()).andReturn();

        JsonNode body = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(body.get("tauxEncaissement").decimalValue())
                .isEqualByComparingTo(BigDecimal.ONE);
    }

    // ── Time helpers ──────────────────────────────────────────────────────────

    /** A moment safely inside the current Casa-local day (mid-day to avoid DST edges). */
    private OffsetDateTime nowCasa() {
        return LocalDate.now(CASA).atTime(12, 0).atZone(CASA).toOffsetDateTime();
    }

    private OffsetDateTime firstOfPreviousMonthCasa() {
        return YearMonth.from(LocalDate.now(CASA)).minusMonths(1)
                .atDay(1).atTime(12, 0).atZone(CASA).toOffsetDateTime();
    }
}
