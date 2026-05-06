package ma.careplus.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.time.ZoneId;
import java.time.ZonedDateTime;
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
 * Integration tests for {@code GET /api/dashboard/clinical}.
 *
 * Scenarios:
 *  1. 200 + structure complète JSON pour MEDECIN avec données mixtes
 *  2. 401 sans token
 *  3. 403 SECRETAIRE
 *  4. topPathologies tri count desc + cap 5
 *  5. activite30j contient 30 entrées (zero-fill jours sans consultation)
 *  6. patientsActifs30j filtre soft-delete (deleted_at IS NULL)
 *  7. ageMoyenPatientele cohérent avec calcul manuel
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ClinicalDashboardIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");

    private static final String PWD = "Dashboard-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    UUID medId;
    UUID secId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Wipe billing first (FK to consultation), then clinical, then patients.
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM clinical_consultation_prestation");
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medId = UUID.randomUUID();
        medEmail = "dashboard-med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Med', 'Test', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        secId = UUID.randomUUID();
        secEmail = "dashboard-sec-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Test', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /** Insert an active patient with given birth_date (nullable). Returns id. */
    private UUID seedPatient(String firstName, String lastName, LocalDate birthDate) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, birth_date, version,
                    number_children, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, 0, 'ACTIF', now(), now())
                """, id, lastName, firstName, birthDate);
        return id;
    }

    /** Insert a soft-deleted patient — should be excluded everywhere. */
    private UUID seedDeletedPatient(String firstName, String lastName, LocalDate birthDate) {
        UUID id = seedPatient(firstName, lastName, birthDate);
        jdbc.update("UPDATE patient_patient SET deleted_at = now() WHERE id = ?", id);
        return id;
    }

    /**
     * Insert a SIGNEE consultation directly via SQL — bypasses the start/sign HTTP
     * flow so we can backdate {@code signed_at} freely (which the API doesn't allow).
     */
    private UUID seedSignedConsultation(UUID patientId, UUID practitionerId, OffsetDateTime signedAt, String diagnosis) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation
                    (id, patient_id, practitioner_id, version_number, status, diagnosis,
                     started_at, signed_at, version, created_at, updated_at)
                VALUES (?, ?, ?, 1, 'SIGNEE', ?, ?, ?, 0, now(), now())
                """, id, patientId, practitionerId, diagnosis, signedAt, signedAt);
        return id;
    }

    private UUID seedDraftConsultation(UUID patientId, UUID practitionerId, OffsetDateTime startedAt, String diagnosis) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation
                    (id, patient_id, practitioner_id, version_number, status, diagnosis,
                     started_at, version, created_at, updated_at)
                VALUES (?, ?, ?, 1, 'BROUILLON', ?, ?, 0, now(), now())
                """, id, patientId, practitionerId, diagnosis, startedAt);
        return id;
    }

    // ── Scenario 1: 200 + full structure for MEDECIN with mixed data ─────────

    @Test
    void sc1_medecin_returns200_withFullStructure() throws Exception {
        // Seed: 3 active patients with varied birth dates, 1 soft-deleted patient
        UUID p1 = seedPatient("Amira", "Bennani", LocalDate.now().minusYears(40));
        UUID p2 = seedPatient("Younes", "Tazi", LocalDate.now().minusYears(30));
        UUID p3 = seedPatient("Sara", "Idrissi", LocalDate.now().minusYears(50));
        seedDeletedPatient("Deleted", "Ghost", LocalDate.now().minusYears(25));

        // Seed signed consultations within different windows (this practitioner)
        ZonedDateTime now = ZonedDateTime.now(CASA);
        seedSignedConsultation(p1, medId, now.minusHours(1).toOffsetDateTime(), "I10 hypertension");
        seedSignedConsultation(p2, medId, now.minusDays(2).toOffsetDateTime(), "E11.9 diabète");
        seedSignedConsultation(p3, medId, now.minusDays(15).toOffsetDateTime(), "I10 récidive");
        // DRAFT — should NOT be counted in any window
        seedDraftConsultation(p1, medId, now.minusHours(2).toOffsetDateTime(), "I10 brouillon");

        MvcResult r = mockMvc.perform(get("/api/dashboard/clinical")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientsActifsTotal").isNumber())
                .andExpect(jsonPath("$.patientsActifs30j").isNumber())
                .andExpect(jsonPath("$.consultationsAujourdhui").isNumber())
                .andExpect(jsonPath("$.consultationsSemaine").isNumber())
                .andExpect(jsonPath("$.consultationsMois").isNumber())
                .andExpect(jsonPath("$.ageMoyenPatientele").isNumber())
                .andExpect(jsonPath("$.topPathologies").isArray())
                .andExpect(jsonPath("$.activite7j").isArray())
                .andExpect(jsonPath("$.activite30j").isArray())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());

        // Active patients = 3 (deleted excluded)
        assertThat(body.get("patientsActifsTotal").asLong()).isEqualTo(3L);

        // 3 distinct patients have a signed consult in last 30 days
        assertThat(body.get("patientsActifs30j").asLong()).isEqualTo(3L);

        // Today's consult: 1 (the one signed 1h ago — DRAFT excluded)
        assertThat(body.get("consultationsAujourdhui").asLong()).isEqualTo(1L);

        // Activity arrays sized correctly
        assertThat(body.get("activite7j").size()).isEqualTo(7);
        assertThat(body.get("activite30j").size()).isEqualTo(30);

        // Top pathologies must contain I10
        boolean hasI10 = false;
        for (JsonNode entry : body.get("topPathologies")) {
            if ("I10".equals(entry.get("code").asText())) {
                hasI10 = true;
            }
        }
        assertThat(hasI10).as("topPathologies should contain I10").isTrue();
    }

    // ── Scenario 2: 401 without token ────────────────────────────────────────

    @Test
    void sc2_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/dashboard/clinical"))
                .andExpect(status().isUnauthorized());
    }

    // ── Scenario 3: 403 for SECRETAIRE ───────────────────────────────────────

    @Test
    void sc3_secretaire_returns403() throws Exception {
        mockMvc.perform(get("/api/dashboard/clinical")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());
    }

    // ── Scenario 4: topPathologies tri count desc + cap 5 ────────────────────

    @Test
    void sc4_topPathologies_sortedDescAndCappedAt5() throws Exception {
        // Seed 6 distinct ICD-10 codes with varying counts
        UUID p = seedPatient("Top", "Pat", LocalDate.now().minusYears(35));
        ZonedDateTime now = ZonedDateTime.now(CASA);

        // I10 → 5 hits (most frequent)
        for (int i = 0; i < 5; i++) {
            seedSignedConsultation(p, medId, now.minusDays(i + 1).toOffsetDateTime(), "I10 hypertension");
        }
        // E11 → 4 hits
        for (int i = 0; i < 4; i++) {
            seedSignedConsultation(p, medId, now.minusDays(i + 1).toOffsetDateTime(), "E11.9 diabète");
        }
        // J45 → 3 hits
        for (int i = 0; i < 3; i++) {
            seedSignedConsultation(p, medId, now.minusDays(i + 1).toOffsetDateTime(), "J45 asthme");
        }
        // K21 → 2 hits
        for (int i = 0; i < 2; i++) {
            seedSignedConsultation(p, medId, now.minusDays(i + 1).toOffsetDateTime(), "K21 reflux");
        }
        // M54 → 1 hit
        seedSignedConsultation(p, medId, now.minusDays(1).toOffsetDateTime(), "M54 lombalgie");
        // N39 → 1 hit (would be 6th — must be cut off)
        seedSignedConsultation(p, medId, now.minusDays(1).toOffsetDateTime(), "N39 cystite");

        MvcResult r = mockMvc.perform(get("/api/dashboard/clinical")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode top = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("topPathologies");

        // Cap at 5
        assertThat(top.size()).as("topPathologies must be capped at 5").isLessThanOrEqualTo(5);

        // Sorted by count desc
        long previousCount = Long.MAX_VALUE;
        for (JsonNode entry : top) {
            long c = entry.get("count").asLong();
            assertThat(c).as("topPathologies must be sorted count desc").isLessThanOrEqualTo(previousCount);
            previousCount = c;
        }

        // First entry is I10 (5 hits)
        assertThat(top.get(0).get("code").asText()).isEqualTo("I10");
        assertThat(top.get(0).get("count").asLong()).isEqualTo(5L);
    }

    // ── Scenario 5: activite30j zero-fill (30 entries even with no data) ─────

    @Test
    void sc5_activite30j_alwaysContains30Entries_zeroFilled() throws Exception {
        // No consultations at all
        MvcResult r = mockMvc.perform(get("/api/dashboard/clinical")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode a30 = body.get("activite30j");

        assertThat(a30.size()).isEqualTo(30);
        // All counts should be 0
        for (JsonNode point : a30) {
            assertThat(point.get("count").asLong()).isEqualTo(0L);
            assertThat(point.get("date").asText()).matches("\\d{4}-\\d{2}-\\d{2}");
        }
        // Last entry should be today's date
        LocalDate today = LocalDate.now(CASA);
        assertThat(a30.get(a30.size() - 1).get("date").asText()).isEqualTo(today.toString());
    }

    // ── Scenario 6: patientsActifs30j excludes soft-deleted patients ─────────

    @Test
    void sc6_patientsActifs30j_excludesSoftDeleted() throws Exception {
        // 1 active patient with a recent signed consult
        UUID active = seedPatient("Active", "Counted", LocalDate.now().minusYears(40));
        // 1 soft-deleted patient with a recent signed consult — must NOT be counted
        UUID deleted = seedDeletedPatient("Deleted", "Skipped", LocalDate.now().minusYears(40));

        ZonedDateTime now = ZonedDateTime.now(CASA);
        seedSignedConsultation(active, medId, now.minusDays(5).toOffsetDateTime(), "I10");
        seedSignedConsultation(deleted, medId, now.minusDays(3).toOffsetDateTime(), "E11");

        MvcResult r = mockMvc.perform(get("/api/dashboard/clinical")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        // Only the active patient counts
        assertThat(body.get("patientsActifs30j").asLong()).isEqualTo(1L);
        assertThat(body.get("patientsActifsTotal").asLong()).isEqualTo(1L);
    }

    // ── Scenario 7: ageMoyenPatientele matches manual calc ───────────────────

    @Test
    void sc7_ageMoyenPatientele_consistentWithManualCalc() throws Exception {
        // Seed 3 patients with known birth dates
        LocalDate today = LocalDate.now(CASA);
        LocalDate b1 = today.minusYears(30);
        LocalDate b2 = today.minusYears(40);
        LocalDate b3 = today.minusYears(50);
        seedPatient("A", "Age", b1);
        seedPatient("B", "Age", b2);
        seedPatient("C", "Age", b3);
        // Soft-deleted should be ignored
        seedDeletedPatient("D", "Age", today.minusYears(80));
        // Patient without birth_date — also ignored
        seedPatient("E", "Age", null);

        // Manual mean: AVG(EXTRACT(YEAR FROM age(birth_date))) — Postgres returns
        // the integer year-component of the age interval, not a fractional age.
        int age1 = Period.between(b1, today).getYears();
        int age2 = Period.between(b2, today).getYears();
        int age3 = Period.between(b3, today).getYears();
        double expectedMean = (age1 + age2 + age3) / 3.0;

        MvcResult r = mockMvc.perform(get("/api/dashboard/clinical")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        double actual = body.get("ageMoyenPatientele").asDouble();
        assertThat(actual).isCloseTo(expectedMean, offset(0.5));
    }
}
