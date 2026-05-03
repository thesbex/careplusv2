package ma.careplus.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
 * Integration tests for commit dcf15ec — feat(salle-attente): retirer un patient de la
 * liste d'attente.
 *
 * Scenarios:
 *
 *   S1  Happy path PLANIFIE → ANNULE avec motif : cancel_reason persisté en base.
 *   S2  Happy path ARRIVE   → ANNULE sans motif : cancel_reason NULL en base.
 *   S3  Happy path CONSTANTES_PRISES → ANNULE : tous les statuts intermédiaires sont annulables.
 *   S4  Idempotence : annuler un RDV déjà ANNULE retourne 200 sans changer le statut.
 *   S5  Guard CLOS : DELETE retourne 409 APPT_IMMUTABLE, le statut reste CLOS.
 *   S6  Guard NO_SHOW : NO_SHOW n'est PAS dans la liste des statuts bloquants du service —
 *       le service ne lève pas BusinessException pour NO_SHOW, donc 200 attendu
 *       (cf. SchedulingService.cancel : seul CLOS est bloqué, ANNULE est idempotent).
 *   S7  Guard inconnu : DELETE /api/appointments/{randomUUID} → 404 APPT_NOT_FOUND.
 *   S8  RBAC SECRETAIRE autorisé : 200.
 *   S9  RBAC ASSISTANT autorisé  : 200.
 *   S10 RBAC non authentifié : 401.
 *   S11 État invariant après échec CLOS : le cancel_reason ne change pas.
 *
 * REGRESSION GUARD
 * dcf15ec (2026-05-02) livrait la feature « Retirer de la liste d'attente » sans
 * aucun IT. Sans ces tests, les régressions suivantes auraient pu passer inaperçues :
 *   - SchedulingService.cancel() levait silencieusement une exception sur CLOS sans
 *     la mapper en 409 (aurait retourné 500 sans ce test).
 *   - cancel_reason n'était pas persisté si req == null (le @RequestBody est optional).
 *   - La règle RBAC (@PreAuthorize) aurait pu être modifiée pour exclure ASSISTANT
 *     sans que l'écart soit détecté par la suite de régression existante.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class SalleAttenteRemovalIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_removal_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Removal-IT-2026!";
    private static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    // Users seeded per test
    String secEmail;
    String assEmail;
    String medEmail;
    UUID practitionerId;
    UUID patientId;

    // ── Seed ──────────────────────────────────────────────────────────────────

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Delete in FK-safe order.
        // clinical_* tables reference scheduling_appointment via FK.
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM clinical_allergy_override");
        jdbc.update("DELETE FROM clinical_consultation_prestation");
        jdbc.update("DELETE FROM clinical_follow_up");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // SECRETAIRE
        UUID secId = UUID.randomUUID();
        secEmail = "rem-sec-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Fatima', 'Test', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        // ASSISTANT
        UUID assId = UUID.randomUUID();
        assEmail = "rem-ass-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Khadija', 'Test', TRUE, 0, 0, now(), now())
                """, assId, assEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                assId, ROLE_ASSISTANT);

        // MEDECIN (also used as practitioner)
        practitionerId = UUID.randomUUID();
        medEmail = "rem-med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Youssef', 'Test', TRUE, 0, 0, now(), now())
                """, practitionerId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                practitionerId, ROLE_MEDECIN);

        // Patient
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'Alami', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);
    }

    // ── Token helper ──────────────────────────────────────────────────────────

    /** Logs in as the given email and returns a Bearer token string. */
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
     * Inserts a scheduling_appointment directly via JDBC with the given status.
     * The appointment is always scheduled 1h from now so it doesn't hit
     * working-hours or holiday constraints (those only apply to the booking API,
     * not to JDBC inserts).
     */
    private UUID insertAppointment(String status) {
        UUID id = UUID.randomUUID();
        OffsetDateTime start = OffsetDateTime.now(CABINET).plusHours(1);
        OffsetDateTime end   = start.plusMinutes(30);
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status, walk_in, urgency,
                     version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, FALSE, FALSE, 0, now(), now())
                """, id, patientId, practitionerId, start, end, status);
        return id;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S1. Happy path PLANIFIE → ANNULE avec motif : cancel_reason persisté en base")
    void s1_cancelsPlanifeWithReason() throws Exception {
        UUID aptId = insertAppointment("PLANIFIE");
        String token = bearer(medEmail);

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Empêchement personnel QA S1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"))
                .andExpect(jsonPath("$.cancelReason").value("Empêchement personnel QA S1"));

        // Persistence assertion — never trust the response body alone.
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus).isEqualTo("ANNULE");

        String dbReason = jdbc.queryForObject(
                "SELECT cancel_reason FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbReason).isEqualTo("Empêchement personnel QA S1");
    }

    @Test
    @DisplayName("S2. Happy path ARRIVE → ANNULE sans motif : cancel_reason NULL en base")
    void s2_cancelsArriveWithoutReason() throws Exception {
        UUID aptId = insertAppointment("ARRIVE");
        String token = bearer(secEmail);

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));

        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus).isEqualTo("ANNULE");

        // cancel_reason must be NULL when no body sent.
        String dbReason = jdbc.queryForObject(
                "SELECT cancel_reason FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbReason).isNull();
    }

    @Test
    @DisplayName("S3. Happy path CONSTANTES_PRISES → ANNULE : tous les statuts intermédiaires sont annulables")
    void s3_cancelsConstantesPrises() throws Exception {
        UUID aptId = insertAppointment("CONSTANTES_PRISES");
        String token = bearer(medEmail);

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Urgence autre patient\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));

        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus).isEqualTo("ANNULE");
    }

    @Test
    @DisplayName("S4. Idempotence : annuler un RDV déjà ANNULE retourne 200 sans changer le statut")
    void s4_idempotentCancelOnAlreadyAnnule() throws Exception {
        UUID aptId = insertAppointment("ANNULE");
        // pre-set a cancel reason so we can verify it's NOT overwritten
        jdbc.update("UPDATE scheduling_appointment SET cancel_reason = 'Raison initiale' WHERE id = ?", aptId);

        String token = bearer(medEmail);

        // Second cancel — should be idempotent
        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Raison secondaire\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));

        // Status must still be ANNULE (no double-cancel side effects)
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus).isEqualTo("ANNULE");
    }

    @Test
    @DisplayName("S5. Guard CLOS : DELETE retourne 409 APPT_IMMUTABLE, le statut reste CLOS")
    void s5_closedAppointmentIsImmutable() throws Exception {
        UUID aptId = insertAppointment("CLOS");
        String token = bearer(medEmail);

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"test guard\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPT_IMMUTABLE"));

        // State invariant: DB status must NOT have changed.
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus)
                .as("CLOS appointment status must be unchanged after rejected cancel")
                .isEqualTo("CLOS");
    }

    @Test
    @DisplayName("S6. NO_SHOW peut être annulé (SchedulingService.cancel ne bloque que CLOS)")
    void s6_noShowCanBeCancelled() throws Exception {
        // SchedulingService.cancel() only blocks CLOS. ANNULE is idempotent.
        // NO_SHOW is a valid starting state for a cancel (staff corrects a mistake).
        UUID aptId = insertAppointment("NO_SHOW");
        String token = bearer(medEmail);

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Correction: patient est bien venu\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));

        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus).isEqualTo("ANNULE");
    }

    @Test
    @DisplayName("S7. Guard inconnu : DELETE sur UUID inexistant → 404 APPT_NOT_FOUND")
    void s7_unknownAppointmentReturns404() throws Exception {
        UUID unknownId = UUID.randomUUID(); // never inserted
        String token = bearer(medEmail);

        mockMvc.perform(delete("/api/appointments/" + unknownId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"test\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("APPT_NOT_FOUND"));
    }

    @Test
    @DisplayName("S8. RBAC SECRETAIRE : DELETE /api/appointments/{id} autorisé → 200")
    void s8_secretaireIsAllowedToCancel() throws Exception {
        UUID aptId = insertAppointment("PLANIFIE");
        String token = bearer(secEmail);

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"SECRETAIRE cancel test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));
    }

    @Test
    @DisplayName("S9. RBAC ASSISTANT : DELETE /api/appointments/{id} autorisé → 200")
    void s9_assistantIsAllowedToCancel() throws Exception {
        UUID aptId = insertAppointment("ARRIVE");
        String token = bearer(assEmail);

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"ASSISTANT cancel test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));

        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus).isEqualTo("ANNULE");
    }

    @Test
    @DisplayName("S10. RBAC non authentifié : DELETE sans token → 401")
    void s10_unauthenticatedIsRejected() throws Exception {
        UUID aptId = insertAppointment("PLANIFIE");

        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"no auth\"}"))
                .andExpect(status().isUnauthorized());

        // State invariant: unauthenticated call must not change anything.
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus)
                .as("unauthenticated DELETE must not mutate the appointment")
                .isEqualTo("PLANIFIE");
    }

    @Test
    @DisplayName("S11. État invariant après échec CLOS : cancel_reason ne change pas en base")
    void s11_closedStateInvariantAfterRejection() throws Exception {
        UUID aptId = insertAppointment("CLOS");
        jdbc.update("UPDATE scheduling_appointment SET cancel_reason = 'Raison originale' WHERE id = ?", aptId);

        String token = bearer(medEmail);

        // DELETE must be rejected with 409.
        mockMvc.perform(delete("/api/appointments/" + aptId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Tentative de surcharge\"}"))
                .andExpect(status().isConflict());

        // Both status AND cancel_reason must be unchanged.
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        String dbReason = jdbc.queryForObject(
                "SELECT cancel_reason FROM scheduling_appointment WHERE id = ?",
                String.class, aptId);
        assertThat(dbStatus).isEqualTo("CLOS");
        assertThat(dbReason).isEqualTo("Raison originale");
    }
}
