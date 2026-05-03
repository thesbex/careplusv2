package ma.careplus.stock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Integration tests for Stock module — Étape 1: schema + articles + suppliers.
 *
 * Scenarios:
 * 1.  Migration — 4 tables exist (stock_supplier, stock_article, stock_lot, stock_movement)
 * 2.  Create CONSOMMABLE article → 201, tracks_lots = false
 * 3.  Create MEDICAMENT_INTERNE article → 201, tracks_lots = true (GENERATED column)
 * 4.  CRUD suppliers happy path (POST/GET/PUT/DELETE)
 * 5.  RBAC — POST article as SECRETAIRE → 403; as ASSISTANT → 403; as MEDECIN → 201
 * 6.  Code uniqueness → POST 2× same active code → 409 CODE_DUPLICATE
 * 7.  PUT category after movement → 422 CATEGORY_LOCKED
 * 8.  Soft-delete article (active=false) — row remains, filtered out by default
 * 9.  List articles with category filter
 * 10. Supplier deactivate (soft-delete) — GET with includeInactive shows it
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class StockCatalogIT {

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

    private static final String PWD = "StockTest-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    String asstEmail;
    String adminEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up test data
        jdbc.update("DELETE FROM stock_movement WHERE article_id IN "
                + "(SELECT id FROM stock_article WHERE code LIKE 'ST-TEST-%')");
        jdbc.update("DELETE FROM stock_lot WHERE article_id IN "
                + "(SELECT id FROM stock_article WHERE code LIKE 'ST-TEST-%')");
        jdbc.update("DELETE FROM stock_article WHERE code LIKE 'ST-TEST-%'");
        jdbc.update("DELETE FROM stock_supplier WHERE name LIKE 'Test-Supplier-%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'stock-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'stock-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'stock-test-%'");

        medEmail   = seedUser("med",   ROLE_MEDECIN);
        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        asstEmail  = seedUser("asst",  ROLE_ASSISTANT);
        adminEmail = seedUser("admin", ROLE_ADMIN);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "stock-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'Stock', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                userId, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Scenario 1: Migration — 4 tables exist ───────────────────────────────

    @Test
    void migration_fourTablesExist() {
        for (String table : new String[]{"stock_supplier", "stock_article", "stock_lot", "stock_movement"}) {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    + "WHERE table_schema='public' AND table_name=?",
                    Integer.class, table);
            assertThat(count).as("table %s should exist", table).isEqualTo(1);
        }
    }

    // ── Scenario 2: Create CONSOMMABLE → tracks_lots = false ─────────────────

    @Test
    void createConsommable_tracksLotsIsFalse() throws Exception {
        String token = bearer(medEmail);
        String body = """
                {
                  "code": "ST-TEST-CONS",
                  "label": "Compresses 10x10",
                  "category": "CONSOMMABLE",
                  "unit": "boîte",
                  "minThreshold": 5
                }
                """;

        MvcResult result = mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("ST-TEST-CONS"))
                .andExpect(jsonPath("$.category").value("CONSOMMABLE"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();

        String id = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // Check tracks_lots via DB (generated column)
        Boolean tracksLots = jdbc.queryForObject(
                "SELECT tracks_lots FROM stock_article WHERE id = ?::uuid",
                Boolean.class, id);
        assertThat(tracksLots).isFalse();

        // Also verify via API response
        assertThat(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("tracksLots").asBoolean()).isFalse();
    }

    // ── Scenario 3: Create MEDICAMENT_INTERNE → tracks_lots = true ───────────

    @Test
    void createMedicamentInterne_tracksLotsIsTrue() throws Exception {
        String token = bearer(medEmail);
        String body = """
                {
                  "code": "ST-TEST-MED",
                  "label": "Bétadine 125ml",
                  "category": "MEDICAMENT_INTERNE",
                  "unit": "flacon",
                  "minThreshold": 2
                }
                """;

        MvcResult result = mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("MEDICAMENT_INTERNE"))
                .andReturn();

        String id = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // Check tracks_lots via DB
        Boolean tracksLots = jdbc.queryForObject(
                "SELECT tracks_lots FROM stock_article WHERE id = ?::uuid",
                Boolean.class, id);
        assertThat(tracksLots).isTrue();

        // Verify via API response
        assertThat(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("tracksLots").asBoolean()).isTrue();
    }

    // ── Scenario 4: CRUD suppliers ────────────────────────────────────────────

    @Test
    void suppliers_crudHappyPath() throws Exception {
        String token = bearer(medEmail);

        // POST — create supplier
        String createBody = """
                {
                  "name": "Test-Supplier-Pharma",
                  "phone": "0522-123456"
                }
                """;

        MvcResult createResult = mockMvc.perform(post("/api/stock/suppliers")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Test-Supplier-Pharma"))
                .andExpect(jsonPath("$.phone").value("0522-123456"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();

        String supplierId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        // GET by id
        mockMvc.perform(get("/api/stock/suppliers/" + supplierId)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test-Supplier-Pharma"));

        // GET list — supplier appears
        mockMvc.perform(get("/api/stock/suppliers")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + supplierId + "')]").exists());

        // PUT — update phone
        String updateBody = """
                {
                  "name": "Test-Supplier-Pharma",
                  "phone": "0522-999999"
                }
                """;
        mockMvc.perform(put("/api/stock/suppliers/" + supplierId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("0522-999999"));

        // DELETE (soft: active=false)
        mockMvc.perform(delete("/api/stock/suppliers/" + supplierId)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        Boolean active = jdbc.queryForObject(
                "SELECT active FROM stock_supplier WHERE id = ?::uuid",
                Boolean.class, supplierId);
        assertThat(active).isFalse();
    }

    // ── Scenario 5: RBAC — mutations ─────────────────────────────────────────

    @Test
    void rbac_articleMutations() throws Exception {
        String secToken   = bearer(secEmail);
        String asstToken  = bearer(asstEmail);
        String medToken   = bearer(medEmail);

        String body = """
                {
                  "code": "ST-TEST-RBAC",
                  "label": "Article test RBAC",
                  "category": "CONSOMMABLE",
                  "unit": "unité",
                  "minThreshold": 0
                }
                """;

        // SECRETAIRE → 403
        mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        // ASSISTANT → 403
        mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        // MEDECIN → 201
        mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        // GET is allowed for all roles
        mockMvc.perform(get("/api/stock/articles")
                        .header("Authorization", secToken))
                .andExpect(status().isOk());
    }

    // ── Scenario 6: Code duplicate → 409 CODE_DUPLICATE ──────────────────────

    @Test
    void createArticle_duplicateCode_returns409() throws Exception {
        String token = bearer(medEmail);
        String body = """
                {
                  "code": "ST-TEST-DUPL",
                  "label": "Article duplicate test",
                  "category": "CONSOMMABLE",
                  "unit": "unité",
                  "minThreshold": 0
                }
                """;

        // First insert — success
        mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        // Second insert — same code → 409
        mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CODE_DUPLICATE"));
    }

    // ── Scenario 7: PUT category after movement → 422 CATEGORY_LOCKED ────────

    @Test
    void updateArticle_categoryChangeAfterMovement_returns422() throws Exception {
        String token = bearer(medEmail);

        // Create article
        String createBody = """
                {
                  "code": "ST-TEST-CATLOCK",
                  "label": "Article category lock test",
                  "category": "CONSOMMABLE",
                  "unit": "unité",
                  "minThreshold": 0
                }
                """;
        MvcResult createResult = mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andReturn();

        String articleId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        // Inject a movement directly via JDBC (bypass Étape 2 service)
        UUID movId = UUID.randomUUID();
        UUID userId = jdbc.queryForObject(
                "SELECT id FROM identity_user WHERE email = ?",
                UUID.class, medEmail);
        jdbc.update("""
                INSERT INTO stock_movement (id, article_id, type, quantity, performed_by, performed_at, created_at)
                VALUES (?::uuid, ?::uuid, 'IN', 1, ?::uuid, now(), now())
                """, movId, articleId, userId);

        // Try to update category → 422 CATEGORY_LOCKED
        String updateBody = """
                {
                  "code": "ST-TEST-CATLOCK",
                  "label": "Article category lock test",
                  "category": "DOSSIER_PHYSIQUE",
                  "unit": "unité",
                  "minThreshold": 0
                }
                """;
        mockMvc.perform(put("/api/stock/articles/" + articleId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("CATEGORY_LOCKED"));
    }

    // ── Scenario 8: Soft-delete article — filtered by default ────────────────

    @Test
    void softDeleteArticle_filteredFromDefaultList() throws Exception {
        String token = bearer(medEmail);

        // Create article
        String createBody = """
                {
                  "code": "ST-TEST-SOFTDEL",
                  "label": "Article soft delete test",
                  "category": "CONSOMMABLE",
                  "unit": "unité",
                  "minThreshold": 0
                }
                """;
        MvcResult createResult = mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andReturn();

        String articleId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        // Soft-delete
        mockMvc.perform(delete("/api/stock/articles/" + articleId)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        // Row still in DB with active=false
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM stock_article WHERE id = ?::uuid",
                Boolean.class, articleId);
        assertThat(active).isFalse();

        // Default list doesn't include it
        String listJson = mockMvc.perform(get("/api/stock/articles")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(listJson).doesNotContain("ST-TEST-SOFTDEL");

        // includeInactive=true does include it
        String listWithInactiveJson = mockMvc.perform(get("/api/stock/articles?includeInactive=true")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(listWithInactiveJson).contains("ST-TEST-SOFTDEL");
    }

    // ── Scenario 9: List articles with category filter ────────────────────────

    @Test
    void listArticles_categoryFilter() throws Exception {
        String token = bearer(medEmail);

        // Create two articles with different categories
        for (String[] args : new String[][]{
                {"ST-TEST-FILTER-CONS", "CONSOMMABLE"},
                {"ST-TEST-FILTER-MED",  "MEDICAMENT_INTERNE"}
        }) {
            mockMvc.perform(post("/api/stock/articles")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("""
                                    {
                                      "code": "%s",
                                      "label": "Article filter test %s",
                                      "category": "%s",
                                      "unit": "unité",
                                      "minThreshold": 0
                                    }
                                    """, args[0], args[0], args[1])))
                    .andExpect(status().isCreated());
        }

        // Filter by CONSOMMABLE
        String consJson = mockMvc.perform(get("/api/stock/articles?category=CONSOMMABLE")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(consJson).contains("ST-TEST-FILTER-CONS");
        assertThat(consJson).doesNotContain("ST-TEST-FILTER-MED");

        // Filter by MEDICAMENT_INTERNE
        String medJson = mockMvc.perform(get("/api/stock/articles?category=MEDICAMENT_INTERNE")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(medJson).contains("ST-TEST-FILTER-MED");
        assertThat(medJson).doesNotContain("ST-TEST-FILTER-CONS");
    }

    // ── Scenario 10: Supplier deactivate — visible with includeInactive ───────

    @Test
    void deactivateSupplier_visibleWithIncludeInactive() throws Exception {
        String token = bearer(medEmail);

        // Create and deactivate supplier
        String createBody = """
                {
                  "name": "Test-Supplier-Deactivate",
                  "phone": "0600-000000"
                }
                """;
        MvcResult createResult = mockMvc.perform(post("/api/stock/suppliers")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andReturn();

        String supplierId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(delete("/api/stock/suppliers/" + supplierId)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        // Default list (active only) does NOT include it
        String activeJson = mockMvc.perform(get("/api/stock/suppliers")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(activeJson).doesNotContain("Test-Supplier-Deactivate");

        // includeInactive=true DOES include it
        String allJson = mockMvc.perform(get("/api/stock/suppliers?includeInactive=true")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(allJson).contains("Test-Supplier-Deactivate");
    }
}
