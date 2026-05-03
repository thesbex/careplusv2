package ma.careplus.vaccination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
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
 * Integration tests — Vaccination Étape 3: worklist /api/vaccinations/queue.
 *
 * Scenarios:
 * 1.  OVERDUE     — 3 enfants âges 3/8/14 mois, 0 doses → tous listés, 14 mois en tête
 * 2.  DUE_SOON    — enfant 25 jours → BCG/HepB DUE_SOON listé
 * 3.  Défaut      — null status → OVERDUE + DUE_SOON seulement
 * 4.  vaccineCode — GET ?vaccineCode=BCG → seules rows BCG
 * 5.  ageGroup    — 6 mois + 24 mois → ?ageGroupMinMonths=12&ageGroupMaxMonths=36 → seul 24 mois
 * 6.  Pagination  — 60 enfants OVERDUE → ?page=0&size=20 → 20 résultats + totalElements>=60
 * 7.  RBAC        — SECRETAIRE → 200
 * 8.  Adulte exclu — DDN 1980 → jamais dans queue
 * 9.  Soft-delete — enfant 8 mois → soft-delete → absent de queue
 * 10. ADMINISTERED exclue — BCG ADMINISTERED → BCG absent pour ce patient
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class VaccinationQueueIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "QueueIT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;

    @BeforeEach
    void setup() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up test patients and doses
        jdbc.update("DELETE FROM vaccination_dose WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'QueueIT-%')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name LIKE 'QueueIT-%'");

        // Clean test users
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'queueit-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'queueit-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'queueit-%'");

        medEmail = seedUser("med", ROLE_MEDECIN);
        secEmail = seedUser("sec", ROLE_SECRETAIRE);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "queueit-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'QueueIT', TRUE, 0, 0, now(), now())
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

    /** Creates a pediatric patient with given birth date. Returns patient UUID. */
    private UUID createChild(LocalDate birthDate) {
        UUID id = UUID.randomUUID();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        java.sql.Date sqlDate = birthDate != null ? java.sql.Date.valueOf(birthDate) : null;
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, birth_date, status,
                     tier, number_children, version, created_at, updated_at)
                VALUES (?, ?, ?, 'M', ?, 'ACTIF', 'NORMAL', 0, 0, now(), now())
                """, id, "QueueIT-" + suffix, "Bébé", sqlDate);
        return id;
    }

    /** Creates an adult patient (born 1980). Returns patient UUID. */
    private UUID createAdult() {
        UUID id = UUID.randomUUID();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, birth_date, status,
                     tier, number_children, version, created_at, updated_at)
                VALUES (?, ?, ?, 'M', '1980-06-01', 'ACTIF', 'NORMAL', 0, 0, now(), now())
                """, id, "QueueIT-" + suffix, "Adulte");
        return id;
    }

    private String bcgId() {
        return jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'BCG'", String.class);
    }

    private String bcgScheduleDoseId() {
        String bcg = bcgId();
        return jdbc.queryForObject(
                "SELECT id::text FROM vaccine_schedule_dose "
                + "WHERE vaccine_id = ?::uuid AND dose_number = 1",
                String.class, bcg);
    }

    /** Records a BCG dose as ADMINISTERED for the given patient. */
    private void recordBcgAdministered(UUID patientId, String token) throws Exception {
        String bcg = bcgId();
        String body = """
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "administeredAt": "%s",
                  "lotNumber": "LOT-BCG-001",
                  "route": "ID"
                }
                """.formatted(bcg, OffsetDateTime.now().minusHours(1));

        mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 1: OVERDUE — 3 children with no doses, 14-month child is most urgent
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s1_overdue_threeChildren_sortedByUrgency() throws Exception {
        // 3 months old, 8 months old, 14 months old — all have overdue doses
        UUID p3m  = createChild(LocalDate.now().minusMonths(3));
        UUID p8m  = createChild(LocalDate.now().minusMonths(8));
        UUID p14m = createChild(LocalDate.now().minusMonths(14));
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");
        assertThat(content).isNotNull();
        assertThat(content.isArray()).isTrue();

        long total = body.get("totalElements").asLong();
        assertThat(total).isGreaterThanOrEqualTo(3);

        // Verify all entries have status OVERDUE
        for (JsonNode entry : content) {
            assertThat(entry.get("status").asText()).isEqualTo("OVERDUE");
        }

        // Verify urgency sort: first entries should have highest daysOverdue
        // (14-month child has the most overdue doses)
        // Check that daysOverdue in first page is >= 0 (positive = overdue) and sorted DESC
        if (content.size() >= 2) {
            int firstDays = content.get(0).get("daysOverdue").asInt();
            int secondDays = content.get(1).get("daysOverdue").asInt();
            assertThat(firstDays).isGreaterThanOrEqualTo(secondDays);
        }

        // Verify all three patient IDs are present in results (search all pages)
        MvcResult allR = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode allBody = objectMapper.readTree(allR.getResponse().getContentAsString());
        JsonNode allContent = allBody.get("content");

        List<String> patientIds = new ArrayList<>();
        for (JsonNode e : allContent) patientIds.add(e.get("patientId").asText());
        assertThat(patientIds).contains(p3m.toString(), p8m.toString(), p14m.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 2: DUE_SOON — 25-day old child → BCG/HepB1 listed
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s2_dueSoon_25dayOld_bcgListed() throws Exception {
        UUID pNewborn = createChild(LocalDate.now().minusDays(25));
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "DUE_SOON")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");

        // 25-day-old should have BCG (target 0 days, tolerance 30) in DUE_SOON
        boolean hasBcg = false;
        for (JsonNode e : content) {
            if (pNewborn.toString().equals(e.get("patientId").asText())) {
                assertThat(e.get("status").asText()).isEqualTo("DUE_SOON");
                if ("BCG".equals(e.get("vaccineCode").asText())) {
                    hasBcg = true;
                }
            }
        }
        assertThat(hasBcg).isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 3: Default (no status filter) → OVERDUE + DUE_SOON
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s3_defaultStatus_overdueAndDueSoonOnly() throws Exception {
        // 8-month-old has OVERDUE; 25-day-old has DUE_SOON
        UUID pOverdue  = createChild(LocalDate.now().minusMonths(8));
        UUID pDueSoon  = createChild(LocalDate.now().minusDays(25));
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");

        // Should contain our two patients
        List<String> patientIds = new ArrayList<>();
        for (JsonNode e : content) patientIds.add(e.get("patientId").asText());
        assertThat(patientIds).contains(pOverdue.toString(), pDueSoon.toString());

        // No UPCOMING entries in default view
        for (JsonNode e : content) {
            String s = e.get("status").asText();
            assertThat(s).isIn("OVERDUE", "DUE_SOON");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 4: vaccineCode filter — only BCG rows returned
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s4_vaccineCodeFilter_onlyBcgRows() throws Exception {
        // Create 5 children with OVERDUE doses
        for (int i = 0; i < 5; i++) {
            createChild(LocalDate.now().minusMonths(8));
        }
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("vaccineCode", "BCG")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");
        assertThat(content.size()).isGreaterThan(0);

        // All entries must be BCG
        for (JsonNode e : content) {
            assertThat(e.get("vaccineCode").asText()).isEqualTo("BCG");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 5: ageGroup filter — only 24-month child, not 6-month
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s5_ageGroupFilter_only24MonthChild() throws Exception {
        UUID p6m  = createChild(LocalDate.now().minusMonths(6));
        UUID p24m = createChild(LocalDate.now().minusMonths(24));
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("ageGroupMinMonths", "12")
                        .param("ageGroupMaxMonths", "36")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");

        List<String> patientIds = new ArrayList<>();
        for (JsonNode e : content) patientIds.add(e.get("patientId").asText());

        assertThat(patientIds).contains(p24m.toString());
        assertThat(patientIds).doesNotContain(p6m.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 6: Pagination — 60 OVERDUE children → page=0,size=20 → 20 results
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s6_pagination_60OverdueChildren_page0size20() throws Exception {
        // Create 60 children at 8 months old (all OVERDUE)
        for (int i = 0; i < 60; i++) {
            createChild(LocalDate.now().minusMonths(8));
        }
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pageNumber").value(0))
                .andExpect(jsonPath("$.pageSize").value(20))
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());

        // Page content should have exactly 20 entries
        JsonNode content = body.get("content");
        assertThat(content.size()).isEqualTo(20);

        // totalElements should be >= 60 (may have other test patients from parallel runs,
        // but we own at least 60 children with OVERDUE doses)
        long total = body.get("totalElements").asLong();
        assertThat(total).isGreaterThanOrEqualTo(60);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 7: RBAC — SECRETAIRE gets 200
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s7_rbac_secretaireCanReadQueue() throws Exception {
        String token = bearer(secEmail);

        mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token))
                .andExpect(status().isOk());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 8: Adult excluded (DDN 1980)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s8_adultExcluded() throws Exception {
        UUID adultId = createAdult();
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");

        List<String> patientIds = new ArrayList<>();
        for (JsonNode e : content) patientIds.add(e.get("patientId").asText());
        assertThat(patientIds).doesNotContain(adultId.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 9: Soft-deleted patient excluded
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s9_softDeletedPatientExcluded() throws Exception {
        UUID childId = createChild(LocalDate.now().minusMonths(8));
        String token = bearer(medEmail);

        // Verify child appears first
        MvcResult before = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode beforeBody = objectMapper.readTree(before.getResponse().getContentAsString());
        List<String> beforeIds = new ArrayList<>();
        for (JsonNode e : beforeBody.get("content")) beforeIds.add(e.get("patientId").asText());
        assertThat(beforeIds).contains(childId.toString());

        // Soft-delete the patient
        jdbc.update("UPDATE patient_patient SET deleted_at = now() WHERE id = ?", childId);

        // Verify child no longer appears
        MvcResult after = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode afterBody = objectMapper.readTree(after.getResponse().getContentAsString());
        List<String> afterIds = new ArrayList<>();
        for (JsonNode e : afterBody.get("content")) afterIds.add(e.get("patientId").asText());
        assertThat(afterIds).doesNotContain(childId.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 10: ADMINISTERED dose excluded from queue
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s10_administeredDoseExcludedFromQueue() throws Exception {
        UUID childId = createChild(LocalDate.now().minusMonths(8));
        String token = bearer(medEmail);

        // Record BCG as administered
        recordBcgAdministered(childId, token);

        // GET queue filtered by BCG — child's BCG should not appear
        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("vaccineCode", "BCG")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");

        // BCG-filtered view: this child must not appear at all (BCG was administered)
        List<String> patientIdsInBcgView = new ArrayList<>();
        for (JsonNode e : content) patientIdsInBcgView.add(e.get("patientId").asText());
        assertThat(patientIdsInBcgView).doesNotContain(childId.toString());

        // Unfiltered OVERDUE view: child still appears for OTHER overdue vaccines
        MvcResult allR = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode allContent = objectMapper.readTree(allR.getResponse().getContentAsString()).get("content");
        boolean otherDoseForChild = false;
        for (JsonNode e : allContent) {
            if (childId.toString().equals(e.get("patientId").asText())
                    && !"BCG".equals(e.get("vaccineCode").asText())) {
                otherDoseForChild = true;
                break;
            }
        }
        assertThat(otherDoseForChild).isTrue(); // 8-month-old has other overdue vaccines besides BCG
    }
}
