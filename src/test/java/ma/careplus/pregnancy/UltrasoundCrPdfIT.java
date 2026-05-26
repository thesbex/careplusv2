package ma.careplus.pregnancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * IT — GET /api/pregnancies/{pId}/ultrasounds/{uId}/cr-pdf
 *
 * <p>Scenarios :
 * <ol>
 *   <li>Happy path — MEDECIN → 200, content-type application/pdf, starts with "%PDF",
 *       body &gt; 1 kB (non-trivial PDF)</li>
 *   <li>Unknown ultrasound id → 404</li>
 *   <li>Ultrasound belongs to a different pregnancy → 404</li>
 *   <li>SECRETAIRE may download (read role) → 200</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class UltrasoundCrPdfIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "CrPdf-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    String medEmail;
    String secEmail;

    UUID patientId;
    UUID pregnancyId;
    UUID ultrasoundId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Cleanup in FK-safe order
        jdbc.update("DELETE FROM pregnancy_ultrasound WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'CrPdfTest'))");
        jdbc.update("DELETE FROM pregnancy_visit_plan WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'CrPdfTest'))");
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'CrPdfTest')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'CrPdfTest'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'crpdf-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'crpdf-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'crpdf-test-%'");

        // Seed médecin
        medId = UUID.randomUUID();
        medEmail = "crpdf-test-med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Youssef', 'Benali', TRUE, 0, 0, now(), now())
                """,
                medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medId, ROLE_MEDECIN);

        // Seed secrétaire
        UUID secId = UUID.randomUUID();
        secEmail = "crpdf-test-sec-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Souad', 'Filali', TRUE, 0, 0, now(), now())
                """,
                secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        // Seed patiente
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, tier,
                     version, number_children, status, created_at, updated_at)
                VALUES (?, 'CrPdfTest', 'Amina', 'F', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """,
                patientId);

        // Seed grossesse
        pregnancyId = UUID.randomUUID();
        LocalDate lmpDate = LocalDate.now().minusWeeks(20);
        LocalDate dueDate = lmpDate.plusDays(280);
        jdbc.update("""
                INSERT INTO pregnancy
                    (id, patient_id, started_at, lmp_date, due_date, due_date_source,
                     status, fetuses, version, created_at, updated_at, created_by)
                VALUES (?, ?, ?, ?, ?, 'NAEGELE', 'EN_COURS',
                        '[{"label":"F\\u0153tus unique"}]', 0, now(), now(), ?)
                """,
                pregnancyId, patientId, lmpDate, lmpDate, dueDate, medId);

        // Seed échographie T2 with full biometry + findings
        ultrasoundId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO pregnancy_ultrasound
                    (id, pregnancy_id, kind, performed_at, sa_weeks_at_exam, sa_days_at_exam,
                     findings, biometry, corrects_due_date, recorded_by,
                     version, created_at, updated_at, created_by)
                VALUES (?, ?, 'T2_MORPHO', ?, 20, 3,
                        'Morphologie normale. Placenta antérieur. Liquide amniotique normal.',
                        '{"bip":48.5,"pc":181.0,"dat":50.2,"lf":34.0,"eg":143,"percentile":52}',
                        false, ?,
                        0, now(), now(), ?)
                """,
                ultrasoundId, pregnancyId,
                LocalDate.now().minusDays(2),
                medId, medId);
    }

    // ── Scenario 1 : happy path MEDECIN → 200, application/pdf, starts %PDF ──

    @Test
    @DisplayName("1. GET cr-pdf as MEDECIN → 200, application/pdf, starts %PDF, size > 1 kB")
    void happyPath_medecin_returnsPdf() throws Exception {
        MvcResult result = mockMvc.perform(get(crPdfUrl(pregnancyId, ultrasoundId))
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andReturn();

        byte[] pdf = result.getResponse().getContentAsByteArray();
        assertThat(pdf).hasSizeGreaterThan(1024);
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
    }

    // ── Scenario 2 : unknown ultrasound id → 404 ─────────────────────────────

    @Test
    @DisplayName("2. GET cr-pdf with unknown ultrasound id → 404")
    void unknownUltrasound_returns404() throws Exception {
        UUID unknownId = UUID.randomUUID();
        mockMvc.perform(get(crPdfUrl(pregnancyId, unknownId))
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound());
    }

    // ── Scenario 3 : ultrasound belongs to another pregnancy → 404 ───────────

    @Test
    @DisplayName("3. GET cr-pdf with wrong pregnancyId → 404")
    void wrongPregnancy_returns404() throws Exception {
        UUID otherPregnancyId = UUID.randomUUID();
        mockMvc.perform(get(crPdfUrl(otherPregnancyId, ultrasoundId))
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound());
    }

    // ── Scenario 4 : SECRETAIRE may download (read role) → 200 ──────────────

    @Test
    @DisplayName("4. GET cr-pdf as SECRETAIRE → 200 (read access allowed)")
    void secretaire_canDownload_returns200() throws Exception {
        MvcResult result = mockMvc.perform(get(crPdfUrl(pregnancyId, ultrasoundId))
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andReturn();

        byte[] pdf = result.getResponse().getContentAsByteArray();
        assertThat(pdf).hasSizeGreaterThan(1024);
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String crPdfUrl(UUID pId, UUID uId) {
        return "/api/pregnancies/" + pId + "/ultrasounds/" + uId + "/cr-pdf";
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
}
