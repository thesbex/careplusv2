package ma.careplus.confrere;

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
 * Integration tests for the confrère letter template module.
 *
 * <p>Scenarios covered :
 * <ol>
 *   <li>POST /api/confrere-letter-templates as ADMIN → 201 + body</li>
 *   <li>POST /api/confrere-letter-templates as SECRETAIRE → 403</li>
 *   <li>GET  /api/confrere-letter-templates → list includes created template</li>
 *   <li>PUT  /api/confrere-letter-templates/{id} → 200 + updated fields persisted</li>
 *   <li>DELETE /api/confrere-letter-templates/{id} → 204 + excluded from subsequent GET</li>
 *   <li>MEDECIN sees only active templates; ADMIN sees all (active+inactive)</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ConfrereLetterTemplateIT {

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
    private static final String PWD = "Letter-Test-2026!";

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

        // Clean up template data first (FK order)
        jdbc.update("DELETE FROM confrere_letter_template");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = seedUser("admin-cl", ROLE_ADMIN);
        medEmail   = seedUser("med-cl",   ROLE_MEDECIN);
        secEmail   = seedUser("sec-cl",   ROLE_SECRETAIRE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Template CRUD
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("1. POST /api/confrere-letter-templates as ADMIN → 201 with body")
    void createTemplate_asAdmin_returns201() throws Exception {
        mockMvc.perform(post("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Adressage cardiologue",
                                "Cher confrère, je vous adresse mon patient pour avis cardiologique.",
                                true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.title").value("Adressage cardiologue"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    @DisplayName("2. POST /api/confrere-letter-templates as SECRETAIRE → 403")
    void createTemplate_asSecretaire_returns403() throws Exception {
        mockMvc.perform(post("/api/confrere-letter-templates")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Test", "Corps.", true)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("3. GET /api/confrere-letter-templates → list includes created template")
    void listTemplates_includesCreated() throws Exception {
        // Create
        mockMvc.perform(post("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Adressage radiologue",
                                "Cher confrère, merci de réaliser cet examen d'imagerie.",
                                true)))
                .andExpect(status().isCreated());

        // List as médecin
        MvcResult result = mockMvc.perform(get("/api/confrere-letter-templates")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();

        boolean found = false;
        for (JsonNode node : body) {
            if ("Adressage radiologue".equals(node.get("title").asText())) {
                found = true;
            }
        }
        assertThat(found).as("Template 'Adressage radiologue' found in list").isTrue();
    }

    @Test
    @DisplayName("4. PUT /api/confrere-letter-templates/{id} → 200 + persisted changes")
    void updateTemplate_persistsChanges() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Adressage néphrologue v1",
                                "Corps initial.",
                                true)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Update
        mockMvc.perform(put("/api/confrere-letter-templates/" + id)
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Adressage néphrologue v2",
                                "Corps mis à jour.",
                                true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Adressage néphrologue v2"));

        // Verify in DB
        String titleInDb = jdbc.queryForObject(
                "SELECT title FROM confrere_letter_template WHERE id = ?::uuid", String.class, id);
        assertThat(titleInDb).isEqualTo("Adressage néphrologue v2");
    }

    @Test
    @DisplayName("5. DELETE /api/confrere-letter-templates/{id} → 204 + soft-deleted")
    void deleteTemplate_softDeletes() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Adressage dermatologue", "Corps.", true)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Delete → 204
        mockMvc.perform(delete("/api/confrere-letter-templates/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // deleted_at must be set
        String deletedAt = jdbc.queryForObject(
                "SELECT deleted_at::TEXT FROM confrere_letter_template WHERE id = ?::uuid",
                String.class, id);
        assertThat(deletedAt).isNotNull();

        // Must not appear in list anymore
        MvcResult list = mockMvc.perform(get("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        for (JsonNode node : body) {
            assertThat(node.get("id").asText()).isNotEqualTo(id);
        }
    }

    @Test
    @DisplayName("11. MEDECIN sees active only; ADMIN sees all")
    void listVisibility_adminVsMedecin() throws Exception {
        // Create one active + one inactive template
        mockMvc.perform(post("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Courrier actif", "Corps.", true)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("Courrier inactif", "Corps.", false)))
                .andExpect(status().isCreated());

        // ADMIN sees both
        MvcResult adminList = mockMvc.perform(get("/api/confrere-letter-templates")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode adminBody = objectMapper.readTree(adminList.getResponse().getContentAsString());
        assertThat(adminBody.size()).isGreaterThanOrEqualTo(2);

        // MEDECIN sees only active
        MvcResult medList = mockMvc.perform(get("/api/confrere-letter-templates")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode medBody = objectMapper.readTree(medList.getResponse().getContentAsString());
        for (JsonNode node : medBody) {
            assertThat(node.get("active").asBoolean()).isTrue();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

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

    private String templateJson(String title, String body, boolean active) {
        return "{\"title\":\"" + escapeJson(title) + "\","
                + "\"body\":\"" + escapeJson(body) + "\","
                + "\"active\":" + active + "}";
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
