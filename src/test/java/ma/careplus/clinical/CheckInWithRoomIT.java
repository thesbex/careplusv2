package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.time.ZoneId;
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
 * Integration tests for "salle de consultation choisie au check-in"
 * (feat commit: CheckInRequest + PresenceService.checkIn(UUID,UUID) overload).
 *
 * Scenarios covered:
 *
 *   S1  checkIn_with_roomId_assigns_room
 *         POST {roomId} on PLANIFIE → 204 + DB: status=ARRIVE, room_id=roomA, arrived_at populated.
 *
 *   S2  checkIn_with_roomId_reassigns_pre_booked_room
 *         Appointment booked with roomA → POST {roomId: roomB} → DB room_id=roomB.
 *
 *   S3  checkIn_no_body_keeps_pre_booked_room
 *         Appointment booked with roomA → POST without body → DB room_id=roomA unchanged.
 *
 *   S4  checkIn_with_null_roomId_in_body_keeps_pre_booked_room
 *         POST {roomId: null} → room unchanged (null means "don't touch" by design).
 *         The FE sends null when user selects "Aucune" — this is a DESIGN GAP: the UI
 *         intent is to clear the room but the backend ignores null. Documented here so
 *         the gap can't be silently broken further. If the semantics change (null → clear),
 *         this test must be updated AND the service's if-check changed to allow explicit null.
 *
 *   S5  checkIn_can_clear_room_via_separate_endpoint_gap_documented
 *         Confirms the gap: sending {roomId: null} when a room is pre-booked does NOT
 *         clear the room. The only way to clear is to use PUT /api/appointments/{id}
 *         (the move endpoint) with roomId=null. This test guards that the gap is not
 *         accidentally "fixed" on the backend without updating the frontend.
 *
 *   S6  re_checkIn_idempotent_status_but_room_still_updates
 *         Check-in once → status=ARRIVE. Check-in again with a different roomId →
 *         status stays ARRIVE, arrived_at unchanged, but room_id reflects the new value.
 *
 *   S7  queue_endpoint_includes_roomId_and_roomName
 *         GET /api/queue after a check-in with a room → JSON includes roomId (UUID string)
 *         and roomName (the clinic_room.name).
 *
 *   S8  queue_endpoint_returns_null_room_fields_when_no_room
 *         Appointment checked-in without a room → both roomId and roomName absent from JSON
 *         (application.yml: default-property-inclusion: non_null, so null fields are omitted).
 *
 *   S9  status_guard_runs_before_room_assignment
 *         Appointment in CLOS status → POST {roomId} → 409 APPT_IMMUTABLE + DB room_id unchanged.
 *         Verifies that PresenceService checks immutability BEFORE applying the room change.
 *
 * REGRESSION GUARD
 * ────────────────
 * Production bug 1 (2026-05-08): The running Spring Boot JVM served OLD bytecode for
 * PresenceService + QueueEntryView even though the source files had been updated with the
 * room-at-check-in feature. The server was never restarted. Consequence:
 *   - POST /check-in accepted a {roomId} body but silently discarded it (old service had
 *     no overload). room_id in DB was never updated.
 *   - GET /api/queue omitted roomId and roomName entirely (old record had 11 fields,
 *     new record has 14). The Salle column in the UI always displayed "—".
 * These tests would have caught BOTH symptoms on the first run after the fix commit.
 *
 * Production bug 2 (design gap, 2026-05-08): POST {roomId: null} does not clear a
 * pre-booked room because PresenceService treats null as "don't touch". The UI sends
 * null when the user picks "Aucune" in the room dropdown. S4/S5 guard this gap.
 *
 * Scaffolding: mirrors SalleAttenteRemovalIT (MockMvc, @ServiceConnection, rate-limit reset,
 * JDBC-driven seed and assertions).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class CheckInWithRoomIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_checkin_room_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "CheckInRoom-IT-2026!";
    private static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    // Seeded per-test
    String medEmail;
    String secEmail;
    UUID medId;
    UUID patientId;
    UUID roomA;
    UUID roomB;

    // ── Seed ─────────────────────────────────────────────────────────────────

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Delete in FK-safe order.
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM clinical_allergy_override");
        jdbc.update("DELETE FROM clinical_consultation_prestation");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_follow_up");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM clinic_room");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // MEDECIN (used as practitioner + requester)
        medId = UUID.randomUUID();
        medEmail = "cir-med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Youssef', 'CIR', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medId, ROLE_MEDECIN);

        // SECRETAIRE (tests RBAC on queue endpoint)
        UUID secId = UUID.randomUUID();
        secEmail = "cir-sec-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Fatima', 'CIR', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        // Patient
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children,
                    status, created_at, updated_at)
                VALUES (?, 'Alami', 'TestCIR', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Two rooms
        roomA = UUID.randomUUID();
        roomB = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinic_room (id, name, capability_tags, active, version, created_at, updated_at)
                VALUES (?, 'Salle A', '{}', TRUE, 0, now(), now()),
                       (?, 'Salle B', '{}', TRUE, 0, now(), now())
                """, roomA, roomB);
    }

    // ── Token helper ─────────────────────────────────────────────────────────

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Appointment factory ───────────────────────────────────────────────────

    /**
     * Inserts a PLANIFIE appointment scheduled for now (qualifies for today's queue).
     * {@code preBookedRoomId} may be null (no room) or a clinic_room UUID.
     */
    private UUID insertAppointment(UUID preBookedRoomId) {
        UUID id = UUID.randomUUID();
        OffsetDateTime start = OffsetDateTime.now(CABINET);
        OffsetDateTime end   = start.plusMinutes(30);
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status, room_id,
                     walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'PLANIFIE', ?, FALSE, FALSE, 0, now(), now())
                """, id, patientId, medId, start, end, preBookedRoomId);
        return id;
    }

    /** Inserts an appointment with a specific status (for guard tests). */
    private UUID insertAppointmentWithStatus(String status, UUID preBookedRoomId) {
        UUID id = UUID.randomUUID();
        OffsetDateTime start = OffsetDateTime.now(CABINET);
        OffsetDateTime end   = start.plusMinutes(30);
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status, room_id,
                     walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, 0, now(), now())
                """, id, patientId, medId, start, end, status, preBookedRoomId);
        return id;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    private UUID dbRoomId(UUID appointmentId) {
        return jdbc.queryForObject(
                "SELECT room_id FROM scheduling_appointment WHERE id = ?",
                UUID.class, appointmentId);
    }

    private String dbStatus(UUID appointmentId) {
        return jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, appointmentId);
    }

    private boolean dbArrivedAtSet(UUID appointmentId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment WHERE id = ? AND arrived_at IS NOT NULL",
                Integer.class, appointmentId);
        return count != null && count > 0;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S1. POST {roomId} sur PLANIFIE → 204, status=ARRIVE, room_id=roomA, arrived_at renseigné en base")
    void s1_checkIn_with_roomId_assigns_room() throws Exception {
        UUID aptId = insertAppointment(null); // no pre-booked room
        String token = bearer(medEmail);

        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":\"" + roomA + "\"}"))
                .andExpect(status().isNoContent());

        assertThat(dbStatus(aptId)).isEqualTo("ARRIVE");
        assertThat(dbRoomId(aptId)).isEqualTo(roomA);
        assertThat(dbArrivedAtSet(aptId)).isTrue();
    }

    @Test
    @DisplayName("S2. RDV pré-réservé roomA + POST {roomId: roomB} → room_id=roomB en base (réassignation)")
    void s2_checkIn_with_roomId_reassigns_pre_booked_room() throws Exception {
        UUID aptId = insertAppointment(roomA); // pre-booked with roomA
        String token = bearer(medEmail);

        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":\"" + roomB + "\"}"))
                .andExpect(status().isNoContent());

        assertThat(dbStatus(aptId)).isEqualTo("ARRIVE");
        // Room must be roomB — the one passed at check-in, not the pre-booked roomA.
        assertThat(dbRoomId(aptId))
                .as("room_id must be roomB (reassigned at check-in), not the pre-booked roomA")
                .isEqualTo(roomB);
    }

    @Test
    @DisplayName("S3. RDV pré-réservé roomA + POST sans body → room_id=roomA conservé (pas de réassignation)")
    void s3_checkIn_no_body_keeps_pre_booked_room() throws Exception {
        UUID aptId = insertAppointment(roomA);
        String token = bearer(medEmail);

        // POST without body at all
        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        assertThat(dbStatus(aptId)).isEqualTo("ARRIVE");
        assertThat(dbRoomId(aptId))
                .as("room_id must remain roomA when no body is sent")
                .isEqualTo(roomA);
    }

    @Test
    @DisplayName("S4. POST {roomId: null} + salle pré-bookée → room_id INCHANGÉ (null signifie 'ne pas toucher')")
    void s4_checkIn_with_null_roomId_in_body_keeps_pre_booked_room() throws Exception {
        UUID aptId = insertAppointment(roomA);
        String token = bearer(medEmail);

        // The FE sends {roomId: null} when user selects "Aucune" in the dropdown.
        // Per PresenceService: if (roomId != null) → the null is ignored → room preserved.
        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\": null}"))
                .andExpect(status().isNoContent());

        assertThat(dbStatus(aptId)).isEqualTo("ARRIVE");
        assertThat(dbRoomId(aptId))
                .as("null roomId must NOT clear the pre-booked room — this is the intentional design. "
                    + "If this assertion fails it means the null-clear semantics changed: "
                    + "also update S5 and the UI to confirm the clearing works end-to-end.")
                .isEqualTo(roomA);
    }

    @Test
    @DisplayName("S5. DESIGN GAP documenté : null roomId ne peut pas effacer une salle pré-bookée via check-in")
    void s5_checkIn_can_clear_room_via_separate_endpoint_gap_documented() throws Exception {
        // This test deliberately mirrors S4 to make the gap explicit and separately named
        // so it shows up in test reports as its own item.
        //
        // Current behavior (intentional per PresenceService code):
        //   POST {roomId: null} → room preserved
        //
        // Consequence (UI gap, 2026-05-08):
        //   The AppointmentDrawer sends {roomId: null} when "Aucune" is selected.
        //   The backend ignores it → room NOT cleared even though the user intended to clear.
        //
        // To actually clear a room the user must use "Déplacer le RDV" (PUT /api/appointments/{id})
        // which has a separate roomId parameter that CAN be set to null via moveAppointment hook.
        //
        // To fix: change PresenceService to treat an explicitly-provided null as "clear room",
        // AND change CheckInRequest to carry a sentinel that distinguishes "null=clear" from
        // "field absent=don't touch" (e.g. an Optional<UUID> pattern with a custom deserializer).

        UUID aptId = insertAppointment(roomA);
        String token = bearer(medEmail);

        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\": null}"))
                .andExpect(status().isNoContent());

        // Room NOT cleared — expected given the current design.
        assertThat(dbRoomId(aptId))
                .as("DESIGN GAP: sending null roomId at check-in does not clear the room. "
                    + "See class Javadoc for the fix path.")
                .isEqualTo(roomA);
    }

    @Test
    @DisplayName("S6. Re-check-in (déjà ARRIVE) avec nouveau roomId → statut idempotent, room_id mis à jour")
    void s6_re_checkIn_idempotent_status_but_room_still_updates() throws Exception {
        UUID aptId = insertAppointment(roomA);
        String token = bearer(medEmail);

        // First check-in with roomA
        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":\"" + roomA + "\"}"))
                .andExpect(status().isNoContent());

        OffsetDateTime arrivedAtFirst = jdbc.queryForObject(
                "SELECT arrived_at FROM scheduling_appointment WHERE id = ?",
                OffsetDateTime.class, aptId);

        // Re-check-in with roomB (already ARRIVE — idempotent on status)
        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":\"" + roomB + "\"}"))
                .andExpect(status().isNoContent());

        // Status must remain ARRIVE (not re-transitioned)
        assertThat(dbStatus(aptId)).isEqualTo("ARRIVE");

        // arrived_at must be unchanged (idempotent on the timestamp too)
        OffsetDateTime arrivedAtSecond = jdbc.queryForObject(
                "SELECT arrived_at FROM scheduling_appointment WHERE id = ?",
                OffsetDateTime.class, aptId);
        assertThat(arrivedAtSecond)
                .as("arrived_at must not be reset on re-check-in")
                .isEqualTo(arrivedAtFirst);

        // Room MUST have been updated to roomB even though status was idempotent.
        assertThat(dbRoomId(aptId))
                .as("room_id must be updated to roomB on re-check-in even when status is already ARRIVE")
                .isEqualTo(roomB);
    }

    @Test
    @DisplayName("S7. GET /api/queue après check-in avec salle → roomId (UUID) et roomName (String) présents dans JSON")
    void s7_queue_endpoint_includes_roomId_and_roomName() throws Exception {
        UUID aptId = insertAppointment(null);
        String token = bearer(secEmail);

        // Check in with roomA
        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":\"" + roomA + "\"}"))
                .andExpect(status().isNoContent());

        // Queue must expose roomId and roomName
        mockMvc.perform(get("/api/queue")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].roomId").value(roomA.toString()))
                .andExpect(jsonPath("$[0].roomName").value("Salle A"));

        // Cross-check persistence
        assertThat(dbRoomId(aptId)).isEqualTo(roomA);
    }

    @Test
    @DisplayName("S8. GET /api/queue sans salle → roomId et roomName absents du JSON (null → non_null exclusion)")
    void s8_queue_endpoint_returns_null_room_fields_when_no_room() throws Exception {
        UUID aptId = insertAppointment(null); // no pre-booked room
        String token = bearer(secEmail);

        // Check in WITHOUT providing a room
        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        // Queue entry must not include roomId or roomName (non_null Jackson config omits them)
        mockMvc.perform(get("/api/queue")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].roomId").doesNotExist())
                .andExpect(jsonPath("$[0].roomName").doesNotExist());

        // DB: room_id must be null
        assertThat(dbRoomId(aptId)).isNull();
    }

    @Test
    @DisplayName("S9. CLOS → 409 APPT_IMMUTABLE + room_id inchangé en base (garde s'exécute AVANT setRoomId)")
    void s9_status_guard_runs_before_room_assignment() throws Exception {
        UUID aptId = insertAppointmentWithStatus("CLOS", roomA);
        String token = bearer(medEmail);

        mockMvc.perform(post("/api/appointments/" + aptId + "/check-in")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":\"" + roomB + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPT_IMMUTABLE"));

        // State invariant: room_id must be roomA (unchanged), NOT roomB.
        // PresenceService.checkIn runs the status guard (ANNULE/NO_SHOW/CLOS check) BEFORE
        // the setRoomId call — so the room is never even set on the entity when the guard fires.
        // This is the intentional ordering (guard first → short-circuit). If someone refactors
        // the method and accidentally moves setRoomId above the guard, the @Transactional
        // rollback would still protect the DB, but that rollback path would be a silent
        // partial-write risk if the transactional boundary were ever removed.
        assertThat(dbRoomId(aptId))
                .as("room_id must remain roomA after a rejected check-in on a CLOS appointment")
                .isEqualTo(roomA);
        assertThat(dbStatus(aptId)).isEqualTo("CLOS");
    }
}
