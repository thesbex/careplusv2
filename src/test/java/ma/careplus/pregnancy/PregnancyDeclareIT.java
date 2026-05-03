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
import java.time.OffsetDateTime;
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
 * Integration tests for PregnancyService — Étape 1: declaration + visit plan + RBAC.
 *
 * Scenarios:
 *  1.  Declare grossesse patiente F → 201, plan 8 visites auto-créé, DPA = lmp + 280 j
 *  2.  Declare grossesse patient M → 422 PATIENT_NOT_FEMALE
 *  3.  Declare alors qu'une autre EN_COURS → 422 PREGNANCY_ALREADY_ACTIVE
 *  4.  Declare avec lmpDate > 12 SA passé → visites passées marquées MANQUEE
 *  5a. RBAC: SECRETAIRE → 403 sur déclaration
 *  5b. RBAC: ASSISTANT  → 403 sur déclaration
 *  5c. RBAC: MEDECIN    → 201 sur déclaration
 *  5d. RBAC: ADMIN      → 201 sur déclaration
 *  6.  PUT lmpDate change → plan visites recalculé
 *  7.  Close grossesse EN_COURS → status TERMINEE, ended_at + outcome persistés
 *  8.  Close grossesse déjà TERMINEE → 422 PREGNANCY_NOT_ACTIVE
 *  9.  Créer fiche enfant après close ACCOUCHEMENT_VIVANT → patient enfant créé, child_patient_id lié
 * 10.  Créer fiche enfant avec outcome = FCS → 422 OUTCOME_NOT_LIVE_BIRTH
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyDeclareIT {

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

    private static final String PWD = "Preg-Test-2026!";

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

        // Clean up pregnancy test data (cascade handles visit_plan)
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'PregTest')");
        // Clean up child patients created in tests
        jdbc.update("DELETE FROM patient_patient WHERE notes LIKE 'Enfant de%' "
                + "AND last_name = 'PregTest'");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'PregTest'");

        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'preg-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'preg-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'preg-test-%'");

        medEmail   = seedUser("med",   ROLE_MEDECIN);
        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        asstEmail  = seedUser("asst",  ROLE_ASSISTANT);
        adminEmail = seedUser("admin", ROLE_ADMIN);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "preg-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
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

    /** Creates a patient via API and returns the id. */
    private String createPatient(String firstName, String gender, String token) throws Exception {
        String body = String.format("""
                {"firstName":"%s","lastName":"PregTest",
                 "gender":"%s","birthDate":"1990-01-15",
                 "phone":"+212600000001","city":"Rabat"}
                """, firstName, gender);
        MvcResult r = mockMvc.perform(post("/api/patients")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    // ── Scenario 1: Declare grossesse patiente F → 201, 8 visites, DPA ────────

    @Test
    void sc1_declarePregnancy_femalePatient_201_visitPlanGenerated() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Amina", "F", token);

        LocalDate lmpDate = LocalDate.now().minusDays(30);
        LocalDate expectedDpa = lmpDate.plusDays(280);

        MvcResult result = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("EN_COURS"))
                .andExpect(jsonPath("$.dueDate").value(expectedDpa.toString()))
                .andExpect(jsonPath("$.dueDateSource").value("NAEGELE"))
                .andReturn();

        String pregnancyId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // Verify 8 visit plan rows in DB
        Integer planCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit_plan WHERE pregnancy_id = ?::uuid",
                Integer.class, pregnancyId);
        assertThat(planCount).isEqualTo(8);

        // Verify via plan endpoint
        mockMvc.perform(get("/api/pregnancies/" + pregnancyId + "/plan")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8));

        // DPA persisted
        String dueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dueDate).isEqualTo(expectedDpa.toString());
    }

    // ── Scenario 2: Male patient → 422 PATIENT_NOT_FEMALE ─────────────────────

    @Test
    void sc2_declarePregnancy_malePatient_422() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Mohamed", "M", token);

        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(20) + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PATIENT_NOT_FEMALE"));
    }

    // ── Scenario 3: Duplicate active pregnancy → 422 PREGNANCY_ALREADY_ACTIVE ─

    @Test
    void sc3_declarePregnancy_alreadyActive_422() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Khadija", "F", token);
        LocalDate lmpDate = LocalDate.now().minusDays(30);

        // First declaration — success
        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated());

        // Second declaration — conflict
        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate.minusDays(7) + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PREGNANCY_ALREADY_ACTIVE"));
    }

    // ── Scenario 4: lmpDate > 12 SA in past → MANQUEE for past visits ─────────

    @Test
    void sc4_declareLmpDateOlderThan12Sa_pastVisitsMarkedManquee() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Fatima", "F", token);

        // LMP 20 weeks ago — SA 12 visit should be MANQUEE (target_date < today)
        LocalDate lmpDate = LocalDate.now().minusDays(20 * 7);

        MvcResult result = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        String pregnancyId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // At SA 20 the target_date for SA 12 visit is lmpDate + 84 days = past → MANQUEE
        Integer manqueeCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit_plan "
                + "WHERE pregnancy_id = ?::uuid AND status = 'MANQUEE'",
                Integer.class, pregnancyId);
        assertThat(manqueeCount).isGreaterThanOrEqualTo(1);

        // SA 12 specifically should be MANQUEE
        String sa12Status = jdbc.queryForObject(
                "SELECT status FROM pregnancy_visit_plan "
                + "WHERE pregnancy_id = ?::uuid AND target_sa_weeks = 12",
                String.class, pregnancyId);
        assertThat(sa12Status).isEqualTo("MANQUEE");
    }

    // ── Scenario 5a: SECRETAIRE → 403 ─────────────────────────────────────────

    @Test
    void sc5a_rbac_secretaire_403() throws Exception {
        String medToken = bearer(medEmail);
        String secToken = bearer(secEmail);
        String patientId = createPatient("Nadia", "F", medToken);

        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(14) + "\"}"))
                .andExpect(status().isForbidden());
    }

    // ── Scenario 5b: ASSISTANT → 403 ──────────────────────────────────────────

    @Test
    void sc5b_rbac_assistant_403() throws Exception {
        String medToken = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createPatient("Soukaina", "F", medToken);

        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(14) + "\"}"))
                .andExpect(status().isForbidden());
    }

    // ── Scenario 5c: MEDECIN → 201 ────────────────────────────────────────────

    @Test
    void sc5c_rbac_medecin_201() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Mariam", "F", token);

        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(14) + "\"}"))
                .andExpect(status().isCreated());
    }

    // ── Scenario 5d: ADMIN → 201 ──────────────────────────────────────────────

    @Test
    void sc5d_rbac_admin_201() throws Exception {
        String adminToken = bearer(adminEmail);
        String patientId = createPatient("Zineb", "F", adminToken);

        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(14) + "\"}"))
                .andExpect(status().isCreated());
    }

    // ── Scenario 6: PUT lmpDate change → plan recalculated ────────────────────

    @Test
    void sc6_updateLmpDate_planRecalculated() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Ilham", "F", token);
        LocalDate originalLmp = LocalDate.now().minusDays(30);

        MvcResult decl = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + originalLmp + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        String pregnancyId = objectMapper.readTree(decl.getResponse().getContentAsString())
                .get("id").asText();

        // Record original SA 12 target date
        String originalSa12Date = jdbc.queryForObject(
                "SELECT target_date::text FROM pregnancy_visit_plan "
                + "WHERE pregnancy_id = ?::uuid AND target_sa_weeks = 12",
                String.class, pregnancyId);

        // Shift lmpDate 14 days earlier
        LocalDate newLmp = originalLmp.minusDays(14);
        LocalDate expectedNewDpa = newLmp.plusDays(280);

        mockMvc.perform(put("/api/pregnancies/" + pregnancyId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + newLmp + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueDate").value(expectedNewDpa.toString()));

        // New SA 12 target date should be 14 days earlier
        String newSa12Date = jdbc.queryForObject(
                "SELECT target_date::text FROM pregnancy_visit_plan "
                + "WHERE pregnancy_id = ?::uuid AND target_sa_weeks = 12",
                String.class, pregnancyId);

        assertThat(newSa12Date).isNotEqualTo(originalSa12Date);
        // Verify still 8 entries
        Integer planCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit_plan WHERE pregnancy_id = ?::uuid",
                Integer.class, pregnancyId);
        assertThat(planCount).isEqualTo(8);
    }

    // ── Scenario 7: Close EN_COURS → TERMINEE ─────────────────────────────────

    @Test
    void sc7_closePregnancy_enCours_becomesTerminee() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Hind", "F", token);
        LocalDate lmpDate = LocalDate.now().minusDays(280);

        MvcResult decl = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        String pregnancyId = objectMapper.readTree(decl.getResponse().getContentAsString())
                .get("id").asText();

        LocalDate endedAt = LocalDate.now();

        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + endedAt + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TERMINEE"))
                .andExpect(jsonPath("$.outcome").value("ACCOUCHEMENT_VIVANT"))
                .andExpect(jsonPath("$.endedAt").value(endedAt.toString()));

        // Verify DB
        String status = jdbc.queryForObject(
                "SELECT status FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(status).isEqualTo("TERMINEE");
    }

    // ── Scenario 7b: Interruption outcome → INTERROMPUE ──────────────────────

    @Test
    void sc7b_closePregnancy_fcs_becomesInterrompue() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Sara", "F", token);
        LocalDate lmpDate = LocalDate.now().minusDays(60);

        MvcResult decl = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        String pregnancyId = objectMapper.readTree(decl.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"FCS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INTERROMPUE"));
    }

    // ── Scenario 8: Close already TERMINEE → 422 PREGNANCY_NOT_ACTIVE ─────────

    @Test
    void sc8_closeAlreadyTerminee_422() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Rim", "F", token);
        LocalDate lmpDate = LocalDate.now().minusDays(280);

        MvcResult decl = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        String pregnancyId = objectMapper.readTree(decl.getResponse().getContentAsString())
                .get("id").asText();

        // Close once
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk());

        // Close again → 422
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PREGNANCY_NOT_ACTIVE"));
    }

    // ── Scenario 9: createChild after live birth → child patient + child_patient_id ─

    @Test
    void sc9_createChild_afterLiveBirth_childPatientLinked() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Layla", "F", token);
        LocalDate lmpDate = LocalDate.now().minusDays(280);

        MvcResult decl = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        String pregnancyId = objectMapper.readTree(decl.getResponse().getContentAsString())
                .get("id").asText();

        // Close with live birth
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk());

        // Create child
        MvcResult childResult = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/create-child")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Adam\",\"sex\":\"M\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        // Location header points to /api/patients/{childId}
        String location = childResult.getResponse().getHeader("Location");
        assertThat(location).isNotNull().contains("/api/patients/");

        // Verify child_patient_id updated on pregnancy
        UUID childPatientId = jdbc.queryForObject(
                "SELECT child_patient_id FROM pregnancy WHERE id = ?::uuid",
                UUID.class, pregnancyId);
        assertThat(childPatientId).isNotNull();

        // Verify child patient exists with correct birth date and last name
        String childLastName = jdbc.queryForObject(
                "SELECT last_name FROM patient_patient WHERE id = ?",
                String.class, childPatientId);
        assertThat(childLastName).isEqualTo("PregTest");

        String childFirstName = jdbc.queryForObject(
                "SELECT first_name FROM patient_patient WHERE id = ?",
                String.class, childPatientId);
        assertThat(childFirstName).isEqualTo("Adam");

        String childGender = jdbc.queryForObject(
                "SELECT gender FROM patient_patient WHERE id = ?",
                String.class, childPatientId);
        assertThat(childGender).isEqualTo("M");
    }

    // ── Scenario 10: createChild with outcome = FCS → 422 OUTCOME_NOT_LIVE_BIRTH

    @Test
    void sc10_createChild_fcsOutcome_422() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Nour", "F", token);
        LocalDate lmpDate = LocalDate.now().minusDays(60);

        MvcResult decl = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        String pregnancyId = objectMapper.readTree(decl.getResponse().getContentAsString())
                .get("id").asText();

        // Close with FCS
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"FCS\"}"))
                .andExpect(status().isOk());

        // createChild → 422
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/create-child")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Test\",\"sex\":\"M\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("OUTCOME_NOT_LIVE_BIRTH"));
    }

    // ── Scenario 11: GET /current returns EN_COURS or 404 ────────────────────

    @Test
    void sc11_getCurrent_returnsCurrent_or404() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Yasmine", "F", token);

        // No pregnancy yet → 404
        mockMvc.perform(get("/api/patients/" + patientId + "/pregnancies/current")
                        .header("Authorization", token))
                .andExpect(status().isNotFound());

        // Declare pregnancy
        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(30) + "\"}"))
                .andExpect(status().isCreated());

        // Now returns 200 with EN_COURS
        mockMvc.perform(get("/api/patients/" + patientId + "/pregnancies/current")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EN_COURS"))
                .andExpect(jsonPath("$.saWeeks").isNumber());
    }
}
