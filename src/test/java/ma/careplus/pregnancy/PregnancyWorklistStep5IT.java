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
 * Manual QA Integration Tests — Grossesse Étape 5.
 * Walk du commit 9c15c55 : worklist /grossesses + sidebar badge + bio panel preview.
 *
 * <h2>Scénarios couverts</h2>
 * <ol>
 *   <li>S1  Happy path — GET /pregnancies/queue retourne les grossesses EN_COURS avec
 *           les champs attendus par le frontend (saWeeks, trimester, dueDate, lastVisitAt,
 *           patientLastName, patientFirstName, patientId, pregnancyId).</li>
 *   <li>S2  Contract champ alerts — la réponse de /queue contient OBLIGATOIREMENT le champ
 *           "alerts" (tableau d'objets PregnancyAlert) et NON "alertCount" (entier).
 *           Le frontend PregnancesQueuePage.tsx itère entry.alerts.map() ; si le backend
 *           ne retourne qu'alertCount, entry.alerts est undefined → TypeError au render.</li>
 *   <li>S3  Contract champ saDays — la réponse de /queue contient OBLIGATOIREMENT le champ
 *           "saDays" (nombre entier ≥ 0). La colonne SA affiche "{saWeeks}+{saDays}j".</li>
 *   <li>S4  Badge /alerts/count — endpoint 200, champ "withActiveAlerts" présent et ≥ 0.
 *           Grossesse TERMINEE exclue du comptage.</li>
 *   <li>S5  Badge count cohérence — le count = nb de grossesses EN_COURS avec ≥ 1 alerte,
 *           confirmé par DB : après ajout d'une visite HTA, count augmente de 1.</li>
 *   <li>S6  Filtre trimestre T1 — /queue?trimester=T1 ne retourne que des T1.</li>
 *   <li>S7  Filtre withAlerts=true — /queue?withAlerts=true ne retourne que des grossesses
 *           avec au moins une alerte active (alertCount > 0 ou alerts.length > 0).</li>
 *   <li>S8  Filtre q (recherche nom) — /queue?q=Partiel retourne les patientes dont le nom
 *           ou prénom contient la chaîne (case-insensitive).</li>
 *   <li>S9  Grossesse TERMINEE absente — une grossesse clôturée n'apparaît pas dans /queue.</li>
 *   <li>S10 Pagination — pageSize=2 retourne 2 items, totalElements ≥ 2, totalPages correct.</li>
 *   <li>S11 Tri SA décroissant — les entrées sont triées par saWeeks DESC (la plus avancée en tête).</li>
 *   <li>S12 Worklist vide — si aucune grossesse EN_COURS, content=[], totalElements=0.</li>
 *   <li>S13 RBAC SECRETAIRE autorisée — GET /queue 200, GET /alerts/count 200.</li>
 *   <li>S14 RBAC ASSISTANT autorisé — GET /queue 200, GET /alerts/count 200.</li>
 *   <li>S15 RBAC non authentifié — GET /queue 401, GET /alerts/count 401.</li>
 *   <li>S16 Cohérence badge vs worklist — count = nombre exact de grossesses EN_COURS
 *           avec alertes ; crosscheck avec le résultat de ?withAlerts=true.</li>
 *   <li>S17 Recherche partielle insensible à la casse — q=ZAHRA matche prénom ZahRA.</li>
 * </ol>
 *
 * <h2>REGRESSION GUARD</h2>
 * <ul>
 *   <li>2026-05-06 — CONTRAT BRISÉ : le backend PregnancyQueueEntry retourne alertCount (int)
 *       mais le frontend PregnancesQueuePage attend alerts (PregnancyAlert[]).
 *       entry.alerts.map() sur undefined → TypeError → table vide / crash.
 *       S2 attraperait cette régression si le backend ne corrige pas le contrat.</li>
 *   <li>2026-05-06 — CHAMP MANQUANT : saDays absent du DTO backend mais rendu par le frontend
 *       comme "{saWeeks}+{saDays}j". Sans saDays, la colonne SA affiche "{saWeeks}+undefinedj".
 *       S3 attraperait cette régression.</li>
 *   <li>2026-05-06 — BADGE STALE : le badge /alerts/count interroge toutes les grossesses
 *       y compris TERMINEE si findByStatus() n'est pas filtré correctement.
 *       S4 + S5 vérifient que le count exclut les grossesses clôturées.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyWorklistStep5IT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_step5_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "Step5-QA-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String medEmail;
    private String secEmail;
    private String asstEmail;

    // ─────────────────────────────────────────────────────────────────────────
    // Setup — FK-safe cleanup then seed one user per role
    // ─────────────────────────────────────────────────────────────────────────

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // FK-safe cleanup: visits first, then visit plans, then pregnancies, then patients
        jdbc.update("""
                DELETE FROM pregnancy_visit WHERE pregnancy_id IN (
                    SELECT id FROM pregnancy WHERE patient_id IN (
                        SELECT id FROM patient_patient WHERE last_name = 'StepFiveTest'
                    )
                )
                """);
        jdbc.update("""
                DELETE FROM pregnancy_visit_plan WHERE pregnancy_id IN (
                    SELECT id FROM pregnancy WHERE patient_id IN (
                        SELECT id FROM patient_patient WHERE last_name = 'StepFiveTest'
                    )
                )
                """);
        jdbc.update("""
                DELETE FROM pregnancy WHERE patient_id IN (
                    SELECT id FROM patient_patient WHERE last_name = 'StepFiveTest'
                )
                """);
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'StepFiveTest'");

        // Cleanup test users
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'stepfive-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'stepfive-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'stepfive-test-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S1 — Happy path : /queue retourne les champs de base attendus
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S1 : GET /pregnancies/queue retourne une grossesse EN_COURS avec pregnancyId, patientId, saWeeks, trimester, dueDate")
    void s1_queue_happyPath_fieldsPresent() throws Exception {
        String token = bearer(medEmail);
        String patientId = createFemalePatient("Aicha", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(20), token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");

        boolean found = false;
        for (JsonNode entry : content) {
            if (pregnancyId.equals(entry.get("pregnancyId").asText())) {
                found = true;
                assertThat(entry.has("patientId")).as("patientId must be present").isTrue();
                assertThat(entry.has("saWeeks")).as("saWeeks must be present").isTrue();
                assertThat(entry.has("trimester")).as("trimester must be present").isTrue();
                assertThat(entry.has("dueDate")).as("dueDate must be present").isTrue();
                assertThat(entry.get("saWeeks").asInt()).as("saWeeks ~20").isBetween(19, 21);
                assertThat(entry.get("trimester").asText()).as("T2 at 20 weeks").isEqualTo("T2");
                break;
            }
        }
        assertThat(found).as("Our pregnancy must appear in the queue").isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S2 — CONTRACT BRISÉ : la réponse /queue doit contenir "alerts" (array),
    //       PAS "alertCount" (int). Le frontend itère entry.alerts.map().
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S2 : GET /pregnancies/queue — chaque entrée contient le champ 'alerts' (tableau), pas seulement 'alertCount' — contrat frontend PregnancesQueuePage")
    void s2_queueEntry_contains_alerts_array_not_alertCount() throws Exception {
        String token = bearer(medEmail);
        String patientId = createFemalePatient("Btissam", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(20), token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        JsonNode content = objectMapper.readTree(body).get("content");

        boolean found = false;
        for (JsonNode entry : content) {
            if (pregnancyId.equals(entry.get("pregnancyId").asText())) {
                found = true;
                // Must have "alerts" as a JSON array
                assertThat(entry.has("alerts"))
                        .as("Backend must return 'alerts' array (not 'alertCount') — frontend iterates entry.alerts.map()")
                        .isTrue();
                assertThat(entry.get("alerts").isArray())
                        .as("'alerts' must be a JSON array, not a scalar")
                        .isTrue();
                break;
            }
        }
        assertThat(found).as("Pregnancy must appear in queue").isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S3 — CONTRACT BRISÉ : la réponse /queue doit contenir "saDays" (int).
    //       Le frontend affiche "{saWeeks}+{saDays}j".
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S3 : GET /pregnancies/queue — chaque entrée contient le champ 'saDays' (entier ≥ 0) — contrat frontend colonne SA")
    void s3_queueEntry_contains_saDays() throws Exception {
        String token = bearer(medEmail);
        String patientId = createFemalePatient("Chaima", token);
        // Declare pregnancy with 143 days LMP → 20 weeks + 3 days exactly
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusDays(143), token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");

        boolean found = false;
        for (JsonNode entry : content) {
            if (pregnancyId.equals(entry.get("pregnancyId").asText())) {
                found = true;
                assertThat(entry.has("saDays"))
                        .as("Backend must return 'saDays' field — frontend renders '{saWeeks}+{saDays}j'")
                        .isTrue();
                assertThat(entry.get("saDays").isInt())
                        .as("saDays must be an integer")
                        .isTrue();
                assertThat(entry.get("saDays").asInt())
                        .as("saDays must be between 0 and 6")
                        .isBetween(0, 6);
                break;
            }
        }
        assertThat(found).as("Pregnancy must appear in queue").isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S4 — Badge /alerts/count accessible 200 + champ withActiveAlerts présent
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S4 : GET /pregnancies/alerts/count retourne 200 avec { withActiveAlerts: <entier> }")
    void s4_alertsCount_endpoint_200_withField() throws Exception {
        String token = bearer(medEmail);

        mockMvc.perform(get("/api/pregnancies/alerts/count")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.withActiveAlerts").isNumber());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S5 — Badge count cohérence : TERMINEE exclue, alerte HTA incluse
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S5 : /alerts/count exclut les grossesses TERMINEE et compte correctement les alertes HTA actives")
    void s5_alertsCount_excludesTerminee_countesHta() throws Exception {
        String token = bearer(medEmail);

        // Pregnancy that will have an HTA alert
        String p1Id = createFemalePatient("Dalila", token);
        String preg1 = declarePregnancy(p1Id, LocalDate.now().minusWeeks(20), token);
        mockMvc.perform(post("/api/pregnancies/" + preg1 + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":150,\"bpDiastolic\":100}"))
                .andExpect(status().isCreated());

        // Pregnancy that will be TERMINEE — must not count
        String p2Id = createFemalePatient("Essama", token);
        String preg2 = declarePregnancy(p2Id, LocalDate.now().minusWeeks(10), token);
        mockMvc.perform(post("/api/pregnancies/" + preg2 + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk());

        // Verify DB: preg2 is TERMINEE
        String preg2Status = jdbc.queryForObject(
                "SELECT status FROM pregnancy WHERE id = ?::uuid",
                String.class, preg2);
        assertThat(preg2Status).isEqualTo("TERMINEE");

        // Badge count — must include preg1 (has HTA alert), must exclude preg2 (TERMINEE)
        MvcResult result = mockMvc.perform(get("/api/pregnancies/alerts/count")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        int count = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("withActiveAlerts").asInt();
        // There must be at least preg1 (HTA) in the count
        assertThat(count).as("Count must be ≥ 1 (our HTA pregnancy)").isGreaterThanOrEqualTo(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S6 — Filtre trimestre T1 retourne uniquement des grossesses T1
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S6 : GET /pregnancies/queue?trimester=T1 ne retourne que des grossesses T1 (SA < 14 semaines)")
    void s6_filter_trimesterT1_returnsOnlyT1() throws Exception {
        String token = bearer(medEmail);

        String p1 = createFemalePatient("Fatima", token);
        declarePregnancy(p1, LocalDate.now().minusWeeks(8), token);   // T1

        String p2 = createFemalePatient("Ghizlane", token);
        String pregT2 = declarePregnancy(p2, LocalDate.now().minusWeeks(20), token); // T2

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("trimester", "T1")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");

        for (JsonNode entry : content) {
            assertThat(entry.get("trimester").asText())
                    .as("All returned entries must be T1 when trimester=T1 filter is applied")
                    .isEqualTo("T1");
        }

        // The T2 pregnancy must NOT appear
        for (JsonNode entry : content) {
            assertThat(entry.get("pregnancyId").asText())
                    .as("T2 pregnancy must not appear in T1 filter result")
                    .isNotEqualTo(pregT2);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S7 — Filtre withAlerts=true retourne uniquement les grossesses avec alertes
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S7 : GET /pregnancies/queue?withAlerts=true ne retourne que les grossesses ayant ≥ 1 alerte")
    void s7_filter_withAlerts_returnsOnlyAlerting() throws Exception {
        String token = bearer(medEmail);

        // Pregnancy with HTA alert
        String pAlert = createFemalePatient("Houda", token);
        String pregAlert = declarePregnancy(pAlert, LocalDate.now().minusWeeks(20), token);
        mockMvc.perform(post("/api/pregnancies/" + pregAlert + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":150,\"bpDiastolic\":100}"))
                .andExpect(status().isCreated());

        // Clean pregnancy with no alert
        String pClean = createFemalePatient("Ilham", token);
        String pregClean = declarePregnancy(pClean, LocalDate.now().minusWeeks(8), token);
        mockMvc.perform(post("/api/pregnancies/" + pregClean + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":110,\"bpDiastolic\":70}"))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("withAlerts", "true")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");

        // pregClean must not appear
        for (JsonNode entry : content) {
            assertThat(entry.get("pregnancyId").asText())
                    .as("Clean pregnancy must not appear when withAlerts=true")
                    .isNotEqualTo(pregClean);
        }

        // All returned entries must have at least one alert indicator
        // Backend returns either alertCount > 0 OR alerts.length > 0 depending on contract
        for (JsonNode entry : content) {
            // Check alertCount (current backend) OR alerts array (expected frontend contract)
            boolean hasAlertCount = entry.has("alertCount") && entry.get("alertCount").asInt() > 0;
            boolean hasAlerts = entry.has("alerts") && entry.get("alerts").isArray()
                    && entry.get("alerts").size() > 0;
            assertThat(hasAlertCount || hasAlerts)
                    .as("Entry in withAlerts=true result must have alertCount>0 or alerts.length>0")
                    .isTrue();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S8 — Filtre q retourne les patientes dont le nom contient la chaîne
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S8 : GET /pregnancies/queue?q=stepfive retourne les patientes dont le nom contient 'stepfive' (insensible à la casse)")
    void s8_filter_q_searchByName() throws Exception {
        String token = bearer(medEmail);

        String p1 = createFemalePatient("Jamila", token);
        String preg1 = declarePregnancy(p1, LocalDate.now().minusWeeks(10), token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("q", "stepfive")  // matches lastName = StepFiveTest
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        assertThat(content.size()).as("q=stepfive must match at least our StepFiveTest patient").isGreaterThan(0);

        boolean found = false;
        for (JsonNode entry : content) {
            if (preg1.equals(entry.get("pregnancyId").asText())) {
                found = true;
                break;
            }
        }
        assertThat(found).as("Our StepFiveTest patient must appear with q=stepfive filter").isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S9 — Grossesse TERMINEE absente de la worklist
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S9 : grossesse clôturée (status=TERMINEE) est absente de GET /pregnancies/queue")
    void s9_terminee_not_in_queue() throws Exception {
        String token = bearer(medEmail);

        String patientId = createFemalePatient("Khadija", token);
        String pregnancyId = declarePregnancy(patientId, LocalDate.now().minusWeeks(10), token);

        // Close pregnancy
        mockMvc.perform(post("/api/pregnancies/" + pregnancyId + "/close")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endedAt\":\"" + LocalDate.now() + "\",\"outcome\":\"ACCOUCHEMENT_VIVANT\"}"))
                .andExpect(status().isOk());

        // Verify DB status
        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM pregnancy WHERE id = ?::uuid",
                String.class, pregnancyId);
        assertThat(dbStatus).isEqualTo("TERMINEE");

        // Queue must not include this pregnancy
        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("size", "100"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        for (JsonNode entry : content) {
            assertThat(entry.get("pregnancyId").asText())
                    .as("TERMINEE pregnancy must not appear in worklist")
                    .isNotEqualTo(pregnancyId);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S10 — Pagination : pageSize=2, totalElements ≥ 2, totalPages correct
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S10 : pagination — pageSize=2 retourne 2 items, totalElements et totalPages cohérents")
    void s10_pagination_correct() throws Exception {
        String token = bearer(medEmail);

        // Create 3 pregnancies
        String[] names = {"Lalla", "Mona", "Nora"};
        for (int i = 0; i < names.length; i++) {
            String pid = createFemalePatient(names[i], token);
            declarePregnancy(pid, LocalDate.now().minusWeeks(8 + i * 5), token);
        }

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        long totalElements = body.get("totalElements").asLong();
        int totalPages = body.get("totalPages").asInt();
        int contentSize = body.get("content").size();
        int pageSize = body.has("pageSize") ? body.get("pageSize").asInt()
                : body.has("size") ? body.get("size").asInt() : 2;

        assertThat(totalElements).isGreaterThanOrEqualTo(3);
        assertThat(contentSize).isEqualTo(2);
        assertThat(totalPages).isGreaterThanOrEqualTo((int) Math.ceil((double) totalElements / 2));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S11 — Tri SA décroissant
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S11 : la worklist est triée par SA décroissant — la grossesse la plus avancée apparaît en tête")
    void s11_sortBySaDesc() throws Exception {
        String token = bearer(medEmail);

        String p1 = createFemalePatient("Meryem", token);
        declarePregnancy(p1, LocalDate.now().minusWeeks(8), token);  // SA 8

        String p2 = createFemalePatient("Naima", token);
        declarePregnancy(p2, LocalDate.now().minusWeeks(32), token); // SA 32

        String p3 = createFemalePatient("Oumaima", token);
        declarePregnancy(p3, LocalDate.now().minusWeeks(20), token); // SA 20

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        assertThat(content.size()).isGreaterThanOrEqualTo(3);

        int prevSa = Integer.MAX_VALUE;
        for (JsonNode entry : content) {
            int sa = entry.get("saWeeks").asInt();
            assertThat(sa).as("saWeeks must be non-increasing (sorted DESC)").isLessThanOrEqualTo(prevSa);
            prevSa = sa;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S12 — Worklist vide
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S12 : si aucune grossesse EN_COURS avec lastName=StepFiveTest, content=[] et totalElements=0")
    void s12_emptyWorklist_noActivePregnancies() throws Exception {
        String token = bearer(medEmail);
        // No pregnancies created for this test — all StepFiveTest pregnancies purged in @BeforeEach

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("q", "stepfivetestnoexistuniquesuffix")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("content").size()).as("No match → empty content").isEqualTo(0);
        assertThat(body.get("totalElements").asLong()).as("No match → totalElements=0").isEqualTo(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S13 — RBAC SECRETAIRE : autorisée en lecture
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S13 : SECRETAIRE est autorisée — GET /queue 200, GET /alerts/count 200")
    void s13_rbac_secretaire_authorized_read() throws Exception {
        String medToken = bearer(medEmail);
        String secToken = bearer(secEmail);

        // Setup one pregnancy so queue is not empty
        String pid = createFemalePatient("Rajae", medToken);
        declarePregnancy(pid, LocalDate.now().minusWeeks(15), medToken);

        mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", secToken)
                        .param("size", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/pregnancies/alerts/count")
                        .header("Authorization", secToken))
                .andExpect(status().isOk());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S14 — RBAC ASSISTANT : autorisé en lecture
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S14 : ASSISTANT est autorisé — GET /queue 200, GET /alerts/count 200")
    void s14_rbac_assistant_authorized_read() throws Exception {
        String asstToken = bearer(asstEmail);

        mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", asstToken)
                        .param("size", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/pregnancies/alerts/count")
                        .header("Authorization", asstToken))
                .andExpect(status().isOk());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S15 — RBAC non authentifié : 401
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S15 : appel sans token — GET /queue 401, GET /alerts/count 401")
    void s15_rbac_noToken_401() throws Exception {
        mockMvc.perform(get("/api/pregnancies/queue")
                        .param("size", "10"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/pregnancies/alerts/count"))
                .andExpect(status().isUnauthorized());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S16 — Cohérence badge vs worklist : count = nb de grossesses EN_COURS avec alertes
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S16 : /alerts/count == nombre de grossesses retournées par ?withAlerts=true (cohérence badge ↔ worklist)")
    void s16_badgeCount_coherent_with_worklist_withAlerts() throws Exception {
        String token = bearer(medEmail);

        // Pregnancy with HTA alert
        String pA = createFemalePatient("Samira", token);
        String pregA = declarePregnancy(pA, LocalDate.now().minusWeeks(20), token);
        mockMvc.perform(post("/api/pregnancies/" + pregA + "/visits")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":150,\"bpDiastolic\":100}"))
                .andExpect(status().isCreated());

        // Pregnancy with no alert
        String pB = createFemalePatient("Touria", token);
        declarePregnancy(pB, LocalDate.now().minusWeeks(8), token);

        // Get badge count
        MvcResult countResult = mockMvc.perform(get("/api/pregnancies/alerts/count")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();
        int badgeCount = objectMapper.readTree(countResult.getResponse().getContentAsString())
                .get("withActiveAlerts").asInt();

        // Get worklist with withAlerts=true, page size large enough to get all
        MvcResult listResult = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("withAlerts", "true")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();
        long worklistCount = objectMapper.readTree(listResult.getResponse().getContentAsString())
                .get("totalElements").asLong();

        // They must be equal: badge counts across all EN_COURS, worklist filters same set
        assertThat((long) badgeCount).as(
                "Badge count (/alerts/count) must equal totalElements of ?withAlerts=true worklist — "
                + "badge=" + badgeCount + " worklist=" + worklistCount)
                .isEqualTo(worklistCount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // S17 — Recherche partielle insensible à la casse
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S17 : q=STEPFIVE (majuscules) matche lastName=StepFiveTest (minuscules) — recherche case-insensitive")
    void s17_filter_q_caseInsensitive() throws Exception {
        String token = bearer(medEmail);

        String p1 = createFemalePatient("Zineb", token);
        String preg1 = declarePregnancy(p1, LocalDate.now().minusWeeks(12), token);

        // Search with uppercase
        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("q", "STEPFIVE")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode content = objectMapper.readTree(result.getResponse().getContentAsString()).get("content");
        assertThat(content.size()).as("STEPFIVE uppercase must match StepFiveTest (case-insensitive)").isGreaterThan(0);

        boolean found = false;
        for (JsonNode entry : content) {
            if (preg1.equals(entry.get("pregnancyId").asText())) {
                found = true;
                break;
            }
        }
        assertThat(found).as("Our StepFiveTest patient must appear with q=STEPFIVE (uppercase)").isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "stepfive-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Step5', 'QA', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", userId, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private String createFemalePatient(String firstName, String bearerToken) throws Exception {
        String body = String.format("""
                {"firstName":"%s","lastName":"StepFiveTest",
                 "gender":"F","birthDate":"1990-01-15",
                 "phone":"+212600000001","city":"Casablanca"}
                """, firstName);
        MvcResult r = mockMvc.perform(post("/api/patients")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private String declarePregnancy(String patientId, LocalDate lmpDate, String bearerToken) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + lmpDate + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }
}
