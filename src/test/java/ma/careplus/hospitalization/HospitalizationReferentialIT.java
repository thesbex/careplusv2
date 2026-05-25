package ma.careplus.hospitalization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Integration tests for the hospitalization referential (Slice A) — services /
 * chambres / lits + tableau des lits.
 *
 * Scenarios:
 *   H1  POST ward → 201 + id.
 *   H2  POST room (ward + classe + dailyRate) → 201, daily_rate persisté.
 *   H3  POST bed → 201, status LIBRE par défaut.
 *   H4  GET /board → hiérarchie ward → room → bed.
 *   H5  PUT bed status NETTOYAGE → 200 + persisté ; OCCUPE → 422 (dérivé).
 *   H6  DELETE ward contenant une chambre active → 409 WARD_HAS_ROOMS.
 *   H7  DELETE room contenant un lit actif → 409 ROOM_HAS_BEDS.
 *   H8  SECRETAIRE POST ward → 403 ; mais PUT bed status → 200 (bureau des admissions).
 *   H9  POST ward avec code dupliqué actif → 409 WARD_CODE_DUPLICATE.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class HospitalizationReferentialIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_hosp_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Hosp-IT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medecinEmail;
    String secEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM hospitalization_bed");
        jdbc.update("DELETE FROM hospitalization_room");
        jdbc.update("DELETE FROM hospitalization_ward");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medecinEmail = seedUser("med-hosp", ROLE_MEDECIN);
        secEmail = seedUser("sec-hosp", ROLE_SECRETAIRE);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'T', 'T', TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
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

    private String createWard(String code, String label) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/hospitalization/wards")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", code, "labelFr", label))))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private String createRoom(String wardId, String code) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/hospitalization/rooms")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "wardId", wardId, "code", code, "labelFr", "Chambre " + code,
                                "roomClass", "INDIVIDUELLE", "dailyRate", 400))))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private String createBed(String roomId, String code) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/hospitalization/beds")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("roomId", roomId, "code", code))))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    @Test
    @DisplayName("H1. POST ward → 201 + id")
    void h1_createWard() throws Exception {
        mockMvc.perform(post("/api/hospitalization/wards")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "MAT", "labelFr", "Maternité"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("MAT"))
                .andExpect(jsonPath("$.labelFr").value("Maternité"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    @Test
    @DisplayName("H2. POST room → 201, daily_rate persisté")
    void h2_createRoom() throws Exception {
        String wardId = createWard("MED", "Médecine");
        String roomId = createRoom(wardId, "102");

        java.math.BigDecimal rate = jdbc.queryForObject(
                "SELECT daily_rate FROM hospitalization_room WHERE id = ?::uuid",
                java.math.BigDecimal.class, roomId);
        assertThat(rate).isEqualByComparingTo("400");
    }

    @Test
    @DisplayName("H3. POST bed → 201, status LIBRE par défaut")
    void h3_createBed() throws Exception {
        String wardId = createWard("MED", "Médecine");
        String roomId = createRoom(wardId, "102");
        mockMvc.perform(post("/api/hospitalization/beds")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("roomId", roomId, "code", "Lit A"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("LIBRE"))
                .andExpect(jsonPath("$.code").value("Lit A"));
    }

    @Test
    @DisplayName("H4. GET /board → hiérarchie ward → room → bed")
    void h4_board() throws Exception {
        String wardId = createWard("MAT", "Maternité");
        String roomId = createRoom(wardId, "102");
        createBed(roomId, "Lit A");

        mockMvc.perform(get("/api/hospitalization/board")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wards.length()").value(1))
                .andExpect(jsonPath("$.wards[0].wardLabel").value("Maternité"))
                .andExpect(jsonPath("$.wards[0].rooms[0].roomCode").value("102"))
                .andExpect(jsonPath("$.wards[0].rooms[0].dailyRate").value(400))
                .andExpect(jsonPath("$.wards[0].rooms[0].beds[0].code").value("Lit A"));
    }

    @Test
    @DisplayName("H5. PUT bed status NETTOYAGE → 200 + persisté ; OCCUPE → 422")
    void h5_bedStatus() throws Exception {
        String wardId = createWard("MED", "Médecine");
        String roomId = createRoom(wardId, "102");
        String bedId = createBed(roomId, "Lit A");

        mockMvc.perform(put("/api/hospitalization/beds/" + bedId + "/status")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "NETTOYAGE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NETTOYAGE"));

        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM hospitalization_bed WHERE id = ?::uuid", String.class, bedId);
        assertThat(dbStatus).isEqualTo("NETTOYAGE");

        // OCCUPE est dérivé — rejeté par la validation du DTO (400) ou la garde service.
        mockMvc.perform(put("/api/hospitalization/beds/" + bedId + "/status")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "OCCUPE"))))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("H6. DELETE ward avec chambre active → 409 WARD_HAS_ROOMS")
    void h6_deactivateWardWithRoomsBlocked() throws Exception {
        String wardId = createWard("MAT", "Maternité");
        createRoom(wardId, "102");

        mockMvc.perform(delete("/api/hospitalization/wards/" + wardId)
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WARD_HAS_ROOMS"));

        Boolean active = jdbc.queryForObject(
                "SELECT active FROM hospitalization_ward WHERE id = ?::uuid", Boolean.class, wardId);
        assertThat(active).isTrue();
    }

    @Test
    @DisplayName("H7. DELETE room avec lit actif → 409 ROOM_HAS_BEDS")
    void h7_deactivateRoomWithBedsBlocked() throws Exception {
        String wardId = createWard("MED", "Médecine");
        String roomId = createRoom(wardId, "102");
        createBed(roomId, "Lit A");

        mockMvc.perform(delete("/api/hospitalization/rooms/" + roomId)
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROOM_HAS_BEDS"));
    }

    @Test
    @DisplayName("H8. SECRETAIRE POST ward → 403 ; PUT bed status → 200")
    void h8_secretaireRbac() throws Exception {
        // SECRETAIRE ne peut pas gérer le référentiel.
        mockMvc.perform(post("/api/hospitalization/wards")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "X", "labelFr", "X"))))
                .andExpect(status().isForbidden());

        // Mais elle peut changer le statut d'un lit (bureau des admissions).
        String wardId = createWard("MED", "Médecine");
        String roomId = createRoom(wardId, "102");
        String bedId = createBed(roomId, "Lit A");
        mockMvc.perform(put("/api/hospitalization/beds/" + bedId + "/status")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "RESERVE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESERVE"));
    }

    @Test
    @DisplayName("H9. POST ward avec code dupliqué actif → 409 WARD_CODE_DUPLICATE")
    void h9_duplicateWardCode() throws Exception {
        createWard("MAT", "Maternité");
        mockMvc.perform(post("/api/hospitalization/wards")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "MAT", "labelFr", "Autre"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WARD_CODE_DUPLICATE"));
    }
}
