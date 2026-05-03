package ma.careplus.pregnancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * Integration tests for PregnancyUltrasoundService — Étape 2.
 *
 * Scenarios:
 *  1.  T1 datation with correctsDueDate=true → due_date adjusted + ECHO_T1 + 8 plans recalculated
 *  2.  T1 without correctsDueDate → due_date unchanged
 *  3.  T2 morpho with documentId → documentId persisted
 *  4.  RBAC: ASSISTANT → 403; MEDECIN → 201
 *  5.  3 separate T1_DATATION ultrasounds → all accepted (kind not unique)
 *  6.  saWeeksAtExam < 6 → 422 SA_TOO_EARLY
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyUltrasoundIT {

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

    private static final String PWD = "Echo-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String asstEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        jdbc.update("DELETE FROM pregnancy_ultrasound WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'EchoTest'))");
        jdbc.update("DELETE FROM pregnancy_visit_plan WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'EchoTest'))");
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'EchoTest')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'EchoTest'");

        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'echo-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'echo-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'echo-test-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "echo-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
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
                {"firstName":"%s","lastName":"EchoTest",
                 "gender":"F","birthDate":"1988-03-15",
                 "phone":"+212600000003","city":"Marrakech"}
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

    // ── Scenario 1: T1 + correctsDueDate=true → due_date adjusted + plan recalculated ─

    @Test
    void sc1_t1DataionWithCorrection_dueDateAdjusted_planRecalculated() throws Exception {
        String medToken  = bearer(medEmail);
        String patientId = createFemalePatient("Amina", medToken);

        // LMP 12 weeks ago → Naegele DPA = lmpDate + 280
        LocalDate lmpDate = LocalDate.now().minusWeeks(12);
        String pregnancyId = declarePregnancy(patientId, lmpDate, medToken);

        // Verify original DPA
        String originalDueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(originalDueDate).isEqualTo(lmpDate.plusDays(280).toString());

        // Record original plan SA 20 target date
        String originalSa20Date = jdbc.queryForObject(
                "SELECT target_date::text FROM pregnancy_visit_plan "
                + "WHERE pregnancy_id = ?::uuid AND target_sa_weeks = 20",
                String.class, pregnancyId);

        // T1 echo: sonographer says eg = 86 days (12 weeks + 2 days)
        // corrected DPA = performedAt + (280 - 86) = performedAt + 194
        LocalDate performedAt = LocalDate.now();
        int egDays = 86;
        LocalDate expectedNewDueDate = performedAt.plusDays(280 - egDays);

        MvcResult result = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "kind":"T1_DATATION",
                                  "performedAt":"%s",
                                  "saWeeksAtExam":12,
                                  "saDaysAtExam":2,
                                  "biometryJson":"{\\"eg\\":%d,\\"bip\\":22.5}",
                                  "correctsDueDate":true
                                }
                                """, performedAt, egDays)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("T1_DATATION"))
                .andExpect(jsonPath("$.correctsDueDate").value(true))
                .andReturn();

        // Verify pregnancy.due_date updated
        String newDueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(newDueDate).isEqualTo(expectedNewDueDate.toString());

        // Verify due_date_source = ECHO_T1
        String dueDateSource = jdbc.queryForObject(
                "SELECT due_date_source FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dueDateSource).isEqualTo("ECHO_T1");

        // Verify plan was recalculated — 8 entries still present
        Integer planCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit_plan WHERE pregnancy_id = ?::uuid",
                Integer.class, pregnancyId);
        assertThat(planCount).isEqualTo(8);
    }

    // ── Scenario 2: T1 without correctsDueDate → due_date unchanged ──────────

    @Test
    void sc2_t1WithoutCorrection_dueDateUnchanged() throws Exception {
        String medToken  = bearer(medEmail);
        String patientId = createFemalePatient("Khadija", medToken);
        LocalDate lmpDate = LocalDate.now().minusWeeks(11);
        String pregnancyId = declarePregnancy(patientId, lmpDate, medToken);

        String originalDueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);

        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "kind":"T1_DATATION",
                                  "performedAt":"%s",
                                  "saWeeksAtExam":11,
                                  "saDaysAtExam":0,
                                  "correctsDueDate":false
                                }
                                """, LocalDate.now())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.correctsDueDate").value(false));

        // Due date must remain unchanged
        String dueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dueDate).isEqualTo(originalDueDate);

        // due_date_source must remain NAEGELE
        String source = jdbc.queryForObject(
                "SELECT due_date_source FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(source).isEqualTo("NAEGELE");
    }

    // ── Scenario 3: T2 morpho with documentId persisted ──────────────────────

    @Test
    void sc3_t2MorphoWithDocumentId_persisted() throws Exception {
        String medToken  = bearer(medEmail);
        String patientId = createFemalePatient("Fatima", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(20), medToken);

        // We need a valid patient_document row and a user for uploaded_by
        UUID documentId = UUID.randomUUID();
        UUID uploaderUserId = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM identity_user WHERE email = ?",
                String.class, medEmail));
        jdbc.update("""
                INSERT INTO patient_document
                    (id, patient_id, type, original_filename, mime_type, size_bytes,
                     storage_key, uploaded_by, uploaded_at)
                VALUES (?::uuid, ?::uuid, 'COMPTE_RENDU', 'echo_t2.pdf', 'application/pdf',
                        102400, 'echo/echo_t2.pdf', ?::uuid, now())
                """, documentId.toString(), patientId, uploaderUserId.toString());

        MvcResult result = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "kind":"T2_MORPHO",
                                  "performedAt":"%s",
                                  "saWeeksAtExam":21,
                                  "saDaysAtExam":0,
                                  "documentId":"%s",
                                  "findings":"Morphologie normale",
                                  "correctsDueDate":false
                                }
                                """, LocalDate.now(), documentId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.documentId").value(documentId.toString()))
                .andReturn();

        String echoId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();
        UUID persistedDocId = jdbc.queryForObject(
                "SELECT document_id FROM pregnancy_ultrasound WHERE id = ?::uuid",
                UUID.class, echoId);
        assertThat(persistedDocId).isEqualTo(documentId);
    }

    // ── Scenario 4: RBAC — ASSISTANT 403, MEDECIN 201 ────────────────────────

    @Test
    void sc4_rbac_assistant403_medecin201() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Sara", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(13), medToken);

        String body = String.format("""
                {
                  "kind":"T1_DATATION",
                  "performedAt":"%s",
                  "saWeeksAtExam":13,
                  "saDaysAtExam":0,
                  "correctsDueDate":false
                }
                """, LocalDate.now());

        // ASSISTANT → 403
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        // MEDECIN → 201
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    // ── Scenario 5: 3 separate T1_DATATION ultrasounds → all accepted ────────

    @Test
    void sc5_threeT1Ultrasounds_allAccepted() throws Exception {
        String medToken  = bearer(medEmail);
        String patientId = createFemalePatient("Hind", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(14), medToken);

        String bodyTemplate = """
                {
                  "kind":"T1_DATATION",
                  "performedAt":"%s",
                  "saWeeksAtExam":12,
                  "saDaysAtExam":0,
                  "correctsDueDate":false
                }
                """;

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                            .header("Authorization", medToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format(bodyTemplate, LocalDate.now().minusDays(i))))
                    .andExpect(status().isCreated());
        }

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_ultrasound WHERE pregnancy_id = ?::uuid AND kind = 'T1_DATATION'",
                Integer.class, pregnancyId);
        assertThat(count).isEqualTo(3);
    }

    // ── Scenario 6: saWeeksAtExam < 6 → 422 SA_TOO_EARLY ────────────────────

    @Test
    void sc6_saWeeksAtExamLessThan6_422() throws Exception {
        String medToken  = bearer(medEmail);
        String patientId = createFemalePatient("Zineb", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(5), medToken);

        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "kind":"T1_DATATION",
                                  "performedAt":"%s",
                                  "saWeeksAtExam":4,
                                  "saDaysAtExam":3,
                                  "correctsDueDate":false
                                }
                                """, LocalDate.now())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("SA_TOO_EARLY"));
    }
}
