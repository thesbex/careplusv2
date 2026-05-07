package ma.careplus.scheduling;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
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
 * Integration tests for GET /api/appointments/{id}/room-conflicts.
 *
 * Scenarios:
 *   RC1  1 salle A, 2 RDV à 09:00-09:30 et 10:00-10:30 → conflicts vide pour les deux.
 *   RC2  2 RDV salle A à 09:00-09:30 et 09:15-09:45 → conflicts du 1er retourne le 2e, et vice-versa.
 *   RC3  2 RDV chevauchants mais salles différentes → conflicts vide.
 *   RC4  RDV sans roomId → /room-conflicts retourne [].
 *   RC5  RDV CANCELLED ne génère pas de conflit.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class RoomConflictIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_conflict_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Conflict-IT-2026!";
    private static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail;
    UUID practitionerId;
    UUID patientId;
    UUID roomA;
    UUID roomB;

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
        secEmail = "sec-rc-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'RC', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        practitionerId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Doc', 'RC', TRUE, 0, 0, now(), now())
                """, practitionerId, "doc-rc-" + UUID.randomUUID() + "@test.ma",
                passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                practitionerId, ROLE_MEDECIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'El Fassi', 'Karim', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        roomA = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinic_room (id, name, capability_tags, active, version, created_at, updated_at)
                VALUES (?, 'Salle A', '{}', TRUE, 0, now(), now())
                """, roomA);

        roomB = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinic_room (id, name, capability_tags, active, version, created_at, updated_at)
                VALUES (?, 'Salle B', '{}', TRUE, 0, now(), now())
                """, roomB);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /**
     * Inserts a scheduling_appointment directly via JDBC with a given room and time window.
     * Uses JDBC to bypass holiday/leave/conflict checks (conflict detection is UI-only for rooms).
     */
    private UUID insertAppt(UUID roomId, OffsetDateTime start, OffsetDateTime end, String status) {
        UUID id = UUID.randomUUID();
        if (roomId != null) {
            jdbc.update("""
                    INSERT INTO scheduling_appointment
                        (id, patient_id, practitioner_id, room_id, start_at, end_at,
                         status, walk_in, urgency, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, 0, now(), now())
                    """, id, patientId, practitionerId, roomId, start, end, status);
        } else {
            jdbc.update("""
                    INSERT INTO scheduling_appointment
                        (id, patient_id, practitioner_id, start_at, end_at,
                         status, walk_in, urgency, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, FALSE, FALSE, 0, now(), now())
                    """, id, patientId, practitionerId, start, end, status);
        }
        return id;
    }

    private OffsetDateTime ts(String time) {
        // Use a fixed future date to avoid hitting working-hours constraints
        return java.time.LocalDateTime.parse("2030-06-10T" + time)
                .atZone(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
    }

    @Test
    @DisplayName("RC1. 2 RDV salle A non-chevauchants → conflicts vide pour les deux")
    void rc1_noConflictWhenNotOverlapping() throws Exception {
        UUID appt1 = insertAppt(roomA, ts("09:00"), ts("09:30"), "PLANIFIE");
        UUID appt2 = insertAppt(roomA, ts("10:00"), ts("10:30"), "PLANIFIE");

        mockMvc.perform(get("/api/appointments/" + appt1 + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/appointments/" + appt2 + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("RC2. 2 RDV salle A chevauchants → chacun retourne l'autre en conflict")
    void rc2_conflictWhenOverlapping() throws Exception {
        UUID appt1 = insertAppt(roomA, ts("09:00"), ts("09:30"), "PLANIFIE");
        UUID appt2 = insertAppt(roomA, ts("09:15"), ts("09:45"), "PLANIFIE");

        // appt1 conflicts → sees appt2
        mockMvc.perform(get("/api/appointments/" + appt1 + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].conflictAppointmentId").value(appt2.toString()));

        // appt2 conflicts → sees appt1
        mockMvc.perform(get("/api/appointments/" + appt2 + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].conflictAppointmentId").value(appt1.toString()));
    }

    @Test
    @DisplayName("RC3. 2 RDV chevauchants mais salles différentes → conflicts vide")
    void rc3_noConflictAcrossRooms() throws Exception {
        UUID appt1 = insertAppt(roomA, ts("09:00"), ts("09:30"), "PLANIFIE");
        UUID appt2 = insertAppt(roomB, ts("09:15"), ts("09:45"), "PLANIFIE");

        mockMvc.perform(get("/api/appointments/" + appt1 + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/appointments/" + appt2 + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("RC4. RDV sans roomId → /room-conflicts retourne []")
    void rc4_noRoomReturnsEmpty() throws Exception {
        UUID appt = insertAppt(null, ts("09:00"), ts("09:30"), "PLANIFIE");

        mockMvc.perform(get("/api/appointments/" + appt + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("RC5. RDV ANNULE ne génère pas de conflit")
    void rc5_cancelledDoesNotConflict() throws Exception {
        UUID appt1 = insertAppt(roomA, ts("09:00"), ts("09:30"), "PLANIFIE");
        // appt2 is ANNULE — must be excluded from conflict detection
        UUID appt2 = insertAppt(roomA, ts("09:15"), ts("09:45"), "ANNULE");

        mockMvc.perform(get("/api/appointments/" + appt1 + "/room-conflicts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
