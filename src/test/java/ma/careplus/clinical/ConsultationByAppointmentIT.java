package ma.careplus.clinical;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Integration tests for GET /api/consultations/by-appointment/{appointmentId}
 * — sibling de la walk Playwright manuelle 2026-05-09 sur le bouton « Ouvrir »
 * de la salle d'attente (commit 8f2c80d).
 *
 * <p>Le bouton « Ouvrir » sur une ligne EN_CONSULTATION (desktop ou tap mobile)
 * appelle ce endpoint avec l'appointmentId pour résoudre la consultation
 * rattachée, puis navigue vers /consultations/{id}. La walk a validé desktop +
 * mobile 390 px ; cette IT bottle les guards qui n'étaient pas couverts en IHM.
 *
 * <p>Scénarios :
 * <ol>
 *   <li>Happy path : Dr A appelle pour son appointment EN_CONSULTATION → 200,
 *       renvoie la consultation rattachée avec le bon practitionerId.</li>
 *   <li>Appointment connu mais sans consultation rattachée → 404
 *       CONSULT_NOT_FOUND (cas d'un RDV ARRIVE sans consultation démarrée).</li>
 *   <li>Appointment inexistant → 404 CONSULT_NOT_FOUND (la lookup
 *       findByAppointmentId retourne empty, le service throw avant le scope
 *       check).</li>
 *   <li>Cloisonnement ON + ≥2 MEDECIN actifs : Dr B appelle pour appointment
 *       de Dr A → 403 FORBIDDEN_PRACTITIONER (scope check bloque même si la
 *       consultation existe). Régression guard contre une fuite cross-médecin.</li>
 *   <li>Cloisonnement ON : ADMIN bypasse le scope → 200 sur appointment d'un
 *       autre médecin.</li>
 *   <li>Pas de token → 401 (filtre security global, pas le controller).</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ConsultationByAppointmentIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "ConsultByAppt-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medAId;
    UUID medBId;
    UUID adminId;
    UUID patientId;

    UUID apptInConsultId;       // EN_CONSULTATION + consultation rattachée (Dr A)
    UUID consultationId;        // BROUILLON, appointment_id = apptInConsultId
    UUID apptArriveNoConsultId; // ARRIVE, sans consultation rattachée (Dr A)

    String medAToken;
    String medBToken;
    String adminToken;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();

        // Clean slate (FK-safe order, ne touche que les utilisateurs / RDV / consultations
        // créés par cette suite : prefix cba- + last_name CBA-IT).
        jdbc.update("DELETE FROM clinical_consultation WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'CBA-IT')");
        jdbc.update("DELETE FROM scheduling_appointment WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'CBA-IT')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'CBA-IT'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'cba-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'cba-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'cba-%'");

        // Reset cloisonnement à OFF pour les scénarios qui ne l'exigent pas.
        jdbc.update("UPDATE configuration_clinic_settings SET agenda_strict_isolation = FALSE");

        medAId = UUID.randomUUID();
        medBId = UUID.randomUUID();
        adminId = UUID.randomUUID();
        String medAEmail = seedUser(medAId, "cba-meda", ROLE_MEDECIN);
        String medBEmail = seedUser(medBId, "cba-medb", ROLE_MEDECIN);
        String adminEmail = seedUser(adminId, "cba-admin", ROLE_ADMIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, birth_date, status,
                     tier, number_children, version, created_at, updated_at)
                VALUES (?, 'CBA-IT', 'Sara', 'F', '1990-04-12', 'ACTIF', 'NORMAL', 0, 0, now(), now())
                """, patientId);

        // RDV EN_CONSULTATION + consultation BROUILLON rattachée — surface du
        // bouton « Ouvrir » dans la salle d'attente.
        apptInConsultId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status,
                     walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, now(), now() + interval '30 minutes',
                        'EN_CONSULTATION', FALSE, FALSE, 0, now(), now())
                """, apptInConsultId, patientId, medAId);
        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation
                    (id, patient_id, practitioner_id, appointment_id, status,
                     version_number, version, started_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medAId, apptInConsultId);

        // RDV ARRIVE sans consultation — pour le 404 « pas encore démarrée ».
        apptArriveNoConsultId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status,
                     walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, now() + interval '1 hour', now() + interval '1 hour 30 minutes',
                        'ARRIVE', FALSE, FALSE, 0, now(), now())
                """, apptArriveNoConsultId, patientId, medAId);

        medAToken  = bearer(medAEmail);
        medBToken  = bearer(medBEmail);
        adminToken = bearer(adminEmail);
    }

    // ── Scénario 1 — Happy path Dr A → 200 ──────────────────────────────────

    @Test
    @DisplayName("Happy path : Dr A appelle pour son appointment EN_CONSULTATION → 200 + consultation correcte")
    void s1_happyPath_returnsConsultation() throws Exception {
        mockMvc.perform(get("/api/consultations/by-appointment/" + apptInConsultId)
                        .header("Authorization", medAToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(consultationId.toString()))
                .andExpect(jsonPath("$.appointmentId").value(apptInConsultId.toString()))
                .andExpect(jsonPath("$.practitionerId").value(medAId.toString()))
                .andExpect(jsonPath("$.status").value("BROUILLON"));
    }

    // ── Scénario 2 — Appointment connu sans consultation → 404 ──────────────

    @Test
    @DisplayName("Appointment ARRIVE sans consultation rattachée → 404 CONSULT_NOT_FOUND")
    void s2_appointmentWithoutConsultation_returns404() throws Exception {
        mockMvc.perform(get("/api/consultations/by-appointment/" + apptArriveNoConsultId)
                        .header("Authorization", medAToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CONSULT_NOT_FOUND"));
    }

    // ── Scénario 3 — Appointment inexistant → 404 ──────────────────────────

    @Test
    @DisplayName("Appointment inexistant → 404 CONSULT_NOT_FOUND (lookup fail before scope check)")
    void s3_unknownAppointment_returns404() throws Exception {
        UUID ghost = UUID.randomUUID();
        mockMvc.perform(get("/api/consultations/by-appointment/" + ghost)
                        .header("Authorization", medAToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CONSULT_NOT_FOUND"));
    }

    // ── Scénario 4 — Cloisonnement ON, Dr B appelle pour Dr A → 403 ────────

    @Test
    @DisplayName("Cloisonnement ON + ≥2 MEDECIN : Dr B appelle pour appointment de Dr A → 403 FORBIDDEN_PRACTITIONER")
    void s4_isolationOn_otherMedecin_forbidden() throws Exception {
        jdbc.update("UPDATE configuration_clinic_settings SET agenda_strict_isolation = TRUE");

        mockMvc.perform(get("/api/consultations/by-appointment/" + apptInConsultId)
                        .header("Authorization", medBToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN_PRACTITIONER"));
    }

    // ── Scénario 5 — Cloisonnement ON, ADMIN bypass → 200 ──────────────────

    @Test
    @DisplayName("Cloisonnement ON : ADMIN bypasse le scope → 200 sur appointment d'un autre médecin")
    void s5_isolationOn_adminBypasses() throws Exception {
        jdbc.update("UPDATE configuration_clinic_settings SET agenda_strict_isolation = TRUE");

        mockMvc.perform(get("/api/consultations/by-appointment/" + apptInConsultId)
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(consultationId.toString()));
    }

    // ── Scénario 6 — Pas d'auth → 401 ──────────────────────────────────────

    @Test
    @DisplayName("Pas de token → 401 Unauthorized")
    void s6_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/consultations/by-appointment/" + apptInConsultId))
                .andExpect(status().isUnauthorized());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private String seedUser(UUID userId, String prefix, UUID roleId) {
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'CBA', TRUE, 0, 0, now(), now())
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
}
