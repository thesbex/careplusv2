package ma.careplus.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
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
 * Integration tests for QA9-15 finance/expense module.
 *
 * <p>Scenarios covered:
 * <ol>
 *   <li>POST /api/expenses as ADMIN → 201 + body</li>
 *   <li>POST /api/expenses as SECRETAIRE → 403</li>
 *   <li>GET  /api/expenses → list includes created expense</li>
 *   <li>GET  /api/expenses?category=LOYER → category filter</li>
 *   <li>PUT  /api/expenses/{id} → 200 + updated fields persisted</li>
 *   <li>DELETE /api/expenses/{id} → 204 + excluded from subsequent list</li>
 *   <li>GET  /api/expenses/summary?year=YYYY → monthly totals correct</li>
 *   <li>POST /api/expenses with invalid category → 400</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class FinanceExpenseIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    // Role UUIDs seeded by V001 baseline
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Finance-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String adminEmail;
    String medEmail;
    String secEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up in dependency order
        jdbc.update("DELETE FROM finance_expense");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = seedUser("admin-fin", ROLE_ADMIN);
        medEmail   = seedUser("med-fin",   ROLE_MEDECIN);
        secEmail   = seedUser("sec-fin",   ROLE_SECRETAIRE);
    }

    // ── Test 1: ADMIN can create an expense (201) ─────────────────────────────

    @Test
    @DisplayName("1. POST /api/expenses as ADMIN → 201 with body")
    void createExpense_asAdmin_returns201() throws Exception {
        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("LOYER", "Loyer janvier 2026", "5000.00",
                                "2026-01-01", "MENSUELLE", "Propriétaire Dupont", null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.category").value("LOYER"))
                .andExpect(jsonPath("$.label").value("Loyer janvier 2026"))
                .andExpect(jsonPath("$.amount").value(5000.00))
                .andExpect(jsonPath("$.periodicity").value("MENSUELLE"))
                .andExpect(jsonPath("$.supplier").value("Propriétaire Dupont"));
    }

    // ── Test 2: SECRETAIRE cannot create (403) ────────────────────────────────

    @Test
    @DisplayName("2. POST /api/expenses as SECRETAIRE → 403")
    void createExpense_asSecretaire_returns403() throws Exception {
        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("INTERNET", "Facture Maroc Telecom", "300.00",
                                "2026-01-05", "MENSUELLE", null, null)))
                .andExpect(status().isForbidden());
    }

    // ── Test 3: GET /api/expenses lists created expense ───────────────────────

    @Test
    @DisplayName("3. GET /api/expenses returns the created expense")
    void listExpenses_includesCreated() throws Exception {
        // Create
        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("EAU_ELECTRICITE", "Facture ONEE mars", "420.50",
                                "2026-03-15", "PONCTUELLE", "ONEE", "Relevé 12345")))
                .andExpect(status().isCreated());

        // List
        MvcResult result = mockMvc.perform(get("/api/expenses")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();
        assertThat(body.size()).isGreaterThanOrEqualTo(1);

        boolean found = false;
        for (JsonNode node : body) {
            if ("Facture ONEE mars".equals(node.get("label").asText())) {
                found = true;
                assertThat(node.get("category").asText()).isEqualTo("EAU_ELECTRICITE");
                assertThat(node.get("amount").asDouble()).isEqualTo(420.50);
            }
        }
        assertThat(found).as("Created expense found in list").isTrue();
    }

    // ── Test 4: category filter ───────────────────────────────────────────────

    @Test
    @DisplayName("4. GET /api/expenses?category=LOYER returns only LOYER entries")
    void listExpenses_filterByCategory() throws Exception {
        // Create two expenses with different categories
        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("LOYER", "Loyer bureau", "8000.00",
                                "2026-02-01", "MENSUELLE", null, null)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("INTERNET", "IAM Fibre", "400.00",
                                "2026-02-01", "MENSUELLE", "IAM", null)))
                .andExpect(status().isCreated());

        // Filter by LOYER
        MvcResult result = mockMvc.perform(get("/api/expenses")
                        .param("category", "LOYER")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();
        for (JsonNode node : body) {
            assertThat(node.get("category").asText()).isEqualTo("LOYER");
        }
        assertThat(body.size()).isGreaterThanOrEqualTo(1);
    }

    // ── Test 5: PUT updates the expense ──────────────────────────────────────

    @Test
    @DisplayName("5. PUT /api/expenses/{id} → 200 + persisted changes")
    void updateExpense_persistsChanges() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("SYNDIC", "Syndic Q1", "1500.00",
                                "2026-01-01", "MENSUELLE", "Syndic Dupont", null)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Update amount and label
        mockMvc.perform(put("/api/expenses/" + id)
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("SYNDIC", "Syndic Q1 corrigé", "1600.00",
                                "2026-01-01", "MENSUELLE", "Syndic Dupont", "Correction montant")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Syndic Q1 corrigé"))
                .andExpect(jsonPath("$.amount").value(1600.00))
                .andExpect(jsonPath("$.notes").value("Correction montant"));

        // Verify persisted in DB
        BigDecimalRef amountInDb = new BigDecimalRef();
        String labelInDb = jdbc.queryForObject(
                "SELECT label FROM finance_expense WHERE id = ?::uuid", String.class, id);
        assertThat(labelInDb).isEqualTo("Syndic Q1 corrigé");
    }

    // ── Test 6: DELETE soft-deletes, excluded from list ───────────────────────

    @Test
    @DisplayName("6. DELETE /api/expenses/{id} → 204 + excluded from subsequent GET")
    void deleteExpense_softDeletes_excludedFromList() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("REPARATION", "Réparation clim", "2200.00",
                                "2026-04-10", "PONCTUELLE", null, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Delete → 204
        mockMvc.perform(delete("/api/expenses/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // Verify deleted_at is set in DB
        String deletedAt = jdbc.queryForObject(
                "SELECT deleted_at::TEXT FROM finance_expense WHERE id = ?::uuid",
                String.class, id);
        assertThat(deletedAt).isNotNull();

        // Expense should not appear in list
        MvcResult list = mockMvc.perform(get("/api/expenses")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        for (JsonNode node : body) {
            assertThat(node.get("id").asText()).isNotEqualTo(id);
        }
    }

    // ── Test 7: summary returns monthly totals ────────────────────────────────

    @Test
    @DisplayName("7. GET /api/expenses/summary?year=2026 returns correct monthly totals")
    void summary_returnsMonthlyTotals() throws Exception {
        // Create two expenses in January 2026 (500 + 300 = 800) and one in February (1000)
        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("LOYER", "Loyer janvier", "500.00",
                                "2026-01-05", "MENSUELLE", null, null)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("INTERNET", "Internet janvier", "300.00",
                                "2026-01-20", "MENSUELLE", null, null)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("LOYER", "Loyer février", "1000.00",
                                "2026-02-05", "MENSUELLE", null, null)))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/expenses/summary")
                        .param("year", "2026")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();

        // Find January entry
        boolean foundJan = false, foundFeb = false;
        for (JsonNode node : body) {
            int month = node.get("month").asInt();
            double total = node.get("total").asDouble();
            if (month == 1) {
                foundJan = true;
                assertThat(total).isEqualTo(800.00);
            }
            if (month == 2) {
                foundFeb = true;
                assertThat(total).isEqualTo(1000.00);
            }
        }
        assertThat(foundJan).as("January total found in summary").isTrue();
        assertThat(foundFeb).as("February total found in summary").isTrue();
    }

    // ── Test 8: invalid category → 400 ───────────────────────────────────────

    @Test
    @DisplayName("8. POST with invalid category → 400 Bad Request")
    void createExpense_invalidCategory_returns400() throws Exception {
        mockMvc.perform(post("/api/expenses")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expenseJson("INVALID_CAT", "Test", "100.00",
                                "2026-01-01", "PONCTUELLE", null, null)))
                .andExpect(status().isBadRequest());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String seedUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(PWD),
                prefix, "Test",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
        return "Bearer " + token;
    }

    private String expenseJson(String category, String label, String amount,
                               String date, String periodicity, String supplier, String notes) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"category\":\"").append(category).append("\"");
        sb.append(",\"label\":\"").append(label).append("\"");
        sb.append(",\"amount\":").append(amount);
        sb.append(",\"expenseDate\":\"").append(date).append("\"");
        if (periodicity != null) sb.append(",\"periodicity\":\"").append(periodicity).append("\"");
        if (supplier != null) sb.append(",\"supplier\":\"").append(supplier).append("\"");
        if (notes != null) sb.append(",\"notes\":\"").append(notes).append("\"");
        sb.append("}");
        return sb.toString();
    }

    /** Thin holder used for BigDecimal DB assertion without JUnit 5 lambda capture issues. */
    static class BigDecimalRef {
        java.math.BigDecimal value;
    }
}
