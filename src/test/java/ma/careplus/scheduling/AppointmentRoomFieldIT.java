package ma.careplus.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
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
 * Integration tests for appointment.room_id field.
 *
 * Scenarios:
 *   AR1  Create appointment with roomId → persists, AppointmentView returns roomId + roomName.
 *   AR2  Create appointment without roomId → persists, view returns roomId=null + roomName=null.
 *   AR3  PUT (move) updates roomId when provided.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class AppointmentRoomFieldIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_appt_room_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "ApptRoom-IT-2026!";
    private static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail;
    UUID practitionerId;
    UUID patientId;
    UUID roomId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM clinic_room");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID secId = UUID.randomUUID();
        secEmail = "sec-ar-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'AR', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        practitionerId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Doc', 'AR', TRUE, 0, 0, now(), now())
                """, practitionerId, "doc-ar-" + UUID.randomUUID() + "@test.ma",
                passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                practitionerId, ROLE_MEDECIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'Benchekroun', 'Sara', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Create a clinic room via JDBC (bypass controller for setup)
        roomId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinic_room (id, name, capability_tags, active, version, created_at, updated_at)
                VALUES (?, 'Salle Test AR', '{}', TRUE, 0, now(), now())
                """, roomId);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private OffsetDateTime nextTuesday9am() {
        LocalDate d = LocalDate.now(CABINET);
        while (d.getDayOfWeek().getValue() != 2) d = d.plusDays(1);
        if (!d.isAfter(LocalDate.now(CABINET))) d = d.plusDays(7);
        return d.atTime(9, 0).atZone(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
    }

    @Test
    @DisplayName("AR1. Create appointment with roomId → persists, view returns roomId + roomName")
    void ar1_createWithRoom() throws Exception {
        OffsetDateTime start = nextTuesday9am();
        Map<String, Object> body = new HashMap<>();
        body.put("patientId", patientId.toString());
        body.put("practitionerId", practitionerId.toString());
        body.put("startAt", start.toString());
        body.put("durationMinutes", 30);
        body.put("roomId", roomId.toString());

        MvcResult r = mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomId").value(roomId.toString()))
                .andExpect(jsonPath("$.roomName").value("Salle Test AR"))
                .andReturn();

        // Verify DB persistence
        String apptId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
        UUID dbRoomId = jdbc.queryForObject(
                "SELECT room_id FROM scheduling_appointment WHERE id = ?::uuid",
                UUID.class, apptId);
        assertThat(dbRoomId).isEqualTo(roomId);
    }

    @Test
    @DisplayName("AR2. Create appointment without roomId → view returns roomId=null + roomName=null")
    void ar2_createWithoutRoom() throws Exception {
        OffsetDateTime start = nextTuesday9am();
        Map<String, Object> body = new HashMap<>();
        body.put("patientId", patientId.toString());
        body.put("practitionerId", practitionerId.toString());
        body.put("startAt", start.toString());
        body.put("durationMinutes", 30);
        // no roomId

        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomId").doesNotExist())
                .andExpect(jsonPath("$.roomName").doesNotExist());
    }

    @Test
    @DisplayName("AR3. PUT (move) updates roomId when provided")
    void ar3_moveUpdatesRoomId() throws Exception {
        // Create appointment without room
        OffsetDateTime start = nextTuesday9am();
        Map<String, Object> createBody = new HashMap<>();
        createBody.put("patientId", patientId.toString());
        createBody.put("practitionerId", practitionerId.toString());
        createBody.put("startAt", start.toString());
        createBody.put("durationMinutes", 30);
        MvcResult r = mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isCreated()).andReturn();
        String apptId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        // Create a second room
        UUID room2 = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinic_room (id, name, capability_tags, active, version, created_at, updated_at)
                VALUES (?, 'Salle B', '{}', TRUE, 0, now(), now())
                """, room2);

        // Move appointment and assign to room2
        Map<String, Object> moveBody = new HashMap<>();
        moveBody.put("startAt", start.plusHours(1).toString());
        moveBody.put("roomId", room2.toString());

        mockMvc.perform(put("/api/appointments/" + apptId)
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(moveBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value(room2.toString()))
                .andExpect(jsonPath("$.roomName").value("Salle B"));
    }
}
