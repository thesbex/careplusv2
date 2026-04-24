package ma.careplus.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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

/**
 * Integration tests for the scheduling module.
 *   POST /api/appointments
 *   GET  /api/appointments/{id}
 *   PUT  /api/appointments/{id}  (move)
 *   DELETE /api/appointments/{id} (cancel)
 *   GET  /api/availability
 *   GET  /api/reasons
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class SchedulingIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Sched-Test-2026!";
    private static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail;
    UUID practitionerId;
    UUID patientId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID secId = UUID.randomUUID();
        secEmail = "sec-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Test', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);

        practitionerId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Doctor', 'Test', TRUE, 0, 0, now(), now())
                """, practitionerId, "doc-" + UUID.randomUUID() + "@test.ma",
                passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                practitionerId, ROLE_MEDECIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children, status,
                    created_at, updated_at)
                VALUES (?, 'Alami', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /** Finds a non-holiday weekday at 09:00 Casablanca time next week (Tuesday). */
    private OffsetDateTime nextTuesday9am() {
        LocalDate d = LocalDate.now(CABINET);
        while (d.getDayOfWeek().getValue() != 2) d = d.plusDays(1);
        if (d.isBefore(LocalDate.now(CABINET).plusDays(1))) d = d.plusDays(7);
        return d.atTime(9, 0).atZone(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
    }

    // ── Tests ──────────────────────────────────────────────────────

    @Test
    void listsReasonsFromV002Seed() throws Exception {
        mockMvc.perform(get("/api/reasons").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThan(0)));
    }

    @Test
    void createsAppointment() throws Exception {
        OffsetDateTime start = nextTuesday9am();
        String body = objectMapper.writeValueAsString(new java.util.HashMap<>() {{
            put("patientId", patientId.toString());
            put("practitionerId", practitionerId.toString());
            put("startAt", start.toString());
            put("durationMinutes", 30);
        }});
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PLANIFIE"))
                .andExpect(jsonPath("$.walkIn").value(false))
                .andExpect(jsonPath("$.urgency").value(false));

        Integer rows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment WHERE patient_id = ?",
                Integer.class, patientId);
        assertThat(rows).isEqualTo(1);
    }

    @Test
    void refusesConflict_unlessUrgence() throws Exception {
        OffsetDateTime start = nextTuesday9am();
        String body1 = objectMapper.writeValueAsString(java.util.Map.of(
                "patientId", patientId.toString(),
                "practitionerId", practitionerId.toString(),
                "startAt", start.toString(),
                "durationMinutes", 30));
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON).content(body1))
                .andExpect(status().isCreated());

        // Second booking overlapping the same slot → 409
        String body2 = objectMapper.writeValueAsString(java.util.Map.of(
                "patientId", patientId.toString(),
                "practitionerId", practitionerId.toString(),
                "startAt", start.plusMinutes(15).toString(),
                "durationMinutes", 30));
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON).content(body2))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPT_CONFLICT"));

        // Third booking with urgency → allowed despite overlap
        String body3 = objectMapper.writeValueAsString(java.util.Map.of(
                "patientId", patientId.toString(),
                "practitionerId", practitionerId.toString(),
                "startAt", start.plusMinutes(15).toString(),
                "durationMinutes", 15,
                "urgency", true));
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON).content(body3))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.urgency").value(true));
    }

    @Test
    void refusesBookingOnHoliday() throws Exception {
        // V002 seeds 2026 Moroccan holidays — Fête du Trône is 2026-07-30.
        LocalDate holiday = LocalDate.of(2026, 7, 30);
        OffsetDateTime start = holiday.atTime(10, 0).atZone(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);

        String body = objectMapper.writeValueAsString(java.util.Map.of(
                "patientId", patientId.toString(),
                "practitionerId", practitionerId.toString(),
                "startAt", start.toString(),
                "durationMinutes", 30));
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPT_ON_HOLIDAY"));
    }

    @Test
    void movesAppointment() throws Exception {
        OffsetDateTime start = nextTuesday9am();
        MvcResult r = mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "patientId", patientId.toString(),
                                "practitionerId", practitionerId.toString(),
                                "startAt", start.toString(),
                                "durationMinutes", 30))))
                .andReturn();
        String id = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        // Move 1h later
        OffsetDateTime newStart = start.plusHours(1);
        mockMvc.perform(put("/api/appointments/" + id)
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "startAt", newStart.toString()))))
                .andExpect(status().isOk());
    }

    @Test
    void cancelsAppointment() throws Exception {
        OffsetDateTime start = nextTuesday9am();
        MvcResult r = mockMvc.perform(post("/api/appointments")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "patientId", patientId.toString(),
                                "practitionerId", practitionerId.toString(),
                                "startAt", start.toString(),
                                "durationMinutes", 30))))
                .andReturn();
        String id = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(delete("/api/appointments/" + id)
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Patient a annulé\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANNULE"));
    }

    @Test
    void availabilityReturnsSlotsInWorkingHours() throws Exception {
        // Tuesday 9:00 → 12:00 window, 30-min slots, no existing appointments
        OffsetDateTime from = nextTuesday9am();
        OffsetDateTime to = from.plusHours(3);
        mockMvc.perform(get("/api/availability")
                        .header("Authorization", bearer(secEmail))
                        .param("practitionerId", practitionerId.toString())
                        .param("from", from.toString())
                        .param("to", to.toString())
                        .param("durationMinutes", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThan(0)));
    }

    @Test
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/reasons"))
                .andExpect(status().isUnauthorized());
    }
}
