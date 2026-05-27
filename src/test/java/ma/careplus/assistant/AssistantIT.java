package ma.careplus.assistant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import ma.careplus.assistant.application.AiChatClient;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
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
 * Integration tests pour le module assistant IA (V064).
 *
 * <p>Le fournisseur IA réel ({@code OpenAiCompatibleChatClient}) est remplacé par
 * un stub déterministe ({@link StubAiConfig}) — aucun appel réseau. Le stub
 * marque la réponse {@code [CTX]} quand un contexte patient lui est transmis,
 * ce qui permet d'asserter l'injection du dossier.
 *
 * <p>Scénarios bottlés :
 * <ol>
 *   <li>/config → configured=true + provider/modèle du stub.</li>
 *   <li>ask sans conversationId → crée la conv, persiste USER+ASSISTANT.</li>
 *   <li>ask avec conversationId → poursuit le fil (4 messages).</li>
 *   <li>ask avec patientId → contexte dossier injecté ([CTX]) + patient_id persistant.</li>
 *   <li>list → mes conversations seulement (cloisonnement owner).</li>
 *   <li>get conversation → fil de messages, SYSTEM jamais exposé.</li>
 *   <li>delete → 204 puis 404.</li>
 *   <li>RBAC : SECRETAIRE → 403 sur /config et /ask.</li>
 *   <li>404 sur conversation inconnue.</li>
 *   <li>401 anonyme.</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
