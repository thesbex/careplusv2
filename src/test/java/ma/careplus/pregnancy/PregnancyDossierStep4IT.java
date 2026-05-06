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
 * Manual QA integration tests for commit 1fe5d58:
 * "feat(grossesse): frontend Étape 4 — onglet dossier + drawers visite/écho".
 *
 * <h2>Scenario catalogue — walked in browser + bottled as ITs</h2>
 * <ol>
 *   <li>S1  Happy path — POST /visits avec urineDipJson sérialisé correctement →
 *           201, urineDip persisted en DB (garde contre bug de nom de champ)</li>
 *   <li>S2  Happy path — POST /visits sans BU → 201, urine_dip colonne NULL en DB</li>
 *   <li>S3  Happy path — POST /ultrasounds avec biometryJson sérialisé correctement →
 *           201, biometry_json persisted en DB</li>
 *   <li>S4  correctsDueDate=true + T1_DATATION + biometryJson.eg → DPA ajustée en DB</li>
 *   <li>S5  correctsDueDate=false (ou kind != T1_DATATION) → DPA inchangée</li>
 *   <li>S6  GUARD visit — TA systolique hors plage (250 > 220) → 400 bean-validation</li>
 *   <li>S7  GUARD visit — grossesse TERMINEE → 422 PREGNANCY_NOT_ACTIVE (état inchangé en DB)</li>
 *   <li>S8  GUARD ultrasound — saWeeksAtExam=4 (schema zod dit min=4, backend dit min=6)
 *           → 422 SA_TOO_EARLY (contrat backend + détection de la divergence zod vs backend)</li>
 *   <li>S9  GUARD ultrasound — grossesse inconnue → 404 PREGNANCY_NOT_FOUND</li>
 *   <li>S10 RBAC visit — SECRETAIRE → 403, ASSISTANT → 201</li>
 *   <li>S11 RBAC ultrasound — ASSISTANT → 403, MEDECIN → 201</li>
 *   <li>S12 Plan de visites — 8 entrées PLANIFIEE après déclaration (onglet plan chips)</li>
 *   <li>S13 Alerte HTA_GRAVIDIQUE — alerte apparaît après visite TA=145/95 (bandeau alertes)</li>
 *   <li>S14 GET /patients/{id}/pregnancies pour patient M → liste vide (onglet masqué)</li>
 *   <li>S15 GET /patients/{id}/pregnancies/current → 404 si aucune grossesse en cours
 *           (onglet affiche empty state avec CTA "Déclarer")</li>
 *   <li>S16 Propagation cache — après POST /visits, GET /visits retourne la nouvelle
 *           visite (valide que le cache TanStack Query serait invalidé)</li>
 *   <li>S17 BUG-CONTRACT — POST /visits avec champ "urineDip" (objet) au lieu de
 *           "urineDipJson" (string) → urine_dip colonne NULL en DB (démontre le bug
 *           frontend qui est déjà connu, bloqué ici pour régression)</li>
 *   <li>S18 BUG-CONTRACT — POST /ultrasounds avec champ "biometry" (objet) au lieu de
 *           "biometryJson" (string) → biometry_json colonne NULL en DB (même bug,
 *           même logique, DPA correction silently use SA fallback)</li>
 * </ol>
 *
 * <h2>REGRESSION GUARD</h2>
 * <ul>
 *   <li>2026-05-06 — Le drawer {@code PregnancyVisitDrawer} envoie {@code urineDip: object}
 *       alors que le backend attend {@code urineDipJson: string}. La bandelette urinaire est
 *       silencieusement ignorée par Jackson (champ inconnu). S17 le démontre explicitement :
 *       POST avec {@code urineDip} → urine_dip = NULL en DB, HTTP 201 (pas d'erreur visible).
 *       Fix attendu : sérialiser l'objet en JSON string côté frontend avant d'envoyer.</li>
 *   <li>2026-05-06 — Le drawer {@code PregnancyUltrasoundDrawer} envoie {@code biometry: object}
 *       alors que le backend attend {@code biometryJson: string}. La biométrie est silencieusement
 *       ignorée, et la correction DPA par {@code eg} ne fonctionnera jamais (fallback SA).
 *       S18 le démontre : POST avec {@code biometry} → biometry_json = NULL en DB.
 *       Fix attendu : sérialiser l'objet en JSON string côté frontend avant d'envoyer.</li>
 *   <li>2026-05-06 — Divergence zod vs backend pour saWeeksAtExam : le schema frontend
 *       autorise min=4, le backend rejette avec SA_TOO_EARLY tout ce qui est strictement < 6.
 *       S8 fixe ce contrat côté IT. Le schema zod doit être aligné sur min=6.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyDossierStep4IT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_step4_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "Step4-Test-2026!";
    private static final String LAST_NAME = "StepFourTest";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    String asstEmail;

    // ─────────────────────────────────────────────────────────────────────────
    // Setup — FK-safe cleanup then seed users
    // ─────────────────────────────────────────────────────────────────────────

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // FK-safe cleanup in dependency order
        jdbc.update("""
                DELETE FROM pregnancy_visit
                WHERE pregnancy_id IN (
                    SELECT id FROM pregnancy WHERE patient_id IN (
                        SELECT id FROM patient_patient WHERE last_name = ?))
                """, LAST_NAME);
        jdbc.update("""
                DELETE FROM pregnancy_ultrasound
                WHERE pregnancy_id IN (
                    SELECT id FROM pregnancy WHERE patient_id IN (
                        SELECT id FROM patient_patient WHERE last_name = ?))
                """, LAST_NAME);
        jdbc.update("""
                DELETE FROM pregnancy_visit_plan
                WHERE pregnancy_id IN (
                    SELECT id FROM pregnancy WHERE patient_id IN (
                        SELECT id FROM patient_patient WHERE last_name = ?))
                """, LAST_NAME);
        jdbc.update("""
                DELETE FROM pregnancy
                WHERE patient_id IN (
                    SELECT id FROM patient_patient WHERE last_name = ?)
                """, LAST_NAME);
        jdbc.update("UPDATE patient_patient SET photo_document_id = NULL WHERE last_name = ?", LAST_NAME);
        jdbc.update("DELETE FROM patient_patient WHERE last_name = ?", LAST_NAME);

        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'stepfour-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'stepfour-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'stepfour-test-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S1 — urineDipJson (correct field name) → BU persisted
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S1 : POST /visits avec urineDipJson (String) → 201, urine_dip persisted avec glucose=true en DB")
    void s1_postVisit_urineDipJson_persisted() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Amina", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(60), medToken);

        MvcResult res = mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "weightKg": 65.5,
                                  "bpSystolic": 110,
                                  "bpDiastolic": 70,
                                  "urineDipJson": "{\\"glucose\\":true,\\"protein\\":false,\\"leuco\\":false,\\"nitrites\\":false,\\"ketones\\":false,\\"blood\\":false}"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.urineDipJson").isString())
                .andReturn();

        String visitId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // Assert BU data persisted in DB — not silently dropped
        String dbUrineDip = jdbc.queryForObject(
                "SELECT urine_dip::text FROM pregnancy_visit WHERE id = ?::uuid",
                String.class, visitId);
        assertThat(dbUrineDip).isNotNull();
        assertThat(dbUrineDip).contains("glucose");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S2 — POST visit sans BU → urine_dip NULL en DB
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S2 : POST /visits sans urineDipJson → 201, urine_dip NULL en DB")
    void s2_postVisit_noUrineDip_null() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Lina", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(70), medToken);

        MvcResult res = mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\": 62.0}"))
                .andExpect(status().isCreated())
                .andReturn();

        String visitId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        Object dbUrineDip = jdbc.queryForObject(
                "SELECT urine_dip FROM pregnancy_visit WHERE id = ?::uuid",
                Object.class, visitId);
        assertThat(dbUrineDip).isNull();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S3 — biometryJson (correct field name) → biometry persisted
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S3 : POST /ultrasounds avec biometryJson (String) → 201, biometry_json persisted en DB avec bip")
    void s3_postUltrasound_biometryJson_persisted() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Khadija", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(84), medToken);

        MvcResult res = mockMvc.perform(post("/api/pregnancies/" + pregId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "kind": "T1_DATATION",
                                  "performedAt": "%s",
                                  "saWeeksAtExam": 12,
                                  "saDaysAtExam": 0,
                                  "biometryJson": "{\\"bip\\":22.5,\\"eg\\":84}",
                                  "correctsDueDate": false
                                }
                                """.formatted(LocalDate.now())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.biometryJson").isString())
                .andReturn();

        String echoId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        String dbBiometry = jdbc.queryForObject(
                "SELECT biometry::text FROM pregnancy_ultrasound WHERE id = ?::uuid",
                String.class, echoId);
        assertThat(dbBiometry).isNotNull();
        assertThat(dbBiometry).contains("bip");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S4 — correctsDueDate=true + T1 + eg → DPA ajustée
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S4 : POST /ultrasounds T1 + correctsDueDate=true + eg=70 → DPA = performedAt+210, dueDateSource=ECHO_T1")
    void s4_ultrasoundT1_correctsDueDate_dpaAdjusted() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Nadia", medToken);
        LocalDate lmpDate = LocalDate.now().minusDays(70);
        String pregId     = declarePregnancy(patientId, lmpDate, medToken);

        LocalDate performedAt = LocalDate.now();
        int egDays = 70; // 10 SA exactly
        LocalDate expectedDpa = performedAt.plusDays(280 - egDays);

        mockMvc.perform(post("/api/pregnancies/" + pregId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "kind": "T1_DATATION",
                                  "performedAt": "%s",
                                  "saWeeksAtExam": 10,
                                  "saDaysAtExam": 0,
                                  "biometryJson": "{\\"eg\\":%d}",
                                  "correctsDueDate": true
                                }
                                """.formatted(performedAt, egDays)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.correctsDueDate").value(true));

        // Assert DPA corrected in DB
        String dbDueDate = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregId);
        assertThat(dbDueDate).isEqualTo(expectedDpa.toString());

        String dbSource = jdbc.queryForObject(
                "SELECT due_date_source FROM pregnancy WHERE id = ?::uuid",
                String.class, pregId);
        assertThat(dbSource).isEqualTo("ECHO_T1");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S5 — correctsDueDate=false → DPA inchangée
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S5 : POST /ultrasounds T2_MORPHO (correctsDueDate=false) → DPA inchangée, dueDateSource=NAEGELE")
    void s5_ultrasoundT2_noCorrection_dpaUnchanged() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Sara", medToken);
        LocalDate lmpDate = LocalDate.now().minusDays(140);
        String pregId     = declarePregnancy(patientId, lmpDate, medToken);

        String originalDpa = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregId);

        mockMvc.perform(post("/api/pregnancies/" + pregId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "kind": "T2_MORPHO",
                                  "performedAt": "%s",
                                  "saWeeksAtExam": 20,
                                  "saDaysAtExam": 0,
                                  "findings": "Morphologie normale",
                                  "correctsDueDate": false
                                }
                                """.formatted(LocalDate.now())))
                .andExpect(status().isCreated());

        String dpa = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregId);
        assertThat(dpa).isEqualTo(originalDpa);

        String source = jdbc.queryForObject(
                "SELECT due_date_source FROM pregnancy WHERE id = ?::uuid",
                String.class, pregId);
        assertThat(source).isEqualTo("NAEGELE");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S6 — TA hors plage → 400 bean-validation (premier garde)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S6 : POST /visits avec bpSystolic=250 (> 220) → 400 bean-validation, aucune visite créée")
    void s6_visitVitalsOutOfRange_400_nothingPersisted() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Rim", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(56), medToken);

        mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\": 250}"))
                .andExpect(status().isBadRequest());

        // Assert no visit was created
        Integer visitCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit WHERE pregnancy_id = ?::uuid",
                Integer.class, pregId);
        assertThat(visitCount).isEqualTo(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S7 — grossesse TERMINEE → 422 PREGNANCY_NOT_ACTIVE, visite non créée
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S7 : POST /visits sur grossesse TERMINEE → 422 PREGNANCY_NOT_ACTIVE, aucune visite créée en DB")
    void s7_visitOnTerminatedPregnancy_422_nothingPersisted() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Fatima", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(270), medToken);

        // Clôturer la grossesse
        mockMvc.perform(post("/api/pregnancies/" + pregId + "/close")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk());

        // Tenter une visite sur la grossesse terminée
        mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\": 70.0}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PREGNANCY_NOT_ACTIVE"));

        // DB: aucune visite créée sur cette grossesse
        Integer visitCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit WHERE pregnancy_id = ?::uuid",
                Integer.class, pregId);
        assertThat(visitCount).isEqualTo(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S8 — saWeeksAtExam=4 (zod min=4, backend rejects < 6) → 422 SA_TOO_EARLY
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S8 : POST /ultrasounds avec saWeeksAtExam=4 → 422 SA_TOO_EARLY (divergence zod min=4 vs backend min=6)")
    void s8_ultrasoundSaTooEarly_422() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Zineb", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(28), medToken);

        mockMvc.perform(post("/api/pregnancies/" + pregId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "kind": "T1_DATATION",
                                  "performedAt": "%s",
                                  "saWeeksAtExam": 4,
                                  "saDaysAtExam": 0,
                                  "correctsDueDate": false
                                }
                                """.formatted(LocalDate.now())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("SA_TOO_EARLY"));

        // Assert no ultrasound created
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_ultrasound WHERE pregnancy_id = ?::uuid",
                Integer.class, pregId);
        assertThat(count).isEqualTo(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S9 — grossesse inconnue → 404
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S9 : POST /ultrasounds sur grossesse inconnue → 404 PREGNANCY_NOT_FOUND")
    void s9_ultrasoundUnknownPregnancy_404() throws Exception {
        String medToken = bearer(medEmail);
        String unknown  = UUID.randomUUID().toString();

        mockMvc.perform(post("/api/pregnancies/" + unknown + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "kind": "T2_MORPHO",
                                  "performedAt": "%s",
                                  "saWeeksAtExam": 20,
                                  "saDaysAtExam": 0,
                                  "correctsDueDate": false
                                }
                                """.formatted(LocalDate.now())))
                .andExpect(status().isNotFound());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S10 — RBAC visite : SECRETAIRE 403, ASSISTANT 201
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S10 : RBAC /visits — SECRETAIRE → 403, ASSISTANT → 201 (onglet RBAC inline conforme)")
    void s10_rbacVisit_secretaire403_assistant201() throws Exception {
        String medToken  = bearer(medEmail);
        String secToken  = bearer(secEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Hind", medToken);
        String pregId    = declarePregnancy(patientId, LocalDate.now().minusDays(70), medToken);

        String visitBody = "{\"weightKg\": 60.0}";

        // SECRETAIRE → 403
        mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(visitBody))
                .andExpect(status().isForbidden());

        // ASSISTANT → 201
        mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(visitBody))
                .andExpect(status().isCreated());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S11 — RBAC écho : ASSISTANT 403, MEDECIN 201
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S11 : RBAC /ultrasounds — ASSISTANT → 403, MEDECIN → 201 (RBAC inline conforme)")
    void s11_rbacUltrasound_assistant403_medecin201() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);
        String patientId = createFemalePatient("Mariam", medToken);
        String pregId    = declarePregnancy(patientId, LocalDate.now().minusDays(84), medToken);

        String echoBody = """
                {
                  "kind": "T1_DATATION",
                  "performedAt": "%s",
                  "saWeeksAtExam": 12,
                  "saDaysAtExam": 0,
                  "correctsDueDate": false
                }
                """.formatted(LocalDate.now());

        // ASSISTANT → 403
        mockMvc.perform(post("/api/pregnancies/" + pregId + "/ultrasounds")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(echoBody))
                .andExpect(status().isForbidden());

        // MEDECIN → 201
        mockMvc.perform(post("/api/pregnancies/" + pregId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(echoBody))
                .andExpect(status().isCreated());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S12 — Plan de visites : 8 chips PLANIFIEE après déclaration
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S12 : GET /plan après déclaration → 8 entrées PLANIFIEE (chips timeline onglet grossesse)")
    void s12_planAfterDeclaration_8PlanifieeChips() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Zainab", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(60), medToken);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/" + pregId + "/plan")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8))
                .andReturn();

        JsonNode plan = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode entry : plan) {
            assertThat(entry.get("status").asText()).isEqualTo("PLANIFIEE");
        }

        // DB count
        Integer dbCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pregnancy_visit_plan WHERE pregnancy_id = ?::uuid AND status = 'PLANIFIEE'",
                Integer.class, pregId);
        assertThat(dbCount).isEqualTo(8);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S13 — Bandeau alertes : HTA après TA=145/95
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S13 : visite TA=145/95 → alerte HTA_GRAVIDIQUE dans GET /alerts (bandeau alertes onglet grossesse)")
    void s13_htaVisit_htaGravidique_alertActive() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Aicha", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(120), medToken);

        mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\": 145, \"bpDiastolic\": 95}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/pregnancies/" + pregId + "/alerts")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'HTA_GRAVIDIQUE')]").exists());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S14 — Patient M → liste grossesses vide (onglet masqué)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S14 : GET /patients/{id}/pregnancies pour patient M → [] (onglet Grossesse masqué)")
    void s14_malePatient_pregnancyListEmpty() throws Exception {
        String medToken  = bearer(medEmail);
        String maleId    = createMalePatient("Ahmed", medToken);

        mockMvc.perform(get("/api/patients/" + maleId + "/pregnancies")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S15 — Pas de grossesse en cours → 404 (empty state "Déclarer")
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S15 : GET /pregnancies/current sans grossesse EN_COURS → 404 PREGNANCY_NOT_FOUND (empty state)")
    void s15_noCurrentPregnancy_404() throws Exception {
        String medToken  = bearer(medEmail);
        String patientId = createFemalePatient("Naima", medToken);

        mockMvc.perform(get("/api/patients/" + patientId + "/pregnancies/current")
                        .header("Authorization", medToken))
                .andExpect(status().isNotFound());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S16 — Propagation cache : GET /visits retourne la visite après POST
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S16 : POST /visits → GET /visits retourne 1 visite (propagation cache TanStack Query)")
    void s16_visitCreated_listReturnsIt() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Layla", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(60), medToken);

        mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\": 67.5, \"bpSystolic\": 115, \"bpDiastolic\": 75}"))
                .andExpect(status().isCreated());

        MvcResult list = mockMvc.perform(get("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(list.getResponse().getContentAsString()).get("content");
        assertThat(content.isArray()).isTrue();
        assertThat(content.size()).isEqualTo(1);
        assertThat(content.get(0).get("weightKg").asDouble()).isEqualTo(67.5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S17 — BUG-CONTRACT : urineDip (object) silently dropped → urine_dip NULL
    // Demonstrates the bug present in PregnancyVisitDrawer as of commit 1fe5d58
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S17 : BUG — POST /visits avec 'urineDip' (objet, mauvais nom) → urine_dip NULL en DB (BU silencieusement ignorée)")
    void s17_bug_urineDipObjectNotString_silentlyDropped() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Selma", medToken);
        String pregId     = declarePregnancy(patientId, LocalDate.now().minusDays(60), medToken);

        // Send "urineDip" (object) — what the frontend sends in commit 1fe5d58
        // Jackson ignores unknown fields by default → returns 201 silently
        MvcResult res = mockMvc.perform(post("/api/pregnancies/" + pregId + "/visits")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "weightKg": 65.0,
                                  "urineDip": {
                                    "glucose": true,
                                    "protein": false,
                                    "leuco": false,
                                    "nitrites": false,
                                    "ketones": false,
                                    "blood": false
                                  }
                                }
                                """))
                // Backend returns 201 — the bug is silent
                .andExpect(status().isCreated())
                .andReturn();

        String visitId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // DB: urine_dip is NULL because "urineDip" is not a known field on RecordVisitRequest
        Object dbUrineDip = jdbc.queryForObject(
                "SELECT urine_dip FROM pregnancy_visit WHERE id = ?::uuid",
                Object.class, visitId);
        assertThat(dbUrineDip)
                .as("BUG 2026-05-06: champ 'urineDip' (objet) ignoré par Jackson — "
                        + "urine_dip=NULL en DB. Le drawer doit sérialiser en JSON string "
                        + "et envoyer 'urineDipJson' (string) pour persister la BU.")
                .isNull();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S18 — BUG-CONTRACT : biometry (object) silently dropped → biometry_json NULL
    // Demonstrates the bug present in PregnancyUltrasoundDrawer as of commit 1fe5d58
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S18 : BUG — POST /ultrasounds avec 'biometry' (objet, mauvais nom) → biometry_json NULL, DPA non corrigée")
    void s18_bug_biometryObjectNotString_silentlyDropped() throws Exception {
        String medToken   = bearer(medEmail);
        String patientId  = createFemalePatient("Ghita", medToken);
        LocalDate lmpDate = LocalDate.now().minusDays(70);
        String pregId     = declarePregnancy(patientId, lmpDate, medToken);

        String naegueleDpa = lmpDate.plusDays(280).toString();

        // Send "biometry" (object) — what PregnancyUltrasoundDrawer sends in commit 1fe5d58
        // correctsDueDate=true + eg=70 should shift DPA, but since "biometry" is unknown,
        // biometryJson is null → extractEgDays falls back to saWeeksAtExam*7+saDaysAtExam = 70
        // which happens to be the same as eg=70 here, so DPA formula still shifts.
        // BUT biometry_json in DB is NULL — biometric data is lost.
        MvcResult res = mockMvc.perform(post("/api/pregnancies/" + pregId + "/ultrasounds")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "kind": "T1_DATATION",
                                  "performedAt": "%s",
                                  "saWeeksAtExam": 10,
                                  "saDaysAtExam": 0,
                                  "biometry": {
                                    "bip": 22.5,
                                    "eg": 75
                                  },
                                  "correctsDueDate": true
                                }
                                """.formatted(LocalDate.now())))
                // Backend returns 201 — the bug is silent
                .andExpect(status().isCreated())
                .andReturn();

        String echoId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // DB: biometry is NULL — biometric measurements (BIP, EG) are lost
        Object dbBiometry = jdbc.queryForObject(
                "SELECT biometry FROM pregnancy_ultrasound WHERE id = ?::uuid",
                Object.class, echoId);
        assertThat(dbBiometry)
                .as("BUG 2026-05-06: champ 'biometry' (objet) ignoré par Jackson — "
                        + "biometry_json=NULL en DB. Le drawer doit sérialiser JSON.stringify(biometry) "
                        + "et envoyer 'biometryJson' (string) pour persister les mesures.")
                .isNull();

        // Additionally: because biometryJson=null, the actual eg used is saWeeks*7+saDays=70,
        // not the eg=75 from the object. When eg differs from saWeeks*7, DPA silently uses wrong eg.
        // Verify DPA used the SA-based fallback (saWeeks=10, saDays=0 → 70 days)
        // Expected DPA = today + (280-70) = today + 210
        String dbDpa = jdbc.queryForObject(
                "SELECT due_date::text FROM pregnancy WHERE id = ?::uuid",
                String.class, pregId);
        LocalDate expectedFallbackDpa = LocalDate.now().plusDays(280 - 70); // SA fallback
        assertThat(dbDpa)
                .as("DPA calculée par fallback SA (saWeeks=10, eg=75 dans biometry ignoré)")
                .isEqualTo(expectedFallbackDpa.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "stepfour-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Step4', 'TestUser', TRUE, 0, 0, now(), now())
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
                {"firstName":"%s","lastName":"%s",
                 "gender":"F","birthDate":"1992-05-15",
                 "phone":"+212600000099","city":"Rabat"}
                """, firstName, LAST_NAME);
        MvcResult r = mockMvc.perform(post("/api/patients")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private String createMalePatient(String firstName, String token) throws Exception {
        String body = String.format("""
                {"firstName":"%s","lastName":"%s",
                 "gender":"M","birthDate":"1990-03-10",
                 "phone":"+212600000099","city":"Casablanca"}
                """, firstName, LAST_NAME);
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
}
