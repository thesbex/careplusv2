package ma.careplus.rooms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
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
 * CRUD integration tests for the clinic_room referential.
 *
 * Scenarios:
 *   R1  POST crée une salle → 201 + ID retourné.
 *   R2  GET /api/rooms retourne les salles actives ordonnées.
 *   R3  PUT modifie name + tags → 200, changements persistés.
 *   R4  DELETE soft-delete (active=false). GET sans includeInactive ne la retourne plus.
 *   R5  POST avec nom dupliqué d'une active → 409.
 *   R6  POST avec nom identique à une inactive → 201 (OK, pas de conflit).
 *   R7  Non-ADMIN POST → 403.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ClinicRoomCrudIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_rooms_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Rooms-IT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String adminEmail;
    String secEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM clinic_room");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // ADMIN user
        UUID adminId = UUID.randomUUID();
        adminEmail = "admin-rooms-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Admin', 'Test', TRUE, 0, 0, now(), now())
                """, adminId, adminEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                adminId, ROLE_ADMIN);

        // SECRETAIRE user (non-admin)
        UUID secId = UUID.randomUUID();
        secEmail = "sec-rooms-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Test', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private String createRoom(String name, List<String> tags) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("name", name);
        body.put("capabilityTags", tags);
        MvcResult r = mockMvc.perform(post("/api/rooms")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    @Test
    @DisplayName("R1. POST crée une salle → 201 + id retourné")
    void r1_createRoom() throws Exception {
        mockMvc.perform(post("/api/rooms")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Salle A",
                                "capabilityTags", List.of("ECG", "Pédiatrie")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Salle A"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.capabilityTags[0]").value("ECG"))
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    @Test
    @DisplayName("R2. GET /api/rooms retourne les salles actives ordonnées alphabétiquement")
    void r2_listActiveRooms() throws Exception {
        createRoom("Salle Z", List.of());
        createRoom("Salle A", List.of("Gynéco"));
        createRoom("Salle M", List.of());

        mockMvc.perform(get("/api/rooms")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].name").value("Salle A"))
                .andExpect(jsonPath("$[1].name").value("Salle M"))
                .andExpect(jsonPath("$[2].name").value("Salle Z"));
    }

    @Test
    @DisplayName("R3. PUT modifie name + tags → 200, changements persistés")
    void r3_updateRoom() throws Exception {
        String id = createRoom("Salle Initiale", List.of("ECG"));

        mockMvc.perform(put("/api/rooms/" + id)
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Salle Modifiée",
                                "capabilityTags", List.of("Radio", "Echo")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Salle Modifiée"))
                .andExpect(jsonPath("$.capabilityTags.length()").value(2));

        // Verify persistence in DB
        String dbName = jdbc.queryForObject(
                "SELECT name FROM clinic_room WHERE id = ?::uuid", String.class, id);
        assertThat(dbName).isEqualTo("Salle Modifiée");
    }

    @Test
    @DisplayName("R4. DELETE soft-delete (active=false) ; GET sans includeInactive ne la retourne plus")
    void r4_deactivateRoom() throws Exception {
        String id = createRoom("Salle Temp", List.of());

        // Verify it's listed before delete
        mockMvc.perform(get("/api/rooms")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // Soft delete
        mockMvc.perform(delete("/api/rooms/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // Verify it's no longer in active listing
        mockMvc.perform(get("/api/rooms")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Verify DB: active=false, row still exists
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM clinic_room WHERE id = ?::uuid", Boolean.class, id);
        assertThat(active).isFalse();
    }

    @Test
    @DisplayName("R5. POST avec nom dupliqué d'une salle active → 409 ROOM_NAME_DUPLICATE")
    void r5_duplicateNameOnActiveRoom() throws Exception {
        createRoom("Salle Unique", List.of());

        mockMvc.perform(post("/api/rooms")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Salle Unique",
                                "capabilityTags", List.of()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROOM_NAME_DUPLICATE"));
    }

    @Test
    @DisplayName("R6. POST avec nom identique à une salle INACTIVE → 201 (pas de conflit)")
    void r6_sameNameAsInactiveRoomIsAllowed() throws Exception {
        String id = createRoom("Salle Réutilisée", List.of());
        // Deactivate
        mockMvc.perform(delete("/api/rooms/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // Create new room with same name — must succeed
        mockMvc.perform(post("/api/rooms")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Salle Réutilisée",
                                "capabilityTags", List.of()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    @DisplayName("R7. Non-ADMIN POST → 403")
    void r7_nonAdminCannotCreate() throws Exception {
        mockMvc.perform(post("/api/rooms")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Salle Interdite",
                                "capabilityTags", List.of()))))
                .andExpect(status().isForbidden());
    }
}
