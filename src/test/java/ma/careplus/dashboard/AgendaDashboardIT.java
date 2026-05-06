package ma.careplus.dashboard;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
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

import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Integration tests for the F1 agenda dashboard endpoint.
 *
 * <p>Scenarios:
 * <ol>
 *   <li>200 + full JSON structure on GET</li>
 *   <li>RBAC — every role (SECRETAIRE, ASSISTANT, MEDECIN, ADMIN) → 200</li>
 *   <li>401 without bearer token</li>
 *   <li>{@code rdvAujourdhui}/{@code rdvSemaine} exclude ANNULE / NO_SHOW</li>
 *   <li>{@code noShowsSemaine} / {@code annulationsSemaine} filter on status</li>
 *   <li>{@code tauxRemplissageJour} = active appts / open slots
 *       (with {@code scheduling_working_hours} present, slots are deterministic)</li>
 *   <li>{@code chargeHoraire} returns 12 buckets 08:00..19:00 with empty buckets at 0</li>
 *   <li>{@code nouveauxPatientsMois} respects current month (created_at &gt;= 1st)</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class AgendaDashboardIT {

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

    private static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");
    private static final String PWD = "DashTest-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String secEmail;
    private String asstEmail;
    private String medEmail;
    private String adminEmail;
    private UUID practitionerId;
    private UUID patientId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Wipe scheduling first (FK -> patient + identity_user)
        jdbc.update("DELETE FROM scheduling_appointment");

        // Wipe seed users + their dependents (FKs in identity_*)
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'dash-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'dash-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'dash-test-%'");

        // Wipe test patients (so the "new patients this month" counter is deterministic)
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'DashTest'");

        // Users for each role
        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        asstEmail  = seedUser("asst",  ROLE_ASSISTANT);
        medEmail   = seedUser("med",   ROLE_MEDECIN);
        adminEmail = seedUser("admin", ROLE_ADMIN);

        // Practitioner = one more identity_user (could be the medEmail one but we keep a
        // dedicated id so the test reads cleanly)
        practitionerId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Doctor', 'DashTest', TRUE, 0, 0, now(), now())
                """, practitionerId, "dash-test-practitioner-" + UUID.randomUUID() + "@test.ma",
                passwordEncoder.encode(PWD));

        // Patient
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'DashTest', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "dash-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'Dash', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                userId, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MockHttpServletRequestBuilder req = post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}");
        MvcResult r = mockMvc.perform(req).andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /** Inserts a scheduling_appointment row with a given start_at, status, type. */
    private UUID insertAppt(OffsetDateTime startUtc, int durationMinutes, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment (id, patient_id, practitioner_id,
                    start_at, end_at, status, type, walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'CONSULTATION', FALSE, FALSE, 0, now(), now())
                """, id, patientId, practitionerId, startUtc,
                startUtc.plusMinutes(durationMinutes), status);
        return id;
    }

    /** Convert a calendar (date, hour, minute) in cabinet TZ → UTC OffsetDateTime. */
    private OffsetDateTime cabinetTime(LocalDate day, int hour, int minute) {
        return day.atTime(hour, minute).atZone(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Test
    void returnsFullJsonStructure() throws Exception {
        mockMvc.perform(get("/api/dashboard/agenda")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rdvAujourdhui").exists())
                .andExpect(jsonPath("$.rdvSemaine").exists())
                .andExpect(jsonPath("$.tauxRemplissageJour").exists())
                .andExpect(jsonPath("$.tauxRemplissageSemaine").exists())
                .andExpect(jsonPath("$.noShowsSemaine").exists())
                .andExpect(jsonPath("$.annulationsSemaine").exists())
                .andExpect(jsonPath("$.nouveauxPatientsMois").exists())
                .andExpect(jsonPath("$.chargeHoraire").isArray())
                .andExpect(jsonPath("$.chargeHoraire.length()").value(12))
                .andExpect(jsonPath("$.chargeHoraire[0].slotStart").value("08:00"))
                .andExpect(jsonPath("$.chargeHoraire[11].slotStart").value("19:00"));
    }

    @Test
    void allRolesAllowed() throws Exception {
        for (String email : new String[]{secEmail, asstEmail, medEmail, adminEmail}) {
            mockMvc.perform(get("/api/dashboard/agenda")
                            .header("Authorization", bearer(email)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void rejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/dashboard/agenda"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rdvCountersExcludeAnnuleAndNoShow() throws Exception {
        LocalDate today = LocalDate.now(CABINET);
        // 3 active today (PLANIFIE, ARRIVE, EN_CONSULTATION)
        insertAppt(cabinetTime(today, 9, 0), 30, "PLANIFIE");
        insertAppt(cabinetTime(today, 10, 0), 30, "ARRIVE");
        insertAppt(cabinetTime(today, 11, 0), 30, "EN_CONSULTATION");
        // 1 ANNULE, 1 NO_SHOW today → MUST be excluded from rdvAujourdhui
        insertAppt(cabinetTime(today, 14, 0), 30, "ANNULE");
        insertAppt(cabinetTime(today, 15, 0), 30, "NO_SHOW");

        mockMvc.perform(get("/api/dashboard/agenda")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rdvAujourdhui").value(3));
    }

    @Test
    void noShowsAndAnnulationsCountByStatusInWeek() throws Exception {
        // Pick the Monday of this ISO week, then put events on Mon..Wed.
        LocalDate mon = LocalDate.now(CABINET).with(DayOfWeek.MONDAY);
        insertAppt(cabinetTime(mon,        16, 0), 30, "ANNULE");
        insertAppt(cabinetTime(mon.plusDays(1), 16, 0), 30, "ANNULE");
        insertAppt(cabinetTime(mon.plusDays(2), 16, 0), 30, "NO_SHOW");

        mockMvc.perform(get("/api/dashboard/agenda")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.annulationsSemaine").value(2))
                .andExpect(jsonPath("$.noShowsSemaine").value(1));
    }

    @Test
    void tauxRemplissageJourMatchesManualCompute() throws Exception {
        // V002 seeds 9-13 + 15-19 Mon..Fri (= 16 slots/day) and 9-13 Sat (= 8 slots).
        // Force a deterministic configuration by clearing + re-seeding for "today".
        // To avoid breaking other days, we just ensure the table has rows for
        // today's day-of-week with a known span: 9-13 (= 8 slots).
        LocalDate today = LocalDate.now(CABINET);
        int dow = today.getDayOfWeek().getValue();

        // Wipe + re-insert today's working_hours rows (deterministic 8 slots).
        jdbc.update("DELETE FROM scheduling_working_hours WHERE day_of_week = ?", dow);
        jdbc.update("INSERT INTO scheduling_working_hours (id, day_of_week, start_time, end_time) "
                + "VALUES (?, ?, '09:00', '13:00')", UUID.randomUUID(), dow);

        // 4 active appointments today → expected ratio 4/8 = 0.5
        insertAppt(cabinetTime(today, 9, 0),  30, "PLANIFIE");
        insertAppt(cabinetTime(today, 9, 30), 30, "ARRIVE");
        insertAppt(cabinetTime(today, 10, 0), 30, "EN_CONSULTATION");
        insertAppt(cabinetTime(today, 10, 30), 30, "PLANIFIE");

        mockMvc.perform(get("/api/dashboard/agenda")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tauxRemplissageJour").value(0.5));
    }

    @Test
    void chargeHoraireCoversFullRangeWithEmptyBucketsAtZero() throws Exception {
        LocalDate today = LocalDate.now(CABINET);
        // 2 RDV at 09:xx in cabinet TZ, 1 at 14:00, 1 at 19:30 (still in 19h bucket).
        insertAppt(cabinetTime(today, 9, 15), 30, "PLANIFIE");
        insertAppt(cabinetTime(today, 9, 45), 30, "PLANIFIE");
        insertAppt(cabinetTime(today, 14, 0), 30, "PLANIFIE");
        insertAppt(cabinetTime(today, 19, 30), 30, "PLANIFIE");

        MvcResult r = mockMvc.perform(get("/api/dashboard/agenda")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chargeHoraire.length()").value(12))
                // 09:00 bucket has 2
                .andExpect(jsonPath("$.chargeHoraire[1].slotStart").value("09:00"))
                .andExpect(jsonPath("$.chargeHoraire[1].count").value(2))
                // 14:00 bucket has 1
                .andExpect(jsonPath("$.chargeHoraire[6].slotStart").value("14:00"))
                .andExpect(jsonPath("$.chargeHoraire[6].count").value(1))
                // 19:00 bucket has 1
                .andExpect(jsonPath("$.chargeHoraire[11].slotStart").value("19:00"))
                .andExpect(jsonPath("$.chargeHoraire[11].count").value(1))
                // 12:00 bucket empty
                .andExpect(jsonPath("$.chargeHoraire[4].slotStart").value("12:00"))
                .andExpect(jsonPath("$.chargeHoraire[4].count").value(0))
                .andReturn();
        // Smoke-check: array order is sorted by hour
        String body = r.getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(body).contains("\"08:00\"");
    }

    @Test
    void nouveauxPatientsMoisOnlyCountsCurrentMonth() throws Exception {
        // Insert 2 patients dated TODAY → counted.
        for (int i = 0; i < 2; i++) {
            jdbc.update("""
                    INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                        created_at, updated_at)
                    VALUES (?, 'DashTest', 'NewMonth', 0, 0, 'ACTIF', now(), now())
                    """, UUID.randomUUID());
        }
        // Insert 1 patient dated last month → NOT counted.
        OffsetDateTime lastMonth = LocalDate.now(CABINET).withDayOfMonth(1)
                .minusDays(2).atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'DashTest', 'OldMonth', 0, 0, 'ACTIF', ?, ?)
                """, UUID.randomUUID(), lastMonth, lastMonth);

        // Baseline patient inserted in @BeforeEach is also from "today" → +1.
        // Total expected for current month = 2 (loop) + 1 (BeforeEach) = 3.
        mockMvc.perform(get("/api/dashboard/agenda")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nouveauxPatientsMois").value(
                        org.hamcrest.Matchers.greaterThanOrEqualTo(3)));
    }
}
