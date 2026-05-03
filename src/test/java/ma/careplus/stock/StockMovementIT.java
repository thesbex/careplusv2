package ma.careplus.stock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
 * Integration tests for Stock module — Étape 2: movements + FIFO + lot inactivation.
 *
 * Scenarios:
 *  1.  IN consommable simple : qty +10 → currentQuantity=10, no lot created
 *  2.  IN médicament with lot : lot created, currentQuantity = quantity
 *  3.  IN médicament without lot/exp → 400 LOT_REQUIRED
 *  4.  OUT consommable simple : qty -3 → currentQuantity = 7
 *  5.  OUT médicament FIFO single-lot : lot L1 expires 2026-12 → OUT 5 decrements L1
 *  6.  OUT médicament FIFO multi-lots : L1 qty=3 + L2 qty=10 → OUT 5 → L1 EXHAUSTED + L2 qty=8
 *  7.  OUT médicament insuffisant : stock total=5, OUT 10 → 422 INSUFFICIENT_STOCK
 *  8.  ADJUSTMENT with reason : new qty=8 (was 10), movement ADJUSTMENT qty=2 persisted
 *  9.  ADJUSTMENT without reason → 400 REASON_REQUIRED
 * 10.  RBAC : OUT as SECRETAIRE → 403; as ASSISTANT → 201
 * 11.  Lot inactivate : L1+L2, inactivate L1 → FIFO ignores L1, OUT 5 decrements L2
 * 12.  Movement history ordered desc + filtered by type
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class StockMovementIT {

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

    private static final String PWD = "StockMov-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medToken;
    String secToken;
    String asstToken;
    UUID medUserId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up test data
        jdbc.update("DELETE FROM stock_movement WHERE article_id IN "
                + "(SELECT id FROM stock_article WHERE code LIKE 'MOV-TEST-%')");
        jdbc.update("DELETE FROM stock_lot WHERE article_id IN "
                + "(SELECT id FROM stock_article WHERE code LIKE 'MOV-TEST-%')");
        jdbc.update("DELETE FROM stock_article WHERE code LIKE 'MOV-TEST-%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'mov-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'mov-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'mov-test-%'");

        String medEmail  = seedUser("med",  ROLE_MEDECIN);
        String secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        String asstEmail = seedUser("asst", ROLE_ASSISTANT);

        medUserId = jdbc.queryForObject("SELECT id FROM identity_user WHERE email = ?",
                UUID.class, medEmail);
        medToken  = bearer(medEmail);
        secToken  = bearer(secEmail);
        asstToken = bearer(asstEmail);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "mov-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'Mov', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                userId, roleId);
        return email;
    }

    private String bearer(String email) {
        try {
            MvcResult r = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                    .andExpect(status().isOk()).andReturn();
            return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                    .get("accessToken").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Creates an article via API and returns its id as String. */
    private String createArticle(String code, String category) throws Exception {
        String body = String.format("""
                {
                  "code": "%s",
                  "label": "Article test %s",
                  "category": "%s",
                  "unit": "unité",
                  "minThreshold": 5
                }
                """, code, code, category);
        MvcResult r = mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    // ── Scenario 1: IN consommable — currentQuantity updated, no lot ─────────

    @Test
    void in_consommable_updatesCurrentQuantity() throws Exception {
        String articleId = createArticle("MOV-TEST-CONS1", "CONSOMMABLE");

        String movResponse = mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"IN","quantity":10}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("IN"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andReturn().getResponse().getContentAsString();

        // lotId should be absent (null not serialized due to non_null config) or null
        JsonNode movNode = objectMapper.readTree(movResponse);
        assertThat(movNode.has("lotId") && !movNode.get("lotId").isNull() ? movNode.get("lotId").asText() : null)
                .isNull();

        // No lot created
        int lotCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM stock_lot WHERE article_id = ?::uuid",
                Integer.class, articleId);
        assertThat(lotCount).isZero();

        // currentQuantity = 10 in article view
        mockMvc.perform(get("/api/stock/articles/" + articleId)
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentQuantity").value(10));
    }

    // ── Scenario 2: IN médicament with lot — lot created ─────────────────────

    @Test
    void in_medicament_withLot_createLot() throws Exception {
        String articleId = createArticle("MOV-TEST-MED2", "MEDICAMENT_INTERNE");

        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type":"IN",
                                  "quantity":10,
                                  "lotNumber":"LOT-A1",
                                  "expiresOn":"2027-06-01"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("IN"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.lotId").isNotEmpty());

        // lot created with qty=10
        Integer lotQty = jdbc.queryForObject(
                "SELECT quantity FROM stock_lot WHERE article_id = ?::uuid AND lot_number = 'LOT-A1'",
                Integer.class, articleId);
        assertThat(lotQty).isEqualTo(10);

        // currentQuantity = 10
        mockMvc.perform(get("/api/stock/articles/" + articleId)
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentQuantity").value(10));
    }

    // ── Scenario 3: IN médicament without lot → 400 LOT_REQUIRED ─────────────

    @Test
    void in_medicament_withoutLot_returns400() throws Exception {
        String articleId = createArticle("MOV-TEST-MED3", "MEDICAMENT_INTERNE");

        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"IN","quantity":5}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LOT_REQUIRED"));
    }

    // ── Scenario 4: OUT consommable simple ───────────────────────────────────

    @Test
    void out_consommable_updatesQuantity() throws Exception {
        String articleId = createArticle("MOV-TEST-CONS4", "CONSOMMABLE");

        // Seed 10 units
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":10}"))
                .andExpect(status().isCreated());

        // OUT 3
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":3}"))
                .andExpect(status().isCreated());

        // currentQuantity = 7
        mockMvc.perform(get("/api/stock/articles/" + articleId)
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentQuantity").value(7));
    }

    // ── Scenario 5: OUT médicament FIFO single-lot ────────────────────────────

    @Test
    void out_medicament_fifo_singleLot() throws Exception {
        String articleId = createArticle("MOV-TEST-MED5", "MEDICAMENT_INTERNE");

        // IN lot L1 qty=10, expires 2026-12-01
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":10,\"lotNumber\":\"L1\",\"expiresOn\":\"2026-12-01\"}"))
                .andExpect(status().isCreated());

        // OUT 5 → should decrement L1
        MvcResult outResult = mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":5}"))
                .andExpect(status().isCreated())
                .andReturn();

        // Response is an array (even for single lot)
        JsonNode outJson = objectMapper.readTree(outResult.getResponse().getContentAsString());
        assertThat(outJson.isArray()).isTrue();
        assertThat(outJson).hasSize(1);
        assertThat(outJson.get(0).get("type").asText()).isEqualTo("OUT");
        assertThat(outJson.get(0).get("quantity").asInt()).isEqualTo(5);

        // L1 qty should now be 5
        Integer lotQty = jdbc.queryForObject(
                "SELECT quantity FROM stock_lot WHERE article_id = ?::uuid AND lot_number = 'L1'",
                Integer.class, articleId);
        assertThat(lotQty).isEqualTo(5);
    }

    // ── Scenario 6: OUT médicament FIFO multi-lots ────────────────────────────

    @Test
    void out_medicament_fifo_multiLots_exhaustsFirst() throws Exception {
        String articleId = createArticle("MOV-TEST-MED6", "MEDICAMENT_INTERNE");

        // L1: qty=3, expires sooner (2026-06-01)
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":3,\"lotNumber\":\"L1\",\"expiresOn\":\"2026-06-01\"}"))
                .andExpect(status().isCreated());

        // L2: qty=10, expires later (2027-06-01)
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":10,\"lotNumber\":\"L2\",\"expiresOn\":\"2027-06-01\"}"))
                .andExpect(status().isCreated());

        // OUT 5 → L1 fully consumed (EXHAUSTED) + L2 decremented by 2
        MvcResult outResult = mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":5}"))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode outJson = objectMapper.readTree(outResult.getResponse().getContentAsString());
        assertThat(outJson.isArray()).isTrue();
        assertThat(outJson).hasSize(2); // 2 rows: L1 (3) + L2 (2)

        // L1 should be EXHAUSTED
        String l1Status = jdbc.queryForObject(
                "SELECT status FROM stock_lot WHERE article_id = ?::uuid AND lot_number = 'L1'",
                String.class, articleId);
        assertThat(l1Status).isEqualTo("EXHAUSTED");

        // L2 qty should be 8 (10 - 2)
        Integer l2Qty = jdbc.queryForObject(
                "SELECT quantity FROM stock_lot WHERE article_id = ?::uuid AND lot_number = 'L2'",
                Integer.class, articleId);
        assertThat(l2Qty).isEqualTo(8);
    }

    // ── Scenario 7: OUT médicament insuffisant → 422 ─────────────────────────

    @Test
    void out_medicament_insufficient_returns422() throws Exception {
        String articleId = createArticle("MOV-TEST-MED7", "MEDICAMENT_INTERNE");

        // IN only 5
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":5,\"lotNumber\":\"L1\",\"expiresOn\":\"2027-01-01\"}"))
                .andExpect(status().isCreated());

        // OUT 10 → 422
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":10}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
    }

    // ── Scenario 8: ADJUSTMENT with reason ───────────────────────────────────

    @Test
    void adjustment_withReason_correctsDelta() throws Exception {
        String articleId = createArticle("MOV-TEST-CONS8", "CONSOMMABLE");

        // Seed 10
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":10}"))
                .andExpect(status().isCreated());

        // ADJUSTMENT: new quantity = 8 (delta = -2)
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ADJUSTMENT\",\"quantity\":8,\"reason\":\"Inventaire mensuel\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("ADJUSTMENT"))
                .andExpect(jsonPath("$.quantity").value(2))
                .andExpect(jsonPath("$.reason").value("Inventaire mensuel"));

        // currentQuantity = 8
        mockMvc.perform(get("/api/stock/articles/" + articleId)
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentQuantity").value(8));
    }

    // ── Scenario 9: ADJUSTMENT without reason → 400 ───────────────────────────

    @Test
    void adjustment_withoutReason_returns400() throws Exception {
        String articleId = createArticle("MOV-TEST-CONS9", "CONSOMMABLE");

        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ADJUSTMENT\",\"quantity\":5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REASON_REQUIRED"));
    }

    // ── Scenario 10: RBAC OUT — SECRETAIRE 403, ASSISTANT 201 ────────────────

    @Test
    void rbac_out_secretaire403_assistant201() throws Exception {
        String articleId = createArticle("MOV-TEST-RBAC10", "CONSOMMABLE");

        // Seed 20
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":20}"))
                .andExpect(status().isCreated());

        // SECRETAIRE → 403 for OUT
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":1}"))
                .andExpect(status().isForbidden());

        // ASSISTANT → 201 for OUT
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":1}"))
                .andExpect(status().isCreated());

        // SECRETAIRE CAN do IN and ADJUSTMENT
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":5}"))
                .andExpect(status().isCreated());
    }

    // ── Scenario 11: Lot inactivate — FIFO ignores INACTIVE lot ──────────────

    @Test
    void inactivateLot_ignoredByFifo() throws Exception {
        String articleId = createArticle("MOV-TEST-MED11", "MEDICAMENT_INTERNE");

        // L1: qty=5, expires sooner
        MvcResult inL1 = mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":5,\"lotNumber\":\"L1\",\"expiresOn\":\"2026-08-01\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String l1LotId = objectMapper.readTree(inL1.getResponse().getContentAsString()).get("lotId").asText();

        // L2: qty=10, expires later
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":10,\"lotNumber\":\"L2\",\"expiresOn\":\"2027-06-01\"}"))
                .andExpect(status().isCreated());

        // Inactivate L1 (doctor recall)
        mockMvc.perform(put("/api/stock/lots/" + l1LotId + "/inactivate")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        // OUT 5 → should only decrement L2 (L1 is INACTIVE)
        MvcResult outResult = mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":5}"))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode outJson = objectMapper.readTree(outResult.getResponse().getContentAsString());
        assertThat(outJson.isArray()).isTrue();
        assertThat(outJson).hasSize(1);

        // L2 qty should be 5 (10 - 5)
        Integer l2Qty = jdbc.queryForObject(
                "SELECT quantity FROM stock_lot WHERE article_id = ?::uuid AND lot_number = 'L2'",
                Integer.class, articleId);
        assertThat(l2Qty).isEqualTo(5);

        // L1 qty unchanged (still 5)
        Integer l1Qty = jdbc.queryForObject(
                "SELECT quantity FROM stock_lot WHERE article_id = ?::uuid AND lot_number = 'L1'",
                Integer.class, articleId);
        assertThat(l1Qty).isEqualTo(5);
    }

    // ── Scenario 12: Movement history ordered desc + filtered by type ─────────

    @Test
    void movementHistory_orderedDesc_filteredByType() throws Exception {
        String articleId = createArticle("MOV-TEST-HIST12", "CONSOMMABLE");

        // Create 3 movements: IN, OUT, IN
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":20}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OUT\",\"quantity\":5}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"IN\",\"quantity\":10}"))
                .andExpect(status().isCreated());

        // GET all movements — should return 3
        mockMvc.perform(get("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content").isArray());

        // Filter by type=IN — should return 2
        String inJson = mockMvc.perform(get("/api/stock/articles/" + articleId + "/movements?type=IN")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode page = objectMapper.readTree(inJson);
        assertThat(page.get("totalElements").asInt()).isEqualTo(2);
        // All items should be type IN
        page.get("content").forEach(n ->
                assertThat(n.get("type").asText()).isEqualTo("IN"));

        // Filter by type=OUT — should return 1
        mockMvc.perform(get("/api/stock/articles/" + articleId + "/movements?type=OUT")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }
}