@Import(AssistantIT.StubAiConfig.class)
class AssistantIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Assistant-IT-2026!";

    /** Stub déterministe : pas de réseau. Marque [CTX] si un contexte patient est reçu. */
    @TestConfiguration
    static class StubAiConfig {
        @Bean
        @Primary
        AiChatClient stubAiChatClient() {
            return new AiChatClient() {
                @Override
                public AiChatResult complete(List<AiMessage> messages) {
                    boolean hasContext = messages.stream()
                            .anyMatch(m -> "system".equals(m.role())
                                    && m.content().contains("Contexte du dossier patient"));
                    String last = messages.isEmpty() ? "" : messages.get(messages.size() - 1).content();
                    return new AiChatResult(
                            (hasContext ? "[CTX] " : "") + "Réponse à : " + last, 10, 20);
                }
                @Override public boolean isConfigured() { return true; }
                @Override public String provider() { return "stub-gemini"; }
                @Override public String model() { return "stub-model"; }
            };
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    UUID med2Id;
    UUID secId;
    UUID patientId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM assistant_message WHERE conversation_id IN "
                + "(SELECT id FROM assistant_conversation WHERE owner_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'assistant-it-%'))");
        jdbc.update("DELETE FROM assistant_conversation WHERE owner_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'assistant-it-%')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'AssistantITPatient'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'assistant-it-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'assistant-it-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'assistant-it-%'");

        medId = createUser("med", ROLE_MEDECIN);
        med2Id = createUser("med2", ROLE_MEDECIN);
        secId = createUser("sec", ROLE_SECRETAIRE);
        patientId = createPatient();
    }

    private UUID createUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = "assistant-it-" + prefix + "-" + id + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD), prefix, "Test");
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return id;
    }

    private UUID createPatient() {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    blood_group, status, version, created_at, updated_at)
                VALUES (?, 'AssistantITPatient', 'Karim', 'M', DATE '1980-06-15', 'O+',
                    'ACTIF', 0, now(), now())
                """, id);
        jdbc.update("""
                INSERT INTO patient_allergy (id, patient_id, substance, severity, created_at, updated_at)
                VALUES (?, ?, 'Pénicilline', 'SEVERE', now(), now())
                """, UUID.randomUUID(), id);
        return id;
    }

    private String bearer(UUID userId) throws Exception {
        String email = jdbc.queryForObject("SELECT email FROM identity_user WHERE id = ?",
                String.class, userId);
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(
                r.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .get("accessToken").asText();
    }

    private JsonNode ask(UUID user, String json) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/assistant/ask")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void config_reports_stub_provider() throws Exception {
        mockMvc.perform(get("/api/assistant/config").header("Authorization", bearer(medId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.provider").value("stub-gemini"))
                .andExpect(jsonPath("$.model").value("stub-model"));
    }

    @Test
    void ask_without_conversation_creates_and_persists_two_messages() throws Exception {
        JsonNode body = ask(medId, "{\"message\":\"Posologie amoxicilline adulte ?\"}");
        String convId = body.get("id").asText();
        assertThat(body.get("messages")).hasSize(2);
        assertThat(body.get("messages").get(0).get("role").asText()).isEqualTo("USER");
        assertThat(body.get("messages").get(1).get("role").asText()).isEqualTo("ASSISTANT");
        assertThat(body.get("messages").get(1).get("content").asText())
                .contains("Réponse à : Posologie amoxicilline adulte ?");

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM assistant_message WHERE conversation_id = ?::uuid",
                Integer.class, convId);
        assertThat(count).isEqualTo(2);
    }

    @Test
    void ask_with_conversation_continues_thread() throws Exception {
        JsonNode first = ask(medId, "{\"message\":\"Première question\"}");
        String convId = first.get("id").asText();
        JsonNode second = ask(medId, "{\"conversationId\":\"" + convId + "\",\"message\":\"Suite\"}");
        assertThat(second.get("id").asText()).isEqualTo(convId);
        assertThat(second.get("messages")).hasSize(4);
    }

    @Test
    void ask_with_patient_injects_context() throws Exception {
        JsonNode body = ask(medId,
                "{\"patientId\":\"" + patientId + "\",\"message\":\"Synthèse du dossier\"}");
        // Le stub préfixe [CTX] quand le contexte patient a bien été transmis.
        assertThat(body.get("messages").get(1).get("content").asText()).startsWith("[CTX]");
        assertThat(body.get("patientId").asText()).isEqualTo(patientId.toString());

        UUID storedPatient = jdbc.queryForObject(
                "SELECT patient_id FROM assistant_conversation WHERE id = ?::uuid",
                UUID.class, body.get("id").asText());
        assertThat(storedPatient).isEqualTo(patientId);
    }

    @Test
    void list_is_scoped_to_owner() throws Exception {
        ask(medId, "{\"message\":\"Ma conversation\"}");
        ask(med2Id, "{\"message\":\"Conversation d'un autre médecin\"}");

        MvcResult r = mockMvc.perform(get("/api/assistant/conversations")
                        .header("Authorization", bearer(medId)))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(arr).hasSize(1);
        assertThat(arr.get(0).get("title").asText()).isEqualTo("Ma conversation");
    }

    @Test
    void get_conversation_returns_thread() throws Exception {
        JsonNode body = ask(medId, "{\"message\":\"Question\"}");
        String convId = body.get("id").asText();
        mockMvc.perform(get("/api/assistant/conversations/" + convId)
                        .header("Authorization", bearer(medId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(2));
    }

    @Test
    void delete_removes_conversation() throws Exception {
        JsonNode body = ask(medId, "{\"message\":\"À supprimer\"}");
        String convId = body.get("id").asText();
        mockMvc.perform(delete("/api/assistant/conversations/" + convId)
                        .header("Authorization", bearer(medId)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/assistant/conversations/" + convId)
                        .header("Authorization", bearer(medId)))
                .andExpect(status().isNotFound());
    }

    @Test
    void secretaire_is_forbidden() throws Exception {
        mockMvc.perform(get("/api/assistant/config").header("Authorization", bearer(secId)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/assistant/ask")
                        .header("Authorization", bearer(secId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void unknown_conversation_is_404() throws Exception {
        mockMvc.perform(get("/api/assistant/conversations/" + UUID.randomUUID())
                        .header("Authorization", bearer(medId)))
                .andExpect(status().isNotFound());
    }

    @Test
    void anonymous_is_401() throws Exception {
        mockMvc.perform(get("/api/assistant/conversations"))
                .andExpect(status().isUnauthorized());
    }
}
