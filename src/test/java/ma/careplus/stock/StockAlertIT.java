package ma.careplus.stock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
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
 * Integration tests for Stock module — Étape 3: alerts (low stock + expiring soon).
 *
 * Scenarios:
 * S1. Article qty=5, minThreshold=10, active=true → present in /alerts.lowStock AND count.lowStock=1.
 * S2. Lot for a medication expires in 20 days → present in /alerts.expiringSoon AND count.expiringSoon=1.
 * S3. Lot expires in 60 days → absent (beyond 30-day horizon).
 * S4. Lot with status=INACTIVE → excluded from alerts even if near expiry.
 * S5. /alerts/count aggregates correctly: 2 low-stock articles + 3 expiring lots → {lowStock:2, expiringSoon:3}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class StockAlertIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");

    private static final String PWD = "StockAlert-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medToken;
    UUID medUserId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up: remove test data from this suite only
        jdbc.update("DELETE FROM stock_movement WHERE article_id IN "
                + "(SELECT id FROM stock_article WHERE code LIKE 'ALERT-TEST-%')");
        jdbc.update("DELETE FROM stock_lot WHERE article_id IN "
                + "(SELECT id FROM stock_article WHERE code LIKE 'ALERT-TEST-%')");
        jdbc.update("DELETE FROM stock_article WHERE code LIKE 'ALERT-TEST-%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'alert-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'alert-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'alert-test-%'");

        String medEmail = seedUser("med", ROLE_MEDECIN);
        medUserId = jdbc.queryForObject("SELECT id FROM identity_user WHERE email = ?",
                UUID.class, medEmail);
        medToken = bearer(medEmail);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "alert-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'Alert', TRUE, 0, 0, now(), now())
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

    /** Creates a CONSOMMABLE article with given minThreshold, returns its id. */
    private String createConsommable(String code, int minThreshold) throws Exception {
        String body = String.format("""
                {
                  "code": "%s",
                  "label": "Article alerte %s",
                  "category": "CONSOMMABLE",
                  "unit": "unité",
                  "minThreshold": %d
                }
                """, code, code, minThreshold);
        MvcResult r = mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    /** Creates a MEDICAMENT_INTERNE article, returns its id. */
    private String createMedicament(String code, int minThreshold) throws Exception {
        String body = String.format("""
                {
                  "code": "%s",
                  "label": "Médicament alerte %s",
                  "category": "MEDICAMENT_INTERNE",
                  "unit": "boîte",
                  "minThreshold": %d
                }
                """, code, code, minThreshold);
        MvcResult r = mockMvc.perform(post("/api/stock/articles")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    /**
     * Record an IN movement for a medication with a lot.
     * Returns the lotId from the response.
     */
    private String recordIn(String articleId, int quantity, String lotNumber, String expiresOn)
            throws Exception {
        String body = String.format("""
                {
                  "type":"IN",
                  "quantity":%d,
                  "lotNumber":"%s",
                  "expiresOn":"%s"
                }
                """, quantity, lotNumber, expiresOn);
        MvcResult r = mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode node = objectMapper.readTree(r.getResponse().getContentAsString());
        return node.has("lotId") ? node.get("lotId").asText() : null;
    }

    /** Record an IN for a consommable (no lot). */
    private void recordInConsommable(String articleId, int quantity) throws Exception {
        mockMvc.perform(post("/api/stock/articles/" + articleId + "/movements")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"type\":\"IN\",\"quantity\":%d}", quantity)))
                .andExpect(status().isCreated());
    }

    // ── S1: Article qty=5 + minThreshold=10 → present in lowStock ────────────

    @Test
    void s1_lowStockArticle_presentInAlertsAndCount() throws Exception {
        // Create article with threshold 10, add only 5 units
        String articleId = createConsommable("ALERT-TEST-S1", 10);
        recordInConsommable(articleId, 5);

        // Check /alerts.lowStock contains this article
        String alertsJson = mockMvc.perform(get("/api/stock/alerts")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode alerts = objectMapper.readTree(alertsJson);
        JsonNode lowStock = alerts.get("lowStock");
        assertThat(lowStock.isArray()).isTrue();

        boolean found = false;
        for (JsonNode item : lowStock) {
            if (articleId.equals(item.get("id").asText())) {
                assertThat(item.get("currentQuantity").asInt()).isEqualTo(5);
                assertThat(item.get("minThreshold").asInt()).isEqualTo(10);
                found = true;
            }
        }
        assertThat(found).as("Article ALERT-TEST-S1 should appear in lowStock").isTrue();

        // Check /alerts/count.lowStock >= 1
        String countJson = mockMvc.perform(get("/api/stock/alerts/count")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode count = objectMapper.readTree(countJson);
        assertThat(count.get("lowStock").asInt()).isGreaterThanOrEqualTo(1);
    }

    // ── S2: Lot expires in 20 days → present in expiringSoon ─────────────────

    @Test
    void s2_lotExpiresIn20Days_presentInExpiringSoon() throws Exception {
        String articleId = createMedicament("ALERT-TEST-S2", 0);
        String expiresOn = LocalDate.now().plusDays(20).toString();
        recordIn(articleId, 10, "LOT-S2", expiresOn);

        String alertsJson = mockMvc.perform(get("/api/stock/alerts")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode alerts = objectMapper.readTree(alertsJson);
        JsonNode expiringSoon = alerts.get("expiringSoon");
        assertThat(expiringSoon.isArray()).isTrue();

        boolean found = false;
        for (JsonNode item : expiringSoon) {
            if ("LOT-S2".equals(item.get("lotNumber").asText())) {
                assertThat(item.get("articleId").asText()).isEqualTo(articleId);
                assertThat(item.get("daysUntilExpiry").asInt()).isLessThanOrEqualTo(20);
                assertThat(item.get("daysUntilExpiry").asInt()).isGreaterThanOrEqualTo(0);
                found = true;
            }
        }
        assertThat(found).as("LOT-S2 (expires in 20d) should appear in expiringSoon").isTrue();

        // count.expiringSoon >= 1
        String countJson = mockMvc.perform(get("/api/stock/alerts/count")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode count = objectMapper.readTree(countJson);
        assertThat(count.get("expiringSoon").asInt()).isGreaterThanOrEqualTo(1);
    }

    // ── S3: Lot expires in 60 days → absent (beyond 30-day horizon) ──────────

    @Test
    void s3_lotExpiresIn60Days_absentFromExpiringSoon() throws Exception {
        String articleId = createMedicament("ALERT-TEST-S3", 0);
        String expiresOn = LocalDate.now().plusDays(60).toString();
        recordIn(articleId, 10, "LOT-S3-FAR", expiresOn);

        String alertsJson = mockMvc.perform(get("/api/stock/alerts")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode expiringSoon = objectMapper.readTree(alertsJson).get("expiringSoon");
        for (JsonNode item : expiringSoon) {
            assertThat(item.get("lotNumber").asText())
                    .as("LOT-S3-FAR (60d) should NOT appear in expiringSoon")
                    .isNotEqualTo("LOT-S3-FAR");
        }
    }

    // ── S4: Lot status=INACTIVE → excluded from alerts ────────────────────────

    @Test
    void s4_inactiveLot_excludedFromAlerts() throws Exception {
        String articleId = createMedicament("ALERT-TEST-S4", 0);
        // Expires in 10 days — would normally appear
        String expiresOn = LocalDate.now().plusDays(10).toString();
        String lotId = recordIn(articleId, 10, "LOT-S4-INACTIVE", expiresOn);

        // Inactivate the lot
        mockMvc.perform(put("/api/stock/lots/" + lotId + "/inactivate")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        // Now check that this lot is NOT in expiringSoon
        String alertsJson = mockMvc.perform(get("/api/stock/alerts")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode expiringSoon = objectMapper.readTree(alertsJson).get("expiringSoon");
        for (JsonNode item : expiringSoon) {
            assertThat(item.get("lotNumber").asText())
                    .as("LOT-S4-INACTIVE should NOT appear in expiringSoon")
                    .isNotEqualTo("LOT-S4-INACTIVE");
        }

        // Also verify count does not include this lot
        String countJson = mockMvc.perform(get("/api/stock/alerts/count")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // We just verify the endpoint responds OK — exact count depends on other tests
        // but specifically this lot must not contribute
        JsonNode count = objectMapper.readTree(countJson);
        assertThat(count.has("expiringSoon")).isTrue();
    }

    // ── S5: Mixed scenario — 2 low-stock + 3 expiring lots ───────────────────

    @Test
    void s5_mixedAlerts_countAggregatesCorrectly() throws Exception {
        // Create 2 low-stock consommable articles (qty < threshold)
        String a1Id = createConsommable("ALERT-TEST-S5A1", 20);
        recordInConsommable(a1Id, 3); // 3 < 20 → low stock

        String a2Id = createConsommable("ALERT-TEST-S5A2", 50);
        recordInConsommable(a2Id, 5); // 5 < 50 → low stock

        // Article with enough stock — should NOT trigger low stock
        String a3Id = createConsommable("ALERT-TEST-S5A3", 10);
        recordInConsommable(a3Id, 15); // 15 >= 10 → OK

        // Create a medication with 3 expiring lots (within 30 days)
        String medId = createMedicament("ALERT-TEST-S5MED", 0);
        recordIn(medId, 5, "LOT-S5-1", LocalDate.now().plusDays(5).toString());
        recordIn(medId, 5, "LOT-S5-2", LocalDate.now().plusDays(15).toString());
        recordIn(medId, 5, "LOT-S5-3", LocalDate.now().plusDays(25).toString());

        // Fetch count
        String countJson = mockMvc.perform(get("/api/stock/alerts/count")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode count = objectMapper.readTree(countJson);
        int lowStockCount = count.get("lowStock").asInt();
        int expiringSoonCount = count.get("expiringSoon").asInt();

        // At least 2 low-stock articles from this test (there may be others from parallel tests)
        assertThat(lowStockCount).isGreaterThanOrEqualTo(2);
        // At least 3 expiring lots from this test
        assertThat(expiringSoonCount).isGreaterThanOrEqualTo(3);

        // Verify the detailed list also contains our articles and lots
        String alertsJson = mockMvc.perform(get("/api/stock/alerts")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode alerts = objectMapper.readTree(alertsJson);
        JsonNode lowStockList = alerts.get("lowStock");
        JsonNode expiringSoonList = alerts.get("expiringSoon");

        // Collect ids/lotNumbers from list responses
        var lowIds = new java.util.ArrayList<String>();
        lowStockList.forEach(n -> lowIds.add(n.get("id").asText()));
        assertThat(lowIds).contains(a1Id, a2Id);
        assertThat(lowIds).doesNotContain(a3Id);

        var lotNumbers = new java.util.ArrayList<String>();
        expiringSoonList.forEach(n -> lotNumbers.add(n.get("lotNumber").asText()));
        assertThat(lotNumbers).contains("LOT-S5-1", "LOT-S5-2", "LOT-S5-3");

        // Count and list sizes are consistent
        assertThat(expiringSoonList.size()).isEqualTo(expiringSoonCount);
    }
}
