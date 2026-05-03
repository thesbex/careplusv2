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
 * Integration tests for PregnancyQueueService — Étape 3.
 *
 * Scenarios:
 *  1. Worklist filtrée par trimestre T2 retourne uniquement des grossesses T2
 *  2. Filtre withAlerts=true retourne uniquement les grossesses avec ≥ 1 alerte
 *  3. Pagination correcte (PageView : totalElements, totalPages, content size respecté)
 *  4. Tri par SA décroissant par défaut (la plus avancée en tête)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyQueueIT {

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

    private static final String PWD = "Queue-Test-2026!";

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

        jdbc.update("DELETE FROM pregnancy_visit WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'QueueTest'))");
        jdbc.update("DELETE FROM pregnancy_visit_plan WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'QueueTest'))");
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'QueueTest')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'QueueTest'");

        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'queue-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'queue-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'queue-test-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "queue-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'User', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", userId, roleId);
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
                {"firstName":"%s","lastName":"QueueTest",
                 "gender":"F","birthDate":"1990-07-10",
                 "phone":"+212600002000","city":"Marrakech"}
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

    // ── Scenario 1: Filter by trimestre T2 returns only T2 pregnancies ────────

    @Test
    void sc1_trimesterFilter_t2_returnsOnlyT2() throws Exception {
        String token = bearer(medEmail);

        // T1 pregnancy: SA ~8 weeks
        String pid1 = createFemalePatient("Amira", token);
        declarePregnancy(pid1, LocalDate.now().minusWeeks(8), token);

        // T2 pregnancy: SA ~18 weeks
        String pid2 = createFemalePatient("Basma", token);
        String pregT2 = declarePregnancy(pid2, LocalDate.now().minusWeeks(18), token);

        // T3 pregnancy: SA ~32 weeks
        String pid3 = createFemalePatient("Chaima", token);
        declarePregnancy(pid3, LocalDate.now().minusWeeks(32), token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("trimester", "T2")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode content = body.get("content");

        // All returned items must be T2
        for (JsonNode entry : content) {
            assertThat(entry.get("trimester").asText()).isEqualTo("T2");
        }

        // Our T2 pregnancy should be present
        boolean hasOurT2 = false;
        for (JsonNode entry : content) {
            if (pregT2.equals(entry.get("pregnancyId").asText())) {
                hasOurT2 = true;
            }
        }
        assertThat(hasOurT2).as("Our T2 pregnancy should appear in T2-filtered results").isTrue();
    }

    // ── Scenario 2: withAlerts=true returns only pregnancies with ≥ 1 alert ──

    @Test
    void sc2_withAlerts_true_returnsOnlyAlerting() throws Exception {
        String medToken  = bearer(medEmail);
        String asstToken = bearer(asstEmail);

        // Pregnancy with HTA alert (bp 150/100)
        String pidAlert = createFemalePatient("AlertPatient", medToken);
        String pregWithAlert = declarePregnancy(pidAlert, LocalDate.now().minusWeeks(20), medToken);
        mockMvc.perform(post("/api/pregnancies/" + pregWithAlert + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":150,\"bpDiastolic\":100}"))
                .andExpect(status().isCreated());

        // Pregnancy without any alert (normal TA)
        String pidNormal = createFemalePatient("NormalPatient", medToken);
        String pregNormal = declarePregnancy(pidNormal, LocalDate.now().minusWeeks(10), medToken);
        mockMvc.perform(post("/api/pregnancies/" + pregNormal + "/visits")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bpSystolic\":110,\"bpDiastolic\":70}"))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", medToken)
                        .param("withAlerts", "true")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode content = body.get("content");

        // All entries in result must have alertCount > 0
        for (JsonNode entry : content) {
            assertThat(entry.get("alertCount").asInt())
                    .as("Entry with alertCount=0 should not appear in withAlerts=true result")
                    .isGreaterThan(0);
        }

        // Our alerting pregnancy must be present
        boolean hasAlertPreg = false;
        for (JsonNode entry : content) {
            if (pregWithAlert.equals(entry.get("pregnancyId").asText())) {
                hasAlertPreg = true;
            }
        }
        assertThat(hasAlertPreg).as("Alerting pregnancy should be in withAlerts=true result").isTrue();
    }

    // ── Scenario 3: Pagination — totalElements, totalPages, content size ──────

    @Test
    void sc3_pagination_correctPageView() throws Exception {
        String token = bearer(medEmail);

        // Create 3 pregnancies
        String[] pagNames = {"Dina", "Elisa", "Fatna"};
        for (int i = 0; i < pagNames.length; i++) {
            String pid = createFemalePatient(pagNames[i], token);
            declarePregnancy(pid, LocalDate.now().minusWeeks(10 + i * 4), token);
        }

        // Request page 0, size 2
        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.pageSize").value(2))
                .andExpect(jsonPath("$.pageNumber").value(0))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());

        long totalElements = body.get("totalElements").asLong();
        int totalPages = body.get("totalPages").asInt();
        int contentSize = body.get("content").size();

        assertThat(totalElements).isGreaterThanOrEqualTo(3);
        assertThat(contentSize).isEqualTo(2);
        assertThat(totalPages).isGreaterThanOrEqualTo((int) Math.ceil((double) totalElements / 2));
    }

    // ── Scenario 4: Sort by SA descending (most advanced first) ──────────────

    @Test
    void sc4_sortBySaDesc_mostAdvancedFirst() throws Exception {
        String token = bearer(medEmail);

        // Create pregnancies with varying SA
        String pidT1 = createFemalePatient("Ghita", token);
        declarePregnancy(pidT1, LocalDate.now().minusWeeks(8), token);   // SA ~8

        String pidT3 = createFemalePatient("Hajar", token);
        declarePregnancy(pidT3, LocalDate.now().minusWeeks(32), token);  // SA ~32

        String pidT2 = createFemalePatient("Imane", token);
        declarePregnancy(pidT2, LocalDate.now().minusWeeks(20), token);  // SA ~20

        MvcResult result = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode content = body.get("content");
        assertThat(content.size()).isGreaterThanOrEqualTo(3);

        // Verify SA is non-increasing (sorted DESC)
        int prevSa = Integer.MAX_VALUE;
        for (JsonNode entry : content) {
            int sa = entry.get("saWeeks").asInt();
            assertThat(sa).as("saWeeks should be non-increasing (sorted DESC)").isLessThanOrEqualTo(prevSa);
            prevSa = sa;
        }
    }
}
