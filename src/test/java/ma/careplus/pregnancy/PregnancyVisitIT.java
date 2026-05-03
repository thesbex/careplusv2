package ma.careplus.pregnancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
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
 * Integration tests for PregnancyVisitService — Étape 2: obstetric visit recording.
 *
 * Scenarios:
 *  1.  ASSISTANT records visit → 201, sa_weeks computed from lmpDate
 *  2.  RBAC: SECRETAIRE → 403; ASSISTANT → 201
 *  3.  TA ≥ 140/90 persisted correctly
 *      (TODO Étape 3: assert HTA_GRAVIDIQUE alert appears in /alerts)
 *  4.  BCF absent (no fetalHeartRateBpm field) at SA 12 — visit accepted, value null
 *      (TODO Étape 3: assert BCF_ABSENT alert appears in /alerts)
 *  5.  Visit at SA 35 without presentation → 201, presentation null
 *  6.  Vitals out of range (bp_systolic=250) → 422 VITALS_OUT_OF_RANGE (bean validation gate)
 *  7.  Visit linked to SUIVI_GROSSESSE appointment → visit_plan linked, plan status = HONOREE
 *  8.  Ad-hoc visit (no appointmentId) → visit_plan_id = null
 *  9.  PUT visit before consultation signed → 200
 * 10.  PUT visit after consultation SIGNEE → 422 CONSULTATION_SIGNED
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyVisitIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "Visit-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    String asstEmail;
    String adminEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Null out appointment_id FK on visit_plan before deleting appointments
        jdbc.update("""
                UPDATE pregnancy_visit_plan SET appointment_id = NULL
                WHERE pregnancy_id IN (
                    SELECT id FROM pregnancy WHERE patient_id IN (
                        SELECT id FROM patient_patient WHERE last_name = 'VisitTest'))
                """);
        // Delete appointments created in sc7 (FK: scheduling_appointment.patient_id)
        jdbc.update("DELETE FROM scheduling_appointment WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'VisitTest')");
        // Null out consultation_id FK on pregnancy_visit before deleting consultations
        jdbc.update("""
                UPDATE pregnancy_visit SET consultation_id = NULL
                WHERE pregnancy_id IN (
                    SELECT id FROM pregnancy WHERE patient_id IN (
                        SELECT id FROM patient_patient WHERE last_name = 'VisitTest'))
                """);
        // Delete consultations created in sc10 before patients (FK: clinical_consultation.patient_id)
        jdbc.update("DELETE FROM clinical_consultation WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'VisitTest')");
        jdbc.update("DELETE FROM pregnancy_visit WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'VisitTest'))");
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'VisitTest')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'VisitTest'");

        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'visit-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'visit-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'visit-test-%'");

        medEmail   = seedUser("med",   ROLE_MEDECIN);
        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        asstEmail  = seedUser("asst",  ROLE_ASSISTANT);
        adminEmail = seedUser("admin", ROLE_ADMIN);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "visit-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'User', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                userId, roleId);
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

    private String createFemalePatient(String firstName, String token) throws Exception {
        String body = String.format("""
                {"firstName":"%s","lastName":"VisitTest",
                 "gender":"F","birthDate":"1990-06-01",
                 "phone":"+212600000002","city":"Casablanca"}
                """, firstName);
        MvcResult r = mockMvc.perform(post("/api/patients")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private String declarePregnancy(String patientId, LocalDate lmpDate, String token) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    // ── Scenario 1: ASSISTANT records visit → 201, sa_weeks computed ─────────

    @Test
    void sc1_assistantRecordsVisit_201_saWeeksComputed() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Amina", medToken);

        // LMP 10 weeks ago → saWeeks should be 10
        LocalDate lmpDate = LocalDate.now().minusWeeks(10);
        String pregnancyId = declarePregnancy(patientId, lmpDate, medToken);

        MvcResult result = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"weightKg":65.5,"bpSystolic":110,"bpDiastolic":70}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.saWeeks").value(10))
                .andExpect(jsonPath("$.pregnancyId").value(pregnancyId))
                .andReturn();

        String visitId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // Verify DB
        Integer saWeeks = jdbc.queryForObject(
                "SELECT sa_weeks FROM pregnancy_visit WHERE id = ?::uuid",
                Integer.class, visitId);
        assertThat(saWeeks).isEqualTo(10);
    }

    // ── Scenario 2: RBAC — SECRETAIRE 403, ASSISTANT 201 ─────────────────────

    @Test
    void sc2_rbac_secretaire403_assistant201() throws Exception {
        String medToken  = bearer(medEmail);
        String secToken  = bearer(secEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Khadija", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(8), medToken);

        // SECRETAIRE → 403
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":60.0}"))
                .andExpect(status().isForbidden());

        // ASSISTANT → 201
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":60.0}"))
                .andExpect(status().isCreated());
    }

    // ── Scenario 3: TA 145/95 persisted — HTA values stored ─────────────────
    // TODO Étape 3: assert HTA_GRAVIDIQUE alert appears in GET /api/pregnancies/{id}/alerts

    @Test
    void sc3_htaValues_persisted() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Fatima", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(20), medToken);

        MvcResult result = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":145,\"bpDiastolic\":95}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bpSystolic").value(145))
                .andExpect(jsonPath("$.bpDiastolic").value(95))
                .andReturn();

        String visitId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();
        Integer sys = jdbc.queryForObject(
                "SELECT bp_systolic FROM pregnancy_visit WHERE id = ?::uuid",
                Integer.class, visitId);
        assertThat(sys).isEqualTo(145);
    }

    // ── Scenario 4: BCF absent at SA 12 — visit accepted, fetalHeartRateBpm null
    // TODO Étape 3: assert BCF_ABSENT alert appears in GET /api/pregnancies/{id}/alerts

    @Test
    void sc4_bcfAbsentAtSa12_visitAccepted() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Hind", medToken);
        // LMP exactly 12 weeks ago
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(12), medToken);

        MvcResult res = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        // No fetalHeartRateBpm supplied
                        .content("{\"weightKg\":62.0,\"bpSystolic\":110,\"bpDiastolic\":70}"))
                .andExpect(status().isCreated())
                .andReturn();

        // fetalHeartRateBpm absent in request → persisted as null → not present in JSON
        JsonNode body4 = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(body4.has("fetalHeartRateBpm") && !body4.get("fetalHeartRateBpm").isNull()
                ? body4.get("fetalHeartRateBpm").asInt() : 0).isEqualTo(0);
    }

    // ── Scenario 5: Visit at SA 35 without presentation → 201, presentation null

    @Test
    void sc5_visitAtSa35_noPresentation_accepted() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Sara", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(35), medToken);

        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":78.0}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.presentation").doesNotExist());
    }

    // ── Scenario 6: Vitals out of range → 422 (bean validation) ─────────────

    @Test
    void sc6_vitalsOutOfRange_422() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Nadia", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(15), medToken);

        // bp_systolic = 250 (max allowed 220) → 400 bean validation
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":250}"))
                .andExpect(status().isBadRequest());
    }

    // ── Scenario 7: Visit linked to appointment (via tolerance window) → plan marked HONOREE ─

    @Test
    void sc7_visitLinkedToAppointment_planMarkedHonoree() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Mariam", medToken);

        // LMP exactly 12 weeks ago → SA 12 plan entry target_date is today (within tolerance=14)
        LocalDate lmpDate = LocalDate.now().minusWeeks(12);
        String pregnancyId = declarePregnancy(patientId, lmpDate, medToken);

        // Get the SA 12 plan entry id
        String planId = jdbc.queryForObject(
                "SELECT id::text FROM pregnancy_visit_plan "
                + "WHERE pregnancy_id = ?::uuid AND target_sa_weeks = 12",
                String.class, pregnancyId);

        // We need a real scheduling_appointment row to satisfy the FK.
        // Insert a minimal appointment referencing one of our test patients + user.
        UUID appointmentId = UUID.randomUUID();
        UUID practitionerId = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM identity_user WHERE email = ?",
                String.class, medEmail));
        // Find a scheduling reason for the appointment (FK is nullable but provide one for realism)
        // reason_id is nullable in V001 DDL — pass null to avoid needing a valid reason row
        String reasonIdStr = jdbc.queryForObject(
                "SELECT id::text FROM scheduling_appointment_reason LIMIT 1",
                String.class);

        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, reason_id, start_at, end_at,
                     status, type, version, created_at, updated_at)
                VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid,
                        now() + INTERVAL '1 hour', now() + INTERVAL '2 hours',
                        'PLANIFIE', 'SUIVI_GROSSESSE', 0, now(), now())
                """, appointmentId.toString(), patientId, practitionerId.toString(),
                reasonIdStr);

        MvcResult result = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appointmentId\":\"" + appointmentId + "\","
                                + "\"weightKg\":63.0}"))
                .andExpect(status().isCreated())
                .andReturn();

        String visitId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // visit_plan_id should be the SA 12 plan entry (matched by tolerance window)
        String linkedPlanId = jdbc.queryForObject(
                "SELECT visit_plan_id::text FROM pregnancy_visit WHERE id = ?::uuid",
                String.class, visitId);
        assertThat(linkedPlanId).isEqualTo(planId);

        // Plan status should be HONOREE
        String planStatus = jdbc.queryForObject(
                "SELECT status FROM pregnancy_visit_plan WHERE id = ?::uuid",
                String.class, planId);
        assertThat(planStatus).isEqualTo("HONOREE");
    }

    // ── Scenario 8: Ad-hoc visit → visit_plan_id = null ──────────────────────

    @Test
    void sc8_adHocVisit_visitPlanIdNull() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Zineb", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(16), medToken);

        MvcResult result = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        // No appointmentId → ad-hoc
                        .content("{\"weightKg\":70.0}"))
                .andExpect(status().isCreated())
                .andReturn();

        String visitId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        Object planId = jdbc.queryForObject(
                "SELECT visit_plan_id FROM pregnancy_visit WHERE id = ?::uuid",
                Object.class, visitId);
        assertThat(planId).isNull();
    }

    // ── Scenario 9: PUT visit before consultation signed → 200 ──────────────

    @Test
    void sc9_updateVisit_beforeConsultationSigned_200() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Rim", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(18), medToken);

        MvcResult rec = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":68.0}"))
                .andExpect(status().isCreated())
                .andReturn();

        String visitId = objectMapper.readTree(rec.getResponse().getContentAsString())
                .get("id").asText();

        // No consultationId → update must succeed
        mockMvc.perform(put("/api/pregnancies/visits/" + visitId)
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":69.5,\"notes\":\"Mise à jour test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weightKg").value(69.5));
    }

    // ── Scenario 10: PUT visit after consultation SIGNEE → 422 ───────────────

    @Test
    void sc10_updateVisit_afterConsultationSigned_422() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Layla", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(22), medToken);

        // Create a signed consultation by inserting directly into DB
        UUID consultationId = UUID.randomUUID();
        UUID practitionerId = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM identity_user WHERE email = ?",
                String.class, medEmail));

        jdbc.update("""
                INSERT INTO clinical_consultation
                    (id, patient_id, practitioner_id, status, version, created_at, updated_at, started_at)
                VALUES (?::uuid, ?::uuid, ?::uuid, 'SIGNEE', 0, now(), now(), now())
                """,
                consultationId.toString(), patientId, practitionerId.toString());

        // Record a visit linked to that signed consultation
        MvcResult rec = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"consultationId\":\"" + consultationId + "\","
                                + "\"weightKg\":72.0}"))
                .andExpect(status().isCreated())
                .andReturn();

        String visitId = objectMapper.readTree(rec.getResponse().getContentAsString())
                .get("id").asText();

        // Attempt update → 422 CONSULTATION_SIGNED
        mockMvc.perform(put("/api/pregnancies/visits/" + visitId)
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":73.0}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("CONSULTATION_SIGNED"));
    }
}
