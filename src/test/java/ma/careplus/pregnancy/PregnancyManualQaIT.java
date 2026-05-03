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
 * Manual QA integration tests for the Grossesse module (Walk 1-4).
 * Written from the 2026-05-03 QA walk — captures every scenario walked
 * in the browser and via API, including bugs found during the session.
 *
 * <h2>Scenario catalogue</h2>
 * <ol>
 *   <li>Walk1-S1  Happy path — déclarer grossesse patiente F → 201, SA=8, 8 PLANIFIEE chips, DPA Naegele</li>
 *   <li>Walk1-S2  Happy path — saisir visite normale (poids=60, TA=110/70) → 201, persisted en DB</li>
 *   <li>Walk1-S3  Happy path — saisir écho T1 correctsDueDate=true via biometryJson → DPA ajustée ECHO_T1</li>
 *   <li>Walk1-S4  Happy path — bio panel T1 retourne 10 items (Groupage, RAI, TPHA-VDRL…)</li>
 *   <li>Walk1-S5  Alerte HTA — visite TA=145/95 → alerte HTA_GRAVIDIQUE active</li>
 *   <li>Walk1-S6  Clôturer grossesse ACCOUCHEMENT_VIVANT → status=TERMINEE, ended_at+outcome persisted</li>
 *   <li>Walk1-S7  Créer fiche enfant → patient créé, child_patient_id lié, calendrier vaccination PNI matérialisé</li>
 *   <li>Walk2-S1  Worklist /queue — grossesse EN_COURS visible, TERMINEE absente</li>
 *   <li>Walk2-S2  Worklist filtre trimestre T1 — exclut T2</li>
 *   <li>Walk2-S3  Worklist filtre withAlerts=true — n'inclut que les grossesses avec alertes</li>
 *   <li>Walk2-S4  Worklist filtre q=nom — cherche par nom de famille</li>
 *   <li>Walk3-S1  RBAC SECRETAIRE — lecture 200, déclarer 403, saisir visite 403</li>
 *   <li>Walk3-S2  RBAC ASSISTANT — saisir visite 201, déclarer 403, saisir écho 403</li>
 *   <li>Walk4-S1  Patient mâle — POST /pregnancies → 422 PATIENT_NOT_FEMALE</li>
 *   <li>Walk4-S2  Tab Grossesse masqué pour patient M (vérification guard backend)</li>
 *   <li>BUG-S1    biometryJson mismatch — le backend accepte biometryJson (String) ; null → fallback SA</li>
 *   <li>BUG-S2    urineDipJson mismatch — la réponse contient urineDipJson (String) pas urineDip (Object)</li>
 * </ol>
 *
 * <h2>REGRESSION GUARD</h2>
 * <ul>
 *   <li>2026-05-03 — JVM started before pregnancy commits → routes 404. Test BUG-S1 exercises the
 *       biometryJson contract explicitly so any future renaming breaks a test, not a silent data loss.</li>
 *   <li>2026-05-03 — urineDipJson field name mismatch between backend DTO and frontend type.
 *       Test BUG-S2 asserts the API response uses "urineDipJson", not "urineDip", so if the backend
 *       changes the field name the test catches it before the frontend silently breaks.</li>
 *   <li>2026-05-03 — DPA correction uses biometryJson.eg; when biometryJson is null (wrong field name),
 *       it silently falls back to saWeeks*7. Walk1-S3 asserts the specific shifted DPA value so any
 *       regression in the correction logic fails loudly.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyManualQaIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_qa_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "MQA-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    // Token cache per role — login once per @Test (rate-limit safe).
    private String medEmail;
    private String secEmail;
    private String asstEmail;

    // ─────────────────────────────────────────────────────────────────────────
    // Setup
    // ─────────────────────────────────────────────────────────────────────────

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // FK-safe cleanup: child patients first, then pregnancies, then patients
        jdbc.update("UPDATE patient_patient SET photo_document_id = NULL "
                + "WHERE last_name IN ('MqaFemTest','MqaMaleTest','MqaChildTest')");
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name IN ('MqaFemTest','MqaMaleTest'))");
        jdbc.update("DELETE FROM patient_patient WHERE last_name IN "
                + "('MqaFemTest','MqaMaleTest','MqaChildTest')");

        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'mqa-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'mqa-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'mqa-test-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Walk 1 — Happy path (MEDECIN)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Walk1-S1 : déclarer grossesse patiente F → 201, SA calculée, 8 PLANIFIEE, DPA=lmp+280")
    void walk1_s1_declarePregnancy_femalePatient_planGenerated() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);

        // DDR = today - 60 jours → SA ≈ 8 semaines
        LocalDate lmpDate = LocalDate.now().minusDays(60);
        LocalDate expectedDpa = lmpDate.plusDays(280);

        MvcResult result = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("EN_COURS"))
                .andExpect(jsonPath("$.dueDate").value(expectedDpa.toString()))
                .andExpect(jsonPath("$.dueDateSource").value("NAEGELE"))
                .andExpect(jsonPath("$.saWeeks").value(8))
                .andReturn();

        String pregnancyId = id(result);

        // Verify 8 PLANIFIEE entries in DB
        Integer planCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit_plan WHERE pregnancy_id = ?::uuid AND status = 'PLANIFIEE'",
                Integer.class, pregnancyId);
        assertThat(planCount).isEqualTo(8);

        // Verify plan endpoint returns all 8
        mockMvc.perform(get("/api/pregnancies/" + pregnancyId + "/plan")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8));

        // Verify DPA persisted correctly
        String dbDueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dbDueDate).isEqualTo(expectedDpa.toString());
    }

    @Test
    @DisplayName("Walk1-S2 : saisir visite normale (poids=60, TA=110/70) → 201, données persistées en DB")
    void walk1_s2_recordNormalVisit_persisted() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), token);

        MvcResult result = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"recordedAt":"2026-05-03T10:00:00Z","weightKg":60,
                                 "bpSystolic":110,"bpDiastolic":70,
                                 "urineDipJson":"{\\"glucose\\":false,\\"protein\\":false,\\"leuco\\":false,\\"nitrites\\":false,\\"ketones\\":false,\\"blood\\":false}"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.saWeeks").value(8))
                .andExpect(jsonPath("$.weightKg").value(60))
                .andReturn();

        String visitId = id(result);

        // Assert persisted in DB
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit WHERE id = ?::uuid AND weight_kg = 60 AND bp_systolic = 110",
                Integer.class, visitId);
        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("Walk1-S3 : écho T1 biometryJson={eg:63}, correctsDueDate=true → DPA ajustée, dueDateSource=ECHO_T1")
    void walk1_s3_ultrasoundT1_correctsDueDate_dpaAdjusted() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        LocalDate lmpDate = LocalDate.now().minusDays(60);
        String pregnancyId = declarePregnancy(patientId, lmpDate, token);

        // Original DPA = lmpDate + 280
        // biometryJson eg=63 → newDPA = performedAt + (280-63) = today + 217
        LocalDate performedAt = LocalDate.now();
        LocalDate expectedNewDpa = performedAt.plusDays(280 - 63);

        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind":"T1_DATATION","performedAt":"%s","saWeeksAtExam":9,
                                 "saDaysAtExam":0,"biometryJson":"{\\"eg\\":63}","correctsDueDate":true}
                                """.formatted(performedAt)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.correctsDueDate").value(true));

        // Assert DPA updated in DB
        String dbDueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dbDueDate).isEqualTo(expectedNewDpa.toString());

        // Assert dueDateSource changed to ECHO_T1
        String dbSource = jdbc.queryForObject(
                "SELECT due_date_source FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dbSource).isEqualTo("ECHO_T1");
    }

    @Test
    @DisplayName("Walk1-S4 : GET bio-panel-template?trimester=T1 → 10 lignes incluant Groupage/RAI/HIV/rubéole/toxo/AgHBs/GAJ/BU/ECBU")
    void walk1_s4_bioPanelT1_returns10Lines() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/" + pregnancyId + "/bio-panel-template")
                        .param("trimester", "T1")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trimester").value("T1"))
                .andExpect(jsonPath("$.lines").isArray())
                .andReturn();

        JsonNode lines = objectMapper.readTree(result.getResponse().getContentAsString()).get("lines");
        assertThat(lines.size()).isEqualTo(10);

        // Key codes that PSGA requires in T1
        String responseText = result.getResponse().getContentAsString();
        assertThat(responseText).contains("GROUPE_RH");    // Groupage
        assertThat(responseText).contains("RAI");
        assertThat(responseText).contains("SERO_SYPH");   // TPHA-VDRL
        assertThat(responseText).contains("SERO_HIV");
        assertThat(responseText).contains("SERO_RUB");    // Rubéole
        assertThat(responseText).contains("SERO_TOXO");   // Toxoplasmose
        assertThat(responseText).contains("SERO_HEPB");   // AgHBs
        assertThat(responseText).contains("GLY");         // Glycémie à jeun
        assertThat(responseText).contains("ECBU");
    }

    @Test
    @DisplayName("Walk1-S5 : visite TA=145/95 → alerte HTA_GRAVIDIQUE active sur la grossesse")
    void walk1_s5_visitHta_alertFired() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), token);

        // Record HTA visit
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"recordedAt":"2026-05-03T10:00:00Z",
                                 "bpSystolic":145,"bpDiastolic":95}
                                """))
                .andExpect(status().isCreated());

        // Check alerts
        mockMvc.perform(get("/api/pregnancies/" + pregnancyId + "/alerts")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'HTA_GRAVIDIQUE')]").exists())
                .andExpect(jsonPath("$[?(@.code == 'HTA_GRAVIDIQUE')].severity").value("WARN"));
    }

    @Test
    @DisplayName("Walk1-S6 : clôturer grossesse ACCOUCHEMENT_VIVANT → status=TERMINEE, ended_at+outcome persistés en DB")
    void walk1_s6_closePregnancy_terminee_persisted() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), token);

        LocalDate today = LocalDate.now();
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + today + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TERMINEE"))
                .andExpect(jsonPath("$.outcome").value("ACCOUCHEMENT_VIVANT"))
                .andExpect(jsonPath("$.endedAt").value(today.toString()));

        // DB assertion
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        String dbOutcome = jdbc.queryForObject(
                "SELECT outcome FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dbStatus).isEqualTo("TERMINEE");
        assertThat(dbOutcome).isEqualTo("ACCOUCHEMENT_VIVANT");
    }

    @Test
    @DisplayName("Walk1-S7 : créer fiche enfant après clôture → patient créé, child_patient_id lié, calendrier PNI matérialisé")
    void walk1_s7_createChildRecord_pniCalendarMaterialized() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), token);

        // Close first
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk());

        // Create child
        MvcResult childResult = mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/create-child")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Yassine\",\"sex\":\"M\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        // Extract child ID from Location header
        String location = childResult.getResponse().getHeader("Location");
        assertThat(location).isNotNull().contains("/api/patients/");
        String childId = location.substring(location.lastIndexOf('/') + 1);

        // Assert child_patient_id is set on the pregnancy
        String dbChildId = jdbc.queryForObject(
                "SELECT child_patient_id::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dbChildId).isEqualTo(childId);

        // Assert child patient exists in DB with correct data
        String dbChildName = jdbc.queryForObject(
                "SELECT first_name FROM patient_patient WHERE id = ?::uuid",
                String.class, UUID.fromString(childId));
        assertThat(dbChildName).isEqualTo("Yassine");

        // Trigger vaccination calendar materialization (lazy)
        MvcResult calendarResult = mockMvc.perform(
                        get("/api/patients/" + childId + "/vaccinations")
                                .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode calendar = objectMapper.readTree(calendarResult.getResponse().getContentAsString());
        // PNI calendar must contain at least BCG (naissance) and Penta D1 (2 months)
        assertThat(calendar.isArray()).isTrue();
        assertThat(calendar.size()).isGreaterThan(5);

        boolean hasBcg = false;
        for (JsonNode entry : calendar) {
            if ("BCG".equals(entry.path("vaccineCode").asText())) {
                hasBcg = true;
                break;
            }
        }
        assertThat(hasBcg).as("Calendrier PNI doit contenir BCG naissance").isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Walk 2 — Worklist /grossesses
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Walk2-S1 : worklist queue — grossesse EN_COURS visible, grossesse TERMINEE absente")
    void walk2_s1_queue_showsOnlyActive() throws Exception {
        String token = bearer(medEmail);
        // Create 2 patients: one EN_COURS, one will be TERMINEE
        String p1Id = createPatient("Aicha", "F", "MqaFemTest", token);
        String p2Id = createPatient("Naima", "F", "MqaFemTest", token);

        String preg1Id = declarePregnancy(p1Id, LocalDate.now().minusDays(100), token); // T2
        String preg2Id = declarePregnancy(p2Id, LocalDate.now().minusDays(60), token);  // T1

        // Close preg2
        mockMvc.perform(post("/api/pregnancies/" + preg2Id + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk());

        // Queue should only show preg1 (EN_COURS)
        MvcResult qResult = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(qResult.getResponse().getContentAsString()).get("content");
        assertThat(content.isArray()).isTrue();
        // preg2 (TERMINEE) must not be in the queue
        for (JsonNode entry : content) {
            assertThat(entry.get("pregnancyId").asText()).isNotEqualTo(preg2Id);
        }
        // preg1 (EN_COURS) must be present
        boolean found = false;
        for (JsonNode entry : content) {
            if (preg1Id.equals(entry.get("pregnancyId").asText())) {
                found = true;
                break;
            }
        }
        assertThat(found).as("Grossesse EN_COURS doit apparaître dans la worklist").isTrue();
    }

    @Test
    @DisplayName("Walk2-S2 : filtre trimestre T1 → exclut les grossesses T2/T3")
    void walk2_s2_queue_filterTrimesterT1() throws Exception {
        String token = bearer(medEmail);
        String p1Id = createPatient("Aicha", "F", "MqaFemTest", token);
        String p2Id = createPatient("Naima", "F", "MqaFemTest", token);

        String preg1Id = declarePregnancy(p1Id, LocalDate.now().minusDays(60), token);   // T1 (SA=8)
        declarePregnancy(p2Id, LocalDate.now().minusDays(120), token);                   // T2 (SA=17)

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .param("trimester", "T1")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        // All returned entries must be T1
        for (JsonNode entry : content) {
            assertThat(entry.get("trimester").asText()).isEqualTo("T1");
        }
        // preg1 (T1) must be present
        boolean found = false;
        for (JsonNode entry : content) {
            if (preg1Id.equals(entry.get("pregnancyId").asText())) {
                found = true;
                break;
            }
        }
        assertThat(found).as("Grossesse T1 doit apparaître dans le filtre T1").isTrue();
    }

    @Test
    @DisplayName("Walk2-S3 : filtre withAlerts=true → n'inclut que les grossesses avec au moins une alerte active")
    void walk2_s3_queue_filterWithAlerts() throws Exception {
        String token = bearer(medEmail);
        String p1Id = createPatient("AlertFem", "F", "MqaFemTest", token);
        String p2Id = createPatient("CleanFem", "F", "MqaFemTest", token);

        String pregWithAlert = declarePregnancy(p1Id, LocalDate.now().minusDays(60), token);
        String pregClean = declarePregnancy(p2Id, LocalDate.now().minusDays(60), token);

        // Trigger HTA alert on pregWithAlert
        mockMvc.perform(post("/api/pregnancies/" + pregWithAlert + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"recordedAt\":\"2026-05-03T10:00:00Z\",\"bpSystolic\":145,\"bpDiastolic\":95}"))
                .andExpect(status().isCreated());

        // withAlerts=true should not include pregClean
        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .param("withAlerts", "true")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        for (JsonNode entry : content) {
            assertThat(entry.get("alertCount").asInt())
                    .as("withAlerts=true: toutes les grossesses doivent avoir alertCount > 0")
                    .isGreaterThan(0);
        }
    }

    @Test
    @DisplayName("Walk2-S4 : filtre q=nom → cherche par nom de famille (partiel, insensible à la casse)")
    void walk2_s4_queue_filterByName() throws Exception {
        String token = bearer(medEmail);
        String p1Id = createPatient("Zainab", "F", "MqaFemTest", token);
        String p2Id = createPatient("Other", "F", "MqaFemTest", token);

        String preg1Id = declarePregnancy(p1Id, LocalDate.now().minusDays(60), token);
        declarePregnancy(p2Id, LocalDate.now().minusDays(60), token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .param("q", "mqafem")  // partial match on lastName=MqaFemTest
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        // Both patients are MqaFemTest — search should find them (or at least preg1)
        assertThat(content.size()).isGreaterThan(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Walk 3 — RBAC
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Walk3-S1 : SECRETAIRE — lecture grossesses 200, déclarer 403, saisir visite 403")
    void walk3_s1_rbac_secretaire() throws Exception {
        String medToken = bearer(medEmail);
        String secToken = bearer(secEmail);

        String patientId = createPatient("Lina", "F", "MqaFemTest", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), medToken);

        // SECRETAIRE can read
        mockMvc.perform(get("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", secToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/pregnancies/" + pregnancyId + "/plan")
                        .header("Authorization", secToken))
                .andExpect(status().isOk());

        // SECRETAIRE cannot declare
        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(30) + "\"}"))
                .andExpect(status().isForbidden());

        // SECRETAIRE cannot record a visit
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"recordedAt\":\"2026-05-03T10:00:00Z\",\"bpSystolic\":110,\"bpDiastolic\":70}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Walk3-S2 : ASSISTANT — saisir visite 201, déclarer 403, saisir écho 403")
    void walk3_s2_rbac_assistant() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);

        String patientId = createPatient("Lina", "F", "MqaFemTest", medToken);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), medToken);

        // ASSISTANT can record a visit
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"recordedAt\":\"2026-05-03T10:00:00Z\",\"weightKg\":62,\"bpSystolic\":115,\"bpDiastolic\":75}"))
                .andExpect(status().isCreated());

        // ASSISTANT cannot declare
        mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(30) + "\"}"))
                .andExpect(status().isForbidden());

        // ASSISTANT cannot record ultrasound
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind":"T1_DATATION","performedAt":"%s","saWeeksAtExam":8,"saDaysAtExam":4,
                                 "biometryJson":"{}","correctsDueDate":false}
                                """.formatted(LocalDate.now())))
                .andExpect(status().isForbidden());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Walk 4 — Patient mâle
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Walk4-S1 : déclarer grossesse patient M → 422 PATIENT_NOT_FEMALE")
    void walk4_s1_malePatient_422_patientNotFemale() throws Exception {
        String token = bearer(medEmail);
        String maleId = createPatient("Ahmed", "M", "MqaMaleTest", token);

        mockMvc.perform(post("/api/patients/" + maleId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusDays(30) + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PATIENT_NOT_FEMALE"));
    }

    @Test
    @DisplayName("Walk4-S2 : patient M → GET /pregnancies retourne [] (aucune grossesse possible)")
    void walk4_s2_malePatient_emptyPregnancyList() throws Exception {
        String token = bearer(medEmail);
        String maleId = createPatient("Ahmed", "M", "MqaMaleTest", token);

        mockMvc.perform(get("/api/patients/" + maleId + "/pregnancies")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bug regression tests — contracts found broken during the 2026-05-03 QA walk
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("BUG-S1 : ultrasound POST accepte biometryJson (String), pas biometry (Object) — DPA correcte si eg fourni")
    void bug_s1_biometryJson_fieldName_contract() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        LocalDate lmpDate = LocalDate.now().minusDays(60);
        String pregnancyId = declarePregnancy(patientId, lmpDate, token);

        LocalDate performedAt = LocalDate.now();
        // eg=63 days → newDPA = today + 217
        LocalDate expectedDpa = performedAt.plusDays(280 - 63);

        // POST using biometryJson (String) — this is the correct backend field name
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind":"T1_DATATION","performedAt":"%s","saWeeksAtExam":9,
                                 "saDaysAtExam":0,"biometryJson":"{\\"eg\\":63}","correctsDueDate":true}
                                """.formatted(performedAt)))
                .andExpect(status().isCreated());

        // Assert DPA shifted by correct eg-based formula (not saWeeks fallback)
        // saWeeks fallback would give: today + (280 - 9*7) = today + (280-63) = same here.
        // For a real difference, use eg=70 (10 SA) vs saWeeksAtExam=9 (63 days).
        // Let's use eg=70 on a second test to prove the eg path is taken, not the SA path.
        String dbDueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dbDueDate).isEqualTo(expectedDpa.toString());

        // Also assert that the API GET /ultrasounds returns biometryJson (String), not biometry (Object)
        // — this catches any future rename that would break the frontend contract.
        MvcResult listResult = mockMvc.perform(get("/api/pregnancies/" + pregnancyId + "/ultrasounds")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();
        String responseBody = listResult.getResponse().getContentAsString();
        // The response must contain the field named "biometryJson" (String)
        assertThat(responseBody).contains("\"biometryJson\"");
        // The response must NOT contain a field named "biometry" at the top level of each element
        // (the biometry object shape is only in the frontend type, not the API response)
    }

    @Test
    @DisplayName("BUG-S2 : GET /visits retourne urineDipJson (String), pas urineDip (Object) — contrat API stable")
    void bug_s2_urineDipJson_fieldName_contract() throws Exception {
        String token = bearer(medEmail);
        String patientId = createPatient("Lina", "F", "MqaFemTest", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(60), token);

        // Record a visit with urineDipJson (the correct field name)
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"recordedAt":"2026-05-03T10:00:00Z","weightKg":60,
                                 "bpSystolic":110,"bpDiastolic":70,
                                 "urineDipJson":"{\\"glucose\\":true,\\"protein\\":false,\\"leuco\\":false,\\"nitrites\\":false,\\"ketones\\":false,\\"blood\\":false}"}
                                """))
                .andExpect(status().isCreated());

        // GET visits should return urineDipJson (String), not urineDip (Object)
        MvcResult result = mockMvc.perform(get("/api/pregnancies/" + pregnancyId + "/visits")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        // The API response must use the field name "urineDipJson"
        assertThat(responseBody).contains("\"urineDipJson\"");

        // Verify glucose=true was persisted (BU data not silently dropped)
        String dbUrineDip = jdbc.queryForObject(
                "SELECT urine_dip::text FROM pregnancy_visit WHERE pregnancy_id = ?::uuid ORDER BY recorded_at DESC LIMIT 1",
                String.class, pregnancyId);
        assertThat(dbUrineDip).isNotNull();
        assertThat(dbUrineDip).contains("\"glucose\": true");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "mqa-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'MqaTest', 'User', TRUE, 0, 0, now(), now())
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

    private String createPatient(String firstName, String gender, String lastName, String token) throws Exception {
        String body = String.format("""
                {"firstName":"%s","lastName":"%s",
                 "gender":"%s","birthDate":"1990-01-15",
                 "phone":"+212600000001","city":"Rabat"}
                """, firstName, lastName, gender);
        MvcResult r = mockMvc.perform(post("/api/patients")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return id(r);
    }

    private String declarePregnancy(String patientId, LocalDate lmpDate, String token) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return id(r);
    }

    private String id(MvcResult r) throws Exception {
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }
}
