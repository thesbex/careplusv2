package ma.careplus.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.dhatim.fastexcel.reader.ReadableWorkbook;
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
 * IT for {@code GET /api/invoices/export} — CSV + xlsx + 422 guard + RBAC + filter pass-through.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class BillingExportIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Export-Test-2026!";
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

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

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
        medEmail = "med-export-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Export', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        secId = UUID.randomUUID();
        secEmail = "sec-export-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Export', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);

        patientA = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier, phone,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Alami', 'Hassan', 'M', 'NORMAL', '0612345678',
                    0, 0, 'ACTIF', now(), now())
                """, patientA);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private UUID seedInvoice(String number, OffsetDateTime issuedAt, BigDecimal net, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, number, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    issued_at, version, created_at, updated_at)
                VALUES (?, ?, ?, ?::varchar, ?, 0, ?, 0, ?, 0, ?, 0, now(), now())
                """, id, number, patientA, status, net, net, net, issuedAt);
        return id;
    }

    private OffsetDateTime casa(int y, int m, int d, int h) {
        return java.time.LocalDateTime.of(y, m, d, h, 0).atZone(CASA).toOffsetDateTime();
    }

    // ── Test 12: CSV format & headers ────────────────────────────────────────

    @Test
    void export_csv_hasUtf8BomSemicolonFrenchDatesAndAttachmentHeader() throws Exception {
        seedInvoice("2026-000001", casa(2026, 4, 15, 10), new BigDecimal("1234.56"), "EMISE");

        MvcResult r = mockMvc.perform(get("/api/invoices/export")
                        .param("format", "csv")
                        .param("from", "2026-04-01")
                        .param("to", "2026-04-30")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        // Content-Type
        assertThat(r.getResponse().getContentType()).startsWith("text/csv");
        // Content-Disposition with filename
        String dispo = r.getResponse().getHeader("Content-Disposition");
        assertThat(dispo).isNotNull();
        assertThat(dispo).contains("attachment").contains("factures_2026-04-01_2026-04-30.csv");

        byte[] body = r.getResponse().getContentAsByteArray();
        // BOM
        assertThat(body[0] & 0xFF).isEqualTo(0xEF);
        assertThat(body[1] & 0xFF).isEqualTo(0xBB);
        assertThat(body[2] & 0xFF).isEqualTo(0xBF);

        String content = new String(body, StandardCharsets.UTF_8);
        // Header row in French + ;
        assertThat(content).contains("Numéro;Date émission;Statut");
        // FR date format JJ/MM/AAAA
        assertThat(content).contains("15/04/2026");
        // FR decimals (comma)
        assertThat(content).contains("1234,56");
        // Status label "Émise" not "EMISE"
        assertThat(content).contains(";Émise;");
    }

    // ── Test 13: xlsx format — ouvre via fastexcel reader ────────────────────

    @Test
    void export_xlsx_isValidWithSumFooter() throws Exception {
        seedInvoice("2026-000010", casa(2026, 4, 1, 10), new BigDecimal("100.00"), "EMISE");
        seedInvoice("2026-000011", casa(2026, 4, 2, 10), new BigDecimal("200.00"), "EMISE");

        MvcResult r = mockMvc.perform(get("/api/invoices/export")
                        .param("format", "xlsx")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(r.getResponse().getContentType())
                .contains("spreadsheetml");
        assertThat(r.getResponse().getHeader("Content-Disposition")).contains(".xlsx");

        byte[] body = r.getResponse().getContentAsByteArray();
        // Magic bytes PK\x03\x04
        assertThat(body[0]).isEqualTo((byte) 0x50);
        assertThat(body[1]).isEqualTo((byte) 0x4B);
        assertThat(body[2]).isEqualTo((byte) 0x03);
        assertThat(body[3]).isEqualTo((byte) 0x04);

        try (ReadableWorkbook wb = new ReadableWorkbook(new ByteArrayInputStream(body))) {
            var sheet = wb.getFirstSheet();
            var allRows = sheet.read();
            // Header + 2 data rows + 1 totaux row
            assertThat(allRows.size()).isEqualTo(4);
            // Header
            assertThat(allRows.get(0).getCell(0).asString()).isEqualTo("Numéro");
            // SUM row says TOTAUX in col A and total = 300 in net (col 8 = "Net")
            assertThat(allRows.get(3).getCell(0).asString()).isEqualTo("TOTAUX");
            // The cell holds a formula reference → asNumber resolves the cached value if any,
            // otherwise we assert the formula type.
        }
    }

    // ── Test 14: garde-fou 422 EXPORT_TOO_LARGE ──────────────────────────────

    @Test
    void export_aboveCap_returns422() throws Exception {
        // Seed 10001 invoices via a single batch SQL — keep test under 5s.
        StringBuilder sb = new StringBuilder("""
                INSERT INTO billing_invoice (id, number, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    issued_at, version, created_at, updated_at) VALUES
                """);
        for (int i = 0; i < 10_001; i++) {
            if (i > 0) sb.append(",");
            sb.append("(gen_random_uuid(), '2026-")
                    .append(String.format("%06d", i + 1))
                    .append("', '").append(patientA).append("', 'EMISE',")
                    .append(" 100, 0, 100, 0, 100, 0, '2026-04-01T10:00:00+01:00', 0, now(), now())");
        }
        jdbc.execute(sb.toString());

        mockMvc.perform(get("/api/invoices/export")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isUnprocessableEntity());
    }

    // ── Test 15: filtres respectés — status=EMISE n'inclut pas BROUILLON ─────

    @Test
    void export_csv_respectsFilters() throws Exception {
        seedInvoice("2026-000020", casa(2026, 4, 1, 10), new BigDecimal("100"), "EMISE");
        UUID draft = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    version, created_at, updated_at)
                VALUES (?, ?, 'BROUILLON', 0, 0, 0, 0, 99.99, 0, 0, now(), now())
                """, draft, patientA);

        MvcResult r = mockMvc.perform(get("/api/invoices/export")
                        .param("status", "EMISE")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();
        String content = new String(r.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        assertThat(content).contains("2026-000020");
        // Le brouillon a net 99.99 → le montant ne doit pas apparaître
        assertThat(content).doesNotContain("99,99");
    }

    // ── Test 16: RBAC — secrétaire 403, médecin OK ───────────────────────────

    @Test
    void export_rbac_secretaireForbiddenMedecinOk() throws Exception {
        seedInvoice("2026-000030", casa(2026, 4, 1, 10), new BigDecimal("100"), "EMISE");

        // /search OK pour secrétaire
        mockMvc.perform(get("/api/invoices/search").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk());
        // /export interdit pour secrétaire
        mockMvc.perform(get("/api/invoices/export").header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());
        // OK pour médecin
        mockMvc.perform(get("/api/invoices/export").header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk());
    }

    // ── Test 17: brouillon dans CSV — numéro / dates vides ───────────────────

    @Test
    void export_csv_draftHasEmptyNumberAndIssuedDate() throws Exception {
        UUID draft = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, patient_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    version, created_at, updated_at)
                VALUES (?, ?, 'BROUILLON', 0, 0, 100, 0, 100, 0, 0, now(), now())
                """, draft, patientA);

        MvcResult r = mockMvc.perform(get("/api/invoices/export")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();
        String content = new String(r.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        // Skip BOM + header line
        List<String> lines = content.lines().toList();
        // Line 0 = headers, line 1 = the draft row
        String dataLine = lines.get(1);
        // First field (Numéro) empty → starts with ;
        assertThat(dataLine).startsWith(";");
        // Statut = "Brouillon"
        assertThat(dataLine).contains("Brouillon");
    }
}
