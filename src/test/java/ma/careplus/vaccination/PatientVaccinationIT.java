package ma.careplus.vaccination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
 * Integration tests for Vaccination module — Étape 2: patient calendar + dose management.
 *
 * Scenarios (numbering matches design doc section "Tests d'intégration"):
 * 1.  Calendrier matérialisé sur enfant 0 mois
 * 2.  Saisir dose ADMINISTERED
 * 3.  Lot obligatoire
 * 4.  Idempotence (VACCINATION_ALREADY_RECORDED → 409)
 * 5.  Reporter (DEFERRED)
 * 6.  Skipper — MEDECIN → 200, ASSISTANT → 403
 * 7.  Dose hors calendrier
 * 8.  Status calculé OVERDUE pour enfant 14 mois sans dose
 * 9.  Tolérance
 * 10. RBAC matrix — SECRETAIRE POST 403, ASSISTANT PUT 403, ASSISTANT DELETE 403
 * 14. Soft-delete — row marked, calendrier recompute PLANNED
 * 15. Patient adulte — calendar = 0 doses
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PatientVaccinationIT {

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

    private static final String PWD = "VaccPatient-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String asstEmail;
    String secEmail;

    @BeforeEach
    void setup() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up test data
        jdbc.update("DELETE FROM vaccination_dose WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'VaccIT-%')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name LIKE 'VaccIT-%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'vaccit-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'vaccit-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'vaccit-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "vaccit-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'VaccIT', TRUE, 0, 0, now(), now())
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

    /** Creates an active patient with the given birth date. Returns the patient UUID. */
    private UUID createPatient(LocalDate birthDate) {
        UUID id = UUID.randomUUID();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        java.sql.Date sqlDate = birthDate != null ? java.sql.Date.valueOf(birthDate) : null;
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, birth_date, status,
                     tier, number_children, version, created_at, updated_at)
                VALUES (?, ?, ?, 'M', ?, 'ACTIF', 'NORMAL', 0, 0, now(), now())
                """, id, "VaccIT-" + suffix, "Bébé", sqlDate);
        return id;
    }

    private String bcgId() {
        return jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'BCG'", String.class);
    }

    private String bcgScheduleDoseId() {
        String bcg = bcgId();
        return jdbc.queryForObject(
                "SELECT id::text FROM vaccine_schedule_dose WHERE vaccine_id = ?::uuid AND dose_number = 1",
                String.class, bcg);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 1: Calendrier matérialisé sur enfant 0 mois
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s1_calendarMaterialised_newborn_returns25PlannedEntries() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode arr = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(arr.isArray()).isTrue();
        // Expect at least 25 schedule entries (PNI seed has 25 rows)
        assertThat(arr.size()).isGreaterThanOrEqualTo(25);
        // All should have absent/null id (not persisted), status UPCOMING or DUE_SOON
        for (JsonNode entry : arr) {
            // With non_null Jackson config, null UUID id is absent from JSON
            assertThat(entry.has("id")).isFalse();
            String status = entry.get("status").asText();
            assertThat(status).isIn("UPCOMING", "DUE_SOON");
        }
        // No row in vaccination_dose
        Integer dbCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM vaccination_dose WHERE patient_id = ?", Integer.class, patientId);
        assertThat(dbCount).isZero();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 2: Saisir dose ADMINISTERED
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s2_recordAdministered_bcgD1() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String token = bearer(medEmail);
        String bcg = bcgId();

        String body = """
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "administeredAt": "%s",
                  "lotNumber": "ABC123",
                  "route": "ID"
                }
                """.formatted(bcg, OffsetDateTime.now().minusHours(1));

        MvcResult r = mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ADMINISTERED"))
                .andExpect(jsonPath("$.lotNumber").value("ABC123"))
                .andReturn();

        // GET calendar: BCG D1 should now be ADMINISTERED
        MvcResult calResult = mockMvc.perform(get("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode arr = objectMapper.readTree(calResult.getResponse().getContentAsString());
        long administeredCount = 0;
        for (JsonNode e : arr) {
            if ("ADMINISTERED".equals(e.get("status").asText())) administeredCount++;
        }
        assertThat(administeredCount).isEqualTo(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 3: Lot obligatoire
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s3_lotNumberRequired_400() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String token = bearer(medEmail);
        String bcg = bcgId();

        String body = """
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "administeredAt": "%s"
                }
                """.formatted(bcg, OffsetDateTime.now());

        mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 4: Idempotence — double saisie → 409
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s4_idempotence_409OnDuplicate() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String token = bearer(medEmail);
        String bcg = bcgId();

        String body = """
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "administeredAt": "%s",
                  "lotNumber": "LOT-001"
                }
                """.formatted(bcg, OffsetDateTime.now());

        mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VACCINATION_ALREADY_RECORDED"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 5: Reporter — DEFERRED
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s5_deferDose_byScheduleDoseId() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String token = bearer(medEmail);
        String schedDoseId = bcgScheduleDoseId();

        String deferBody = """
                { "reason": "fièvre" }
                """;

        MvcResult r = mockMvc.perform(
                        post("/api/patients/" + patientId + "/vaccinations/" + schedDoseId + "/defer")
                                .header("Authorization", token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(deferBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DEFERRED"))
                .andExpect(jsonPath("$.deferralReason").value("fièvre"))
                .andReturn();

        // GET calendar: BCG D1 should be DEFERRED
        MvcResult calResult = mockMvc.perform(get("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode cal = objectMapper.readTree(calResult.getResponse().getContentAsString());
        String bcgDeferStatus = null;
        for (JsonNode e : cal) {
            if ("BCG".equals(e.get("vaccineCode").asText()) && e.get("doseNumber").asInt() == 1) {
                bcgDeferStatus = e.get("status").asText();
                break;
            }
        }
        assertThat(bcgDeferStatus).isEqualTo("DEFERRED");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 6: Skipper — MEDECIN → 200, ASSISTANT → 403
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s6_skipDose_medecin200_assistant403() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String schedDoseId = bcgScheduleDoseId();

        // ASSISTANT → 403
        String asstToken = bearer(asstEmail);
        mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations/" + schedDoseId + "/skip")
                        .header("Authorization", asstToken))
                .andExpect(status().isForbidden());

        // MEDECIN → 200 with SKIPPED
        String medToken = bearer(medEmail);
        mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations/" + schedDoseId + "/skip")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SKIPPED"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 7: Dose hors calendrier (off-schedule catch-up)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s7_offScheduleDose_scheduleDoseIdNull() throws Exception {
        // Patient 10 months old — catch-up ROR
        UUID patientId = createPatient(LocalDate.now().minusMonths(10));
        String token = bearer(medEmail);

        // Get ROR vaccine id
        String rorId = jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'ROR'", String.class);
        assertThat(rorId).isNotNull();

        String body = """
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "administeredAt": "%s",
                  "lotNumber": "ROR-CATCHUP-001"
                }
                """.formatted(rorId, OffsetDateTime.now());

        MvcResult r = mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ADMINISTERED"))
                .andReturn();

        JsonNode entry = objectMapper.readTree(r.getResponse().getContentAsString());
        // No scheduleDoseId link (we didn't supply one → off-schedule)
        // With non_null Jackson config, null scheduleDoseId is absent from JSON
        assertThat(entry.has("scheduleDoseId")).isFalse();
        // id IS present (dose was persisted)
        assertThat(entry.has("id")).isTrue();
        assertThat(entry.get("id").isNull()).isFalse();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 8: Status calculé OVERDUE pour enfant 14 mois sans BCG saisi
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s8_computedStatus_overdue_14monthsNoBcg() throws Exception {
        // 14 months old, BCG tolerance 30 days → BCG is OVERDUE
        UUID patientId = createPatient(LocalDate.now().minusMonths(14));
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode arr = objectMapper.readTree(r.getResponse().getContentAsString());
        boolean bcgOverdue = false;
        for (JsonNode e : arr) {
            if ("BCG".equals(e.get("vaccineCode").asText())
                    && e.get("doseNumber").asInt() == 1
                    && "OVERDUE".equals(e.get("status").asText())) {
                bcgOverdue = true;
                break;
            }
        }
        assertThat(bcgOverdue).isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 9: Tolérance
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s9_tolerance_dueSoonAndOverdue() throws Exception {
        String token = bearer(medEmail);

        // BCG is scheduled at day 0 (birth), tolerance 30 days
        // Enfant 65 jours → 65 > 0 + 30 → OVERDUE
        UUID patientOld = createPatient(LocalDate.now().minusDays(65));
        MvcResult r1 = mockMvc.perform(get("/api/patients/" + patientOld + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr1 = objectMapper.readTree(r1.getResponse().getContentAsString());
        String bcgStatus65 = null;
        for (JsonNode e : arr1) {
            if ("BCG".equals(e.get("vaccineCode").asText()) && e.get("doseNumber").asInt() == 1) {
                bcgStatus65 = e.get("status").asText();
                break;
            }
        }
        assertThat(bcgStatus65).isEqualTo("OVERDUE");

        // Enfant 25 jours → 25 ≤ 0 + 30 → DUE_SOON
        UUID patientYoung = createPatient(LocalDate.now().minusDays(25));
        MvcResult r2 = mockMvc.perform(get("/api/patients/" + patientYoung + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr2 = objectMapper.readTree(r2.getResponse().getContentAsString());
        String bcgStatus25 = null;
        for (JsonNode e : arr2) {
            if ("BCG".equals(e.get("vaccineCode").asText()) && e.get("doseNumber").asInt() == 1) {
                bcgStatus25 = e.get("status").asText();
                break;
            }
        }
        assertThat(bcgStatus25).isEqualTo("DUE_SOON");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 10: RBAC matrix
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s10_rbac_matrix() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String bcg = bcgId();

        String secToken  = bearer(secEmail);
        String asstToken = bearer(asstEmail);
        String medToken  = bearer(medEmail);

        // SECRETAIRE → POST vaccinations 403
        String postBody = """
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "administeredAt": "%s",
                  "lotNumber": "LOT-SEC"
                }
                """.formatted(bcg, OffsetDateTime.now());
        mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(postBody))
                .andExpect(status().isForbidden());

        // First create a dose as MEDECIN so we have a real doseId for PUT/DELETE tests
        MvcResult created = mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(postBody))
                .andExpect(status().isCreated()).andReturn();
        String doseId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();
        long version = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("version").asLong();

        // ASSISTANT → PUT 403
        String putBody = """
                { "version": %d }
                """.formatted(version);
        mockMvc.perform(put("/api/patients/" + patientId + "/vaccinations/" + doseId)
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(putBody))
                .andExpect(status().isForbidden());

        // ASSISTANT → DELETE 403
        mockMvc.perform(delete("/api/patients/" + patientId + "/vaccinations/" + doseId)
                        .header("Authorization", asstToken))
                .andExpect(status().isForbidden());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 14: Soft-delete
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s14_softDelete_recomputedAsPlanned() throws Exception {
        UUID patientId = createPatient(LocalDate.now());
        String token = bearer(medEmail);
        String bcg = bcgId();

        // Record BCG D1
        String body = """
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "administeredAt": "%s",
                  "lotNumber": "DEL-LOT-001"
                }
                """.formatted(bcg, OffsetDateTime.now());
        MvcResult created = mockMvc.perform(post("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated()).andReturn();
        String doseId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // DELETE — soft delete
        mockMvc.perform(delete("/api/patients/" + patientId + "/vaccinations/" + doseId)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        // Row is marked deleted_at in DB
        String deletedAt = jdbc.queryForObject(
                "SELECT deleted_at::text FROM vaccination_dose WHERE id = ?::uuid", String.class, doseId);
        assertThat(deletedAt).isNotNull();

        // Calendar shows BCG as UPCOMING/DUE_SOON (recomputed, not ADMINISTERED)
        MvcResult calResult = mockMvc.perform(get("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = objectMapper.readTree(calResult.getResponse().getContentAsString());
        String bcgStatus = null;
        for (JsonNode e : arr) {
            if ("BCG".equals(e.get("vaccineCode").asText()) && e.get("doseNumber").asInt() == 1) {
                bcgStatus = e.get("status").asText();
                break;
            }
        }
        assertThat(bcgStatus).isIn("UPCOMING", "DUE_SOON", "OVERDUE");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 15: Patient adulte — calendar = 0 doses
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s15_adultPatient_emptyCalendar() throws Exception {
        // Born in 1980: all PNI schedule entries are > targetDate + tolerance + 5 years
        UUID patientId = createPatient(LocalDate.of(1980, 1, 1));
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/patients/" + patientId + "/vaccinations")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode arr = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(arr.size()).isZero();
    }
}
