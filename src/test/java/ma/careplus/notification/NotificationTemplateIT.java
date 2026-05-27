package ma.careplus.notification;

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
 * IT du CRUD des modèles de notification (ADMIN) + préférences patient.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class NotificationTemplateIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test").withUsername("test").withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Notif-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String adminEmail;
    String medEmail;
    UUID patientId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");
        adminEmail = seedUser("notif-admin", ROLE_ADMIN);
        medEmail   = seedUser("notif-med", ROLE_MEDECIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, tier, version, number_children,
                     status, created_at, updated_at)
                VALUES (?, 'AMRANI', 'Hassan', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);
    }

    @Test
    @DisplayName("1. POST modèle ADMIN → 201 ; MEDECIN → 403")
    void createTemplate_rbac() throws Exception {
        mockMvc.perform(post("/api/notification-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tplJson("APPOINTMENT_CREATED", "EMAIL", "Confirmation",
                                "Bonjour {{patientPrenom}}, RDV le {{date}}.", true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.eventKey").value("APPOINTMENT_CREATED"))
                .andExpect(jsonPath("$.channel").value("EMAIL"));

        mockMvc.perform(post("/api/notification-templates")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tplJson("APPOINTMENT_REMINDER", "WHATSAPP", null, "Rappel demain.", true)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("2. POST canal invalide → 400")
    void createTemplate_invalidChannel() throws Exception {
        mockMvc.perform(post("/api/notification-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tplJson("APPOINTMENT_CREATED", "SMS", null, "x", true)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("3. PUT modèle → persiste ; DELETE → exclu de la liste")
    void updateAndDelete() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/notification-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tplJson("PRESCRIPTION_READY", "EMAIL", "Ordonnance", "Corps v1.", true)))
                .andExpect(status().isCreated()).andReturn();
        String id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(put("/api/notification-templates/" + id)
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tplJson("PRESCRIPTION_READY", "EMAIL", "Ordonnance", "Corps v2.", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(delete("/api/notification-templates/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        MvcResult list = mockMvc.perform(get("/api/notification-templates")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk()).andReturn();
        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        for (JsonNode n : body) {
            assertThat(n.get("id").asText()).isNotEqualTo(id);
        }
    }

    @Test
    @DisplayName("4. préférences patient : PUT puis GET round-trip")
    void patientPrefs_roundTrip() throws Exception {
        mockMvc.perform(put("/api/patients/" + patientId + "/notification-preferences")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"optIn\":true,\"channel\":\"WHATSAPP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.optIn").value(true))
                .andExpect(jsonPath("$.channel").value("WHATSAPP"));

        mockMvc.perform(get("/api/patients/" + patientId + "/notification-preferences")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.optIn").value(true))
                .andExpect(jsonPath("$.channel").value("WHATSAPP"));

        // Vérif persistance DB.
        Boolean optIn = jdbc.queryForObject(
                "SELECT notifications_opt_in FROM patient_patient WHERE id = ?", Boolean.class, patientId);
        assertThat(optIn).isTrue();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String seedUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Test', TRUE, 0, 0, ?, ?)
                """, id, email, passwordEncoder.encode(PWD), prefix, OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String tplJson(String eventKey, String channel, String subject, String body, boolean active) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"eventKey\":\"").append(eventKey).append("\",");
        sb.append("\"channel\":\"").append(channel).append("\",");
        if (subject != null) sb.append("\"subject\":\"").append(subject).append("\",");
        sb.append("\"body\":\"").append(body).append("\",");
        sb.append("\"active\":").append(active);
        sb.append("}");
        return sb.toString();
    }
}
