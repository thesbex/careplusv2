package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Integration tests for the clinical module (J5): check-in, queue, vitals,
 * consultation CRUD + sign.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ClinicalIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_ASSISTANT = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Clinical-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String asstEmail;
    UUID medId;
    UUID patientId;
    UUID appointmentId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medId = UUID.randomUUID();
        medEmail = "med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Med', 'Test', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        UUID asstId = UUID.randomUUID();
        asstEmail = "asst-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Asst', 'Test', TRUE, 0, 0, now(), now())
                """, asstId, asstEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", asstId, ROLE_ASSISTANT);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children,
                    status, created_at, updated_at)
                VALUES (?, 'Alami', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Today at current time (already checked in for simplicity; some tests
        // explicitly re-check-in)
        OffsetDateTime startAt = OffsetDateTime.now().minusMinutes(10);
        OffsetDateTime endAt = startAt.plusMinutes(30);
        appointmentId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment (id, patient_id, practitioner_id,
                    start_at, end_at, status, walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'PLANIFIE', FALSE, FALSE, 0, now(), now())
                """, appointmentId, patientId, medId, startAt, endAt);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Tests ──────────────────────────────────────────────────────

    @Test
    void checkIn_stampsArrivedAndAdvancesStatus() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/check-in")
                        .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isNoContent());

        String status = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?", String.class, appointmentId);
        assertThat(status).isEqualTo("ARRIVE");

        Integer hasArrivedAt = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment WHERE id = ? AND arrived_at IS NOT NULL",
                Integer.class, appointmentId);
        assertThat(hasArrivedAt).isEqualTo(1);
    }

    @Test
    void queue_returnsCheckedInAppointments() throws Exception {
        // Check in first
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/check-in")
                .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/queue").header("Authorization", bearer(asstEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("ARRIVE"))
                .andExpect(jsonPath("$[0].patientFullName").value("Mohamed Alami"));
    }

    @Test
    void recordVitals_advancesStatusAndComputesBmi() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/check-in")
                .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", bearer(asstEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"systolicMmhg":120,"diastolicMmhg":80,
                                 "heartRateBpm":72,"spo2Percent":98,
                                 "temperatureC":36.8,
                                 "weightKg":72.5,"heightCm":178.0}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bmi").value(org.hamcrest.Matchers.closeTo(22.88, 0.2)));

        String status = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?", String.class, appointmentId);
        assertThat(status).isEqualTo("CONSTANTES_PRISES");
    }

    @Test
    void patientVitalsHistory_returnsRecorded() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/check-in")
                .header("Authorization", bearer(asstEmail)));
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                .header("Authorization", bearer(asstEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"systolicMmhg\":120,\"diastolicMmhg\":80,\"heartRateBpm\":72}"));

        mockMvc.perform(get("/api/patients/" + patientId + "/vitals")
                .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].systolicMmhg").value(120));
    }

    @Test
    void consultation_startThenUpdateThenSign_andLockedAfterSign() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/check-in")
                .header("Authorization", bearer(asstEmail)));

        MvcResult r = mockMvc.perform(post("/api/consultations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"patientId\":\"%s\",\"appointmentId\":\"%s\",\"motif\":\"Contrôle TA\"}",
                                patientId, appointmentId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("BROUILLON"))
                .andReturn();
        String cId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(put("/api/consultations/" + cId)
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"examination\":\"TA 13/8, FC 72\",\"diagnosis\":\"HTA stable\",\"notes\":\"Continuer Amlor 5mg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diagnosis").value("HTA stable"));

        mockMvc.perform(post("/api/consultations/" + cId + "/sign")
                .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SIGNEE"))
                .andExpect(jsonPath("$.signedAt").isNotEmpty());

        // Further update rejected
        mockMvc.perform(put("/api/consultations/" + cId)
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"notes\":\"oops\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSULT_LOCKED"));
    }

    @Test
    void secretaire_cannotStartConsultation() throws Exception {
        // reuse the asst seed as secretaire by updating role via direct SQL
        jdbc.update("UPDATE identity_user_role SET role_id = ?::uuid WHERE user_id = (SELECT id FROM identity_user WHERE email = ?)",
                "00000000-0000-0000-0000-000000000001", asstEmail);
        mockMvc.perform(post("/api/consultations")
                .header("Authorization", bearer(asstEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format("{\"patientId\":\"%s\"}", patientId)))
                .andExpect(status().isForbidden());
    }
}
