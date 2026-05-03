package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
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
 * Integration tests for commit 36e0e4a:
 * "feat(consultation): vision 360 du planning du jour dans la modale Prochain RDV".
 *
 * <p>Surface under test:
 * <ul>
 *   <li>GET  /api/appointments?practitionerId=&amp;from=&amp;to= — planning panel data source</li>
 *   <li>POST /api/consultations/{id}/follow-up — creates the CONTROLE appointment</li>
 * </ul>
 *
 * <p>Scenarios:
 * <ol>
 *   <li>Planning panel — jour vide : GET /appointments renvoie tableau vide → "Aucun RDV"</li>
 *   <li>Planning panel — RDV existants : les champs patientFullName, startAt, endAt, status
 *       sont renvoyés correctement</li>
 *   <li>Planning panel — ANNULE exclu : un RDV ANNULE n'apparaît pas dans la vue planning
 *       (le backend filtre déjà AND status NOT IN ('ANNULE','NO_SHOW'))</li>
 *   <li>Happy path follow-up : POST /follow-up crée un CONTROLE en DB avec start/end cohérents</li>
 *   <li>BUG 1 — Duration mismatch : POST /follow-up avec un motif de 15 min crée un RDV
 *       de 30 min en DB (hardcoded dans ConsultationService.scheduleFollowUp ligne 193)</li>
 *   <li>BUG 2 — Bypass holiday : POST /follow-up sur un jour férié (Fête du Trône 2026-07-30)
 *       est accepté alors que SchedulingService.create() le refuserait avec APPT_ON_HOLIDAY</li>
 *   <li>BUG 3 — Bypass leave : POST /follow-up pendant un congé praticien est accepté
 *       alors que SchedulingService.create() le refuserait avec APPT_ON_LEAVE</li>
 *   <li>BUG 4 — Bypass overlap : POST /follow-up en chevauchement avec un RDV existant
 *       est accepté alors que SchedulingService.create() le refuserait avec APPT_CONFLICT</li>
 *   <li>RBAC — Secrétaire peut lire GET /appointments (rôle autorisé en lecture)</li>
 *   <li>RBAC — Secrétaire ne peut pas POST /follow-up (403, @PreAuthorize ASSISTANT|MEDECIN|ADMIN)</li>
 *   <li>Consultation inconnue → POST /follow-up renvoie 404 CONSULT_NOT_FOUND</li>
 *   <li>Date/heure manquante → POST /follow-up renvoie 400 (validation @NotNull)</li>
 *   <li>Planning panel — praticien différent : GET /appointments filtre par practitionerId,
 *       les RDV d'un autre praticien ne sont pas renvoyés</li>
 * </ol>
 *
 * <p>REGRESSION GUARD — bugs production que cette suite détecterait :
 * <ul>
 *   <li>BUG 1 (durée hardcodée, découvert 2026-05-02) :
 *       {@code ConsultationService.scheduleFollowUp()} ligne 193 calcule toujours
 *       {@code startAt.plusMinutes(30)} quelle que soit la durée du motif sélectionné.
 *       La modale affiche 15 min (depuis le motif SUIVI), le backend persiste 30 min.
 *       Cette incohérence créé des faux conflits et trompe le médecin sur la disponibilité.
 *       Scénario 5 attrape ce bug.</li>
 *   <li>BUG 2 (bypass holiday, découvert 2026-05-02) :
 *       {@code scheduleFollowUp()} écrit directement dans {@code appointmentRepository.save()}
 *       sans passer par {@code SchedulingService.create()} qui vérifie les jours fériés.
 *       Un RDV de contrôle peut être créé le 30 juillet (Fête du Trône).
 *       Scénario 6 attrape ce bug.</li>
 *   <li>BUG 3 (bypass leave, découvert 2026-05-02) :
 *       Même racine que BUG 2 — les congés praticien ne sont pas vérifiés.
 *       Scénario 7 attrape ce bug.</li>
 *   <li>BUG 4 (bypass overlap, découvert 2026-05-02) :
 *       Même racine que BUG 2 — les chevauchements ne sont pas vérifiés.
 *       La modale affiche une alerte visuelle côté UI, mais le backend accepte quand même
 *       le POST. Le médecin peut ignorer l'alerte et créer un vrai conflit DB.
 *       Scénario 8 attrape ce bug.</li>
 * </ul>
 *
 * <p>Note pour les correcteurs : les scenarios 5–8 documentent des bugs existants.
 * Ils sont écrits de telle sorte qu'ils PASSENT (ils assertent le comportement actuel
 * défaillant) jusqu'à ce que le bug soit fixé, auquel cas le test doit être inversé
 * pour asserter le comportement correct (409 au lieu de 201).
 * Voir les annotations @DisplayName qui indiquent clairement "BUG:" dans le libellé.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class FollowUpVision360IT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "FollowUp360-Test-2026!";
    private static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");

    // V002 seeds 2026 Moroccan holidays — Fête du Trône is 2026-07-30
    private static final LocalDate HOLIDAY_FETE_TRONE = LocalDate.of(2026, 7, 30);

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    UUID otherMedId;
    UUID patientId;
    UUID patientId2;
    UUID consultationBrouillonId;
    UUID consultationSigneeId;
    UUID existingApptId;          // RDV already on the calendar for overlap tests

    // Cached tokens — login once per role per @BeforeEach
    String medToken;
    String secToken;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();

        // Purge in FK-safe order.
        // NOTE: scheduling_appointment.origin_consultation_id references clinical_consultation,
        // so we must NULL the FK before deleting consultations (or delete appointments first).
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_consultation_prestation");
        jdbc.update("DELETE FROM clinical_vital_signs");
        // NULL the FK before deleting consultations — follow-up appointments reference them
        jdbc.update("UPDATE scheduling_appointment SET origin_consultation_id = NULL");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_practitioner_leave");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Primary medecin
        medId = UUID.randomUUID();
        String medEmail = "med-360-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Vision360', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medId, ROLE_MEDECIN);

        // Second medecin — for cross-practitioner isolation test
        otherMedId = UUID.randomUUID();
        String otherEmail = "med-other-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Autre', TRUE, 0, 0, now(), now())
                """, otherMedId, otherEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                otherMedId, ROLE_MEDECIN);

        // Secretaire
        UUID secId = UUID.randomUUID();
        String secEmail = "sec-360-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Test', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        // Patients
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'Alami', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        patientId2 = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'Lahlou', 'Fatima Zahra', 0, 0, 'ACTIF', now(), now())
                """, patientId2);

        // Consultation BROUILLON (follow-up source)
        consultationBrouillonId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, started_at, created_at, updated_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationBrouillonId, patientId, medId);

        // Consultation SIGNEE (for overlap / holiday tests — also valid for follow-up)
        consultationSigneeId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, started_at, signed_at, created_at, updated_at)
                VALUES (?, ?, ?, 'SIGNEE', 1, 0, now(), now(), now(), now())
                """, consultationSigneeId, patientId2, medId);

        // Existing appointment on nextTuesday() at 10:00–10:30 Casablanca
        // Used for overlap detection tests
        existingApptId = UUID.randomUUID();
        OffsetDateTime existingStart = nextTuesdayAt("10:00");
        OffsetDateTime existingEnd   = existingStart.plusMinutes(30);
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status,
                     walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'PLANIFIE', FALSE, FALSE, 0, now(), now())
                """, existingApptId, patientId, medId, existingStart, existingEnd);

        // Acquire tokens
        medToken = bearer(medEmail);
        secToken = bearer(secEmail);
    }

    // ── Token helper ──────────────────────────────────────────────────────────

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /** Returns next Tuesday at the given HH:mm in Africa/Casablanca. */
    private OffsetDateTime nextTuesdayAt(String hhmm) {
        LocalDate d = LocalDate.now(CABINET).plusDays(1);
        while (d.getDayOfWeek().getValue() != 2) d = d.plusDays(1);
        String[] parts = hhmm.split(":");
        return d.atTime(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]))
                .atZone(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
    }

    // ── Scénario 1 — Planning panel : jour sans RDV ───────────────────────────

    @Test
    @DisplayName("Planning panel — GET /appointments pour un jour sans RDV renvoie tableau vide (200)")
    void dayPlanning_emptyDay_returnsEmptyArray() throws Exception {
        // Use a date far in future where no appointments exist
        LocalDate farFuture = LocalDate.of(2027, 6, 15);
        String from = farFuture.atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC).toString();
        String to = farFuture.atTime(23, 59, 59).atZone(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC).toString();

        mockMvc.perform(get("/api/appointments")
                        .header("Authorization", medToken)
                        .param("practitionerId", medId.toString())
                        .param("from", from)
                        .param("to", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ── Scénario 2 — Planning panel : champs renvoyés correctement ────────────

    @Test
    @DisplayName("Planning panel — GET /appointments renvoie patientFullName, startAt, endAt, status")
    void dayPlanning_existingAppointment_returnsFullNameAndTimes() throws Exception {
        OffsetDateTime start = nextTuesdayAt("10:00");
        String from = start.minusHours(1).toString();
        String to   = start.plusHours(2).toString();

        mockMvc.perform(get("/api/appointments")
                        .header("Authorization", medToken)
                        .param("practitionerId", medId.toString())
                        .param("from", from)
                        .param("to", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].patientFullName").value("Mohamed Alami"))
                .andExpect(jsonPath("$[0].status").value("PLANIFIE"))
                .andExpect(jsonPath("$[0].startAt").isNotEmpty())
                .andExpect(jsonPath("$[0].endAt").isNotEmpty());
    }

    // ── Scénario 3 — Planning panel : ANNULE exclu ───────────────────────────

    @Test
    @DisplayName("Planning panel — un RDV ANNULE n'apparaît pas dans la vue planning (filtre backend)")
    void dayPlanning_cancelledAppointment_isExcludedFromPlanning() throws Exception {
        // Cancel the existing appointment
        mockMvc.perform(delete("/api/appointments/" + existingApptId)
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Test ANNULE exclusion\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));

        // Now the planning for that day should be empty
        OffsetDateTime start = nextTuesdayAt("10:00");
        String from = start.minusHours(1).toString();
        String to   = start.plusHours(2).toString();

        mockMvc.perform(get("/api/appointments")
                        .header("Authorization", medToken)
                        .param("practitionerId", medId.toString())
                        .param("from", from)
                        .param("to", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // DB still has the row — it's just filtered from the view
        String statusInDb = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, existingApptId);
        assertThat(statusInDb).isEqualTo("ANNULE");
    }

    // ── Scénario 4 — Happy path follow-up : CONTROLE créé en DB ─────────────

    @Test
    @DisplayName("Follow-up happy path — POST /follow-up crée un CONTROLE en DB lié à la consultation")
    void followUp_happyPath_persistedInDb() throws Exception {
        LocalDate nextTuesday = LocalDate.now(CABINET).plusDays(1);
        while (nextTuesday.getDayOfWeek().getValue() != 2) nextTuesday = nextTuesday.plusDays(1);

        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationBrouillonId + "/follow-up")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "date", nextTuesday.toString(),
                                "time", "14:00:00"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("CONTROLE"))
                .andExpect(jsonPath("$.originConsultationId").value(consultationBrouillonId.toString()))
                .andReturn();

        String apptId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("appointmentId").asText();

        // Persistence assertion — never trust the response body alone
        String typeInDb = jdbc.queryForObject(
                "SELECT type FROM scheduling_appointment WHERE id = ?",
                String.class, UUID.fromString(apptId));
        assertThat(typeInDb)
                .as("Le RDV de contrôle doit être stocké avec type=CONTROLE en DB")
                .isEqualTo("CONTROLE");

        String originInDb = jdbc.queryForObject(
                "SELECT origin_consultation_id::text FROM scheduling_appointment WHERE id = ?",
                String.class, UUID.fromString(apptId));
        assertThat(originInDb)
                .as("L'ID de consultation d'origine doit être persisté")
                .isEqualTo(consultationBrouillonId.toString());

        String statusInDb = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, UUID.fromString(apptId));
        assertThat(statusInDb)
                .as("Le RDV créé via follow-up doit être PLANIFIE")
                .isEqualTo("PLANIFIE");
    }

    // ── Scénario 5 — Durée respecte le motif (regression-guard du BUG 1 corrigé) ──
    //
    // BUG #1 (QA wave 6, 2026-05-02) : ConsultationService.scheduleFollowUp()
    // hardcodait endAt = startAt.plusMinutes(30) au lieu de respecter la durée
    // du motif. Fixé en déléguant à SchedulingService.create() qui résout via
    // resolveDuration(reasonId, durationMinutes). Test inversé pour acter le fix.

    @Test
    @DisplayName("Follow-up avec motif SUIVI (15 min) crée un RDV de 15 min en DB")
    void followUp_withShortReason_respectsReasonDuration() throws Exception {
        // SUIVI reason has durationMinutes=15 (V002 reference data)
        String suiviReasonId = jdbc.queryForObject(
                "SELECT id::text FROM scheduling_appointment_reason WHERE code = 'SUIVI'",
                String.class);
        assertThat(suiviReasonId)
                .as("Le motif SUIVI doit être présent dans les données de référence")
                .isNotNull();

        LocalDate nextTuesday = LocalDate.now(CABINET).plusDays(1);
        while (nextTuesday.getDayOfWeek().getValue() != 2) nextTuesday = nextTuesday.plusDays(1);

        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationBrouillonId + "/follow-up")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "date", nextTuesday.toString(),
                                "time", "11:00:00",
                                "reasonId", suiviReasonId))))
                .andExpect(status().isCreated())
                .andReturn();

        String apptId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("appointmentId").asText();

        OffsetDateTime startAt = jdbc.queryForObject(
                "SELECT start_at FROM scheduling_appointment WHERE id = ?",
                OffsetDateTime.class, UUID.fromString(apptId));
        OffsetDateTime endAt = jdbc.queryForObject(
                "SELECT end_at FROM scheduling_appointment WHERE id = ?",
                OffsetDateTime.class, UUID.fromString(apptId));

        assertThat(startAt).isNotNull();
        assertThat(endAt).isNotNull();

        long actualMinutes = java.time.Duration.between(startAt, endAt).toMinutes();

        assertThat(actualMinutes)
                .as("La durée doit refléter le motif SUIVI (15 min), pas un default 30.")
                .isEqualTo(15L);
    }

    // ── Scénario 6 — Holiday refusé (regression-guard du BUG 2 corrigé) ──────
    //
    // BUG #2 (QA wave 6, 2026-05-02) : scheduleFollowUp() écrivait directement
    // via appointmentRepository.save() sans passer par SchedulingService.create()
    // → bypass du holidayRepository check. Fixé en déléguant à create().

    @Test
    @DisplayName("POST /follow-up sur jour férié (2026-07-30) refusé 409 APPT_ON_HOLIDAY")
    void followUp_onHoliday_isRejected() throws Exception {
        // Verify the holiday exists in the test DB (seeded by V002)
        Integer holidayCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_holiday WHERE date = '2026-07-30'",
                Integer.class);
        assertThat(holidayCount)
                .as("La Fête du Trône 2026-07-30 doit être seeded dans scheduling_holiday")
                .isGreaterThan(0);

        Integer countBefore = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                + "WHERE practitioner_id = ? AND DATE(start_at AT TIME ZONE 'Africa/Casablanca') = '2026-07-30'",
                Integer.class, medId);

        mockMvc.perform(post("/api/consultations/" + consultationBrouillonId + "/follow-up")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "date", HOLIDAY_FETE_TRONE.toString(),
                                "time", "09:00:00"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPT_ON_HOLIDAY"));

        Integer countAfter = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                + "WHERE practitioner_id = ? AND DATE(start_at AT TIME ZONE 'Africa/Casablanca') = '2026-07-30'",
                Integer.class, medId);
        assertThat(countAfter)
                .as("Aucun RDV ne doit avoir été persisté sur le jour férié.")
                .isEqualTo(countBefore);
    }

    // ── Scénario 7 — Leave refusé (regression-guard du BUG 3 corrigé) ────────
    //
    // BUG #3 (QA wave 6, 2026-05-02) : même racine que BUG 2 — bypass du
    // leaveRepository check via le save() direct. Fixé en déléguant à create().

    @Test
    @DisplayName("POST /follow-up pendant un congé praticien refusé 409 APPT_ON_LEAVE")
    void followUp_onLeave_isRejected() throws Exception {
        LocalDate leaveDate = LocalDate.of(2027, 3, 15);
        UUID leaveId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_practitioner_leave
                    (id, practitioner_id, start_date, end_date, created_at)
                VALUES (?, ?, ?, ?, now())
                """, leaveId, medId, leaveDate, leaveDate);

        Integer countBefore = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                + "WHERE practitioner_id = ? AND DATE(start_at AT TIME ZONE 'Africa/Casablanca') = ?",
                Integer.class, medId, leaveDate);

        mockMvc.perform(post("/api/consultations/" + consultationBrouillonId + "/follow-up")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "date", leaveDate.toString(),
                                "time", "10:00:00"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPT_ON_LEAVE"));

        Integer countAfter = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                + "WHERE practitioner_id = ? AND DATE(start_at AT TIME ZONE 'Africa/Casablanca') = ?",
                Integer.class, medId, leaveDate);
        assertThat(countAfter)
                .as("Aucun RDV ne doit être persisté pendant un congé.")
                .isEqualTo(countBefore);
    }

    // ── Scénario 8 — Overlap refusé (regression-guard du BUG 4 corrigé) ──────
    //
    // BUG #4 (QA wave 6, 2026-05-02) : même racine — bypass du
    // findOverlapping() check via le save() direct. Fixé en déléguant à create().

    @Test
    @DisplayName("POST /follow-up chevauchant un RDV existant refusé 409 APPT_CONFLICT")
    void followUp_overlappingExistingAppointment_isRejected() throws Exception {
        // existingApptId is at 10:00–10:30 (nextTuesday).
        // Tenter un follow-up à 10:15 — chevauchement clair.
        OffsetDateTime overlapStart = nextTuesdayAt("10:15");
        LocalDate day = overlapStart.atZoneSameInstant(CABINET).toLocalDate();

        Integer countBefore = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                + "WHERE practitioner_id = ? AND status != 'ANNULE' "
                + "AND start_at >= ? AND start_at < ?",
                Integer.class, medId,
                day.atStartOfDay(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC),
                day.plusDays(1).atStartOfDay(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC));

        mockMvc.perform(post("/api/consultations/" + consultationBrouillonId + "/follow-up")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "date", day.toString(),
                                "time", "10:15:00"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPT_CONFLICT"));

        Integer countAfter = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                + "WHERE practitioner_id = ? AND status != 'ANNULE' "
                + "AND start_at >= ? AND start_at < ?",
                Integer.class, medId,
                day.atStartOfDay(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC),
                day.plusDays(1).atStartOfDay(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC));
        assertThat(countAfter)
                .as("Aucun nouveau RDV ne doit être persisté en chevauchement.")
                .isEqualTo(countBefore);
    }

    // ── Scénario 9 — RBAC : Secrétaire peut lire le planning ─────────────────

    @Test
    @DisplayName("RBAC — Secrétaire peut lire GET /appointments (200, rôle SECRETAIRE autorisé)")
    void dayPlanning_secretaire_canRead() throws Exception {
        OffsetDateTime start = nextTuesdayAt("10:00");
        String from = start.minusHours(1).toString();
        String to   = start.plusHours(2).toString();

        mockMvc.perform(get("/api/appointments")
                        .header("Authorization", secToken)
                        .param("practitionerId", medId.toString())
                        .param("from", from)
                        .param("to", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ── Scénario 10 — RBAC : Secrétaire ne peut pas créer un follow-up ───────

    @Test
    @DisplayName("RBAC — Secrétaire ne peut pas POST /follow-up (403), "
            + "@PreAuthorize ASSISTANT|MEDECIN|ADMIN seulement")
    void followUp_secretaire_isForbidden() throws Exception {
        LocalDate nextTuesday = LocalDate.now(CABINET).plusDays(1);
        while (nextTuesday.getDayOfWeek().getValue() != 2) nextTuesday = nextTuesday.plusDays(1);

        // Snapshot count before the RBAC attempt
        Integer countBefore = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment WHERE practitioner_id = ?",
                Integer.class, medId);

        mockMvc.perform(post("/api/consultations/" + consultationBrouillonId + "/follow-up")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "date", nextTuesday.toString(),
                                "time", "15:00:00"))))
                .andExpect(status().isForbidden());

        // State unchanged — count must be the same as before the forbidden attempt
        Integer countAfter = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment WHERE practitioner_id = ?",
                Integer.class, medId);
        assertThat(countAfter)
                .as("Aucun RDV ne doit être créé par un secrétaire via follow-up (état inchangé)")
                .isEqualTo(countBefore);
    }

    // ── Scénario 11 — Consultation inconnue → 404 ────────────────────────────

    @Test
    @DisplayName("Follow-up sur consultation inconnue — 404 CONSULT_NOT_FOUND")
    void followUp_unknownConsultation_returns404() throws Exception {
        UUID unknownId = UUID.randomUUID();
        mockMvc.perform(post("/api/consultations/" + unknownId + "/follow-up")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"2026-09-01\",\"time\":\"09:00:00\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CONSULT_NOT_FOUND"));
    }

    // ── Scénario 12 — Date manquante → 400 ───────────────────────────────────

    @Test
    @DisplayName("Follow-up sans date — 400 Bad Request (@NotNull date)")
    void followUp_missingDate_returns400() throws Exception {
        mockMvc.perform(post("/api/consultations/" + consultationBrouillonId + "/follow-up")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"time\":\"09:00:00\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── Scénario 13 — Planning panel : isolation par praticien ───────────────

    @Test
    @DisplayName("Planning panel — GET /appointments filtre par practitionerId, "
            + "les RDV d'un autre praticien ne sont pas renvoyés")
    void dayPlanning_crossPractitionerIsolation() throws Exception {
        // Insert an appointment for otherMedId on the same day
        OffsetDateTime start = nextTuesdayAt("10:00");
        UUID otherApptId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status,
                     walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'PLANIFIE', FALSE, FALSE, 0, now(), now())
                """, otherApptId, patientId, otherMedId, start, start.plusMinutes(30));

        String from = start.minusHours(1).toString();
        String to   = start.plusHours(2).toString();

        // Query for medId — should only see medId's appointment, not otherMedId's
        mockMvc.perform(get("/api/appointments")
                        .header("Authorization", medToken)
                        .param("practitionerId", medId.toString())
                        .param("from", from)
                        .param("to", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].practitionerId").value(medId.toString()));

        // Query for otherMedId — should only see otherMedId's appointment
        mockMvc.perform(get("/api/appointments")
                        .header("Authorization", medToken)
                        .param("practitionerId", otherMedId.toString())
                        .param("from", from)
                        .param("to", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].practitionerId").value(otherMedId.toString()));
    }
}
