package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
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
 * QA — Prise des constantes (bug report 2026-05-02).
 *
 * Utilisateur : « J'ai renseigné le poids, la température et la taille.
 * Quand je clique sur 'Envoyer en consultation' rien ne se passe. »
 *
 * SCÉNARIOS COUVERTS :
 *  1. Happy path : POST /vitals avec poids + température + taille → 201,
 *     appointment passe en CONSTANTES_PRISES en DB, BMI calculé.
 *  2. Champs partiels : seul le poids renseigné → 201 accepté, statut avance.
 *  3. Guard statut invalide : vitals sur RDV PLANIFIE (sans check-in) →
 *     201 accepté MAIS statut reste PLANIFIE (backend ne bloque pas, le
 *     statut n'avance que depuis ARRIVE/EN_ATTENTE_CONSTANTES).
 *  4. Guard bound-check : temperatureC hors plage (99.0 > 46.0) → 400 VALIDATION,
 *     aucune ligne clinical_vital_signs créée.
 *  5. Guard bound-check : weightKg hors plage (0.1 < 0.2) → 400 VALIDATION,
 *     statut inchangé.
 *  6. Guard appointment inconnu : UUID inexistant → 404 APPT_NOT_FOUND.
 *  7. RBAC : SECRETAIRE autorisé (hasAnyRole inclut SECRETAIRE).
 *  8. RBAC : non authentifié → 401.
 *  9. Idempotence : deux POST /vitals successifs créent deux lignes distinctes
 *     (append-only), statut reste CONSTANTES_PRISES.
 * 10. Vitals sur EN_ATTENTE_CONSTANTES : statut avance correctement.
 *
 * REGRESSION GUARD :
 *  - Bug 2026-05-02 « rien ne se passe » : l'onSubmit du composant PriseConstantesPage
 *    appelait `await submit(values)` sans try/catch. Si mutateAsync lançait une
 *    AxiosError (4xx/5xx), l'exception s'échappait silencieusement, navigate('/salle')
 *    n'était jamais appelé et aucun toast n'était affiché. Fix : try/catch avec
 *    toast.error() dans PriseConstantesPage.tsx et PriseConstantesPage.mobile.tsx.
 *    Les scénarios 4 et 5 assertent qu'un 400 est bien retourné (le frontend doit
 *    l'attraper et l'afficher — la partie UI est couverte par le fix de code).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PriseConstantesIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD           = "Vitals-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    UUID asstId;
    UUID secId;
    String medEmail;
    String asstEmail;
    String secEmail;
    UUID patientId;
    UUID appointmentId; // starts as ARRIVE after check-in in each test that needs it

    // Token cache — login once per role per test run
    private String medToken;
    private String asstToken;
    private String secToken;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();

        // Purge in FK-safe order
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

        // Reset token cache so each test gets a fresh login
        medToken  = null;
        asstToken = null;
        secToken  = null;

        // Users
        medId    = UUID.randomUUID();
        asstId   = UUID.randomUUID();
        secId    = UUID.randomUUID();
        medEmail  = "med-"  + UUID.randomUUID() + "@test.ma";
        asstEmail = "asst-" + UUID.randomUUID() + "@test.ma";
        secEmail  = "sec-"  + UUID.randomUUID() + "@test.ma";

        insertUser(medId,  medEmail,  ROLE_MEDECIN);
        insertUser(asstId, asstEmail, ROLE_ASSISTANT);
        insertUser(secId,  secEmail,  ROLE_SECRETAIRE);

        // Patient
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children,
                    status, created_at, updated_at)
                VALUES (?, 'Alami', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Appointment: starts as PLANIFIE — individual tests do check-in as needed
        appointmentId = UUID.randomUUID();
        OffsetDateTime start = OffsetDateTime.now().minusMinutes(20);
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at,
                     status, walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'PLANIFIE', FALSE, FALSE, 0, now(), now())
                """, appointmentId, patientId, medId, start, start.plusMinutes(30));
    }

    // ── Helpers ────────────────────────────────────────────────────

    private void insertUser(UUID id, String email, UUID roleId) {
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'User', TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
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

    /** Returns cached med token — login once per test. */
    private String medBearer() throws Exception {
        if (medToken == null) medToken = bearer(medEmail);
        return medToken;
    }

    private String asstBearer() throws Exception {
        if (asstToken == null) asstToken = bearer(asstEmail);
        return asstToken;
    }

    private String secBearer() throws Exception {
        if (secToken == null) secToken = bearer(secEmail);
        return secToken;
    }

    /** Check-in the appointment (PLANIFIE → ARRIVE). */
    private void checkIn() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/check-in")
                        .header("Authorization", asstBearer()))
                .andExpect(status().isNoContent());
    }

    /** Read appointment status directly from DB — never trust response body alone. */
    private String dbStatus() {
        return jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, appointmentId);
    }

    /** Count clinical_vital_signs rows for this appointment. */
    private int dbVitalsCount() {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_vital_signs WHERE appointment_id = ?",
                Integer.class, appointmentId);
        return n != null ? n : 0;
    }

    // ── Tests ──────────────────────────────────────────────────────

    /**
     * Scénario 1 — Happy path : poids + température + taille.
     * Reproduit le cas utilisateur exact du bug report 2026-05-02.
     * Avant le fix, l'absence de try/catch faisait que navigate('/salle')
     * n'était jamais appelé en cas d'erreur API silencieuse.
     */
    @Test
    @DisplayName("POST /vitals avec poids+temp+taille : 201, statut passe en CONSTANTES_PRISES, BMI calculé")
    void happyPath_weightTempHeight_advancesStatusAndComputesBmi() throws Exception {
        checkIn();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":70,\"temperatureC\":36.8,\"heightCm\":170}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.weightKg").value(70))
                .andExpect(jsonPath("$.temperatureC").value(36.8))
                .andExpect(jsonPath("$.heightCm").value(170))
                .andExpect(jsonPath("$.bmi").value(org.hamcrest.Matchers.closeTo(24.22, 0.1)));

        // DB: status advanced — not just the response body
        assertThat(dbStatus()).isEqualTo("CONSTANTES_PRISES");
        assertThat(dbVitalsCount()).isEqualTo(1);
    }

    /**
     * Scénario 2 — Champs partiels : seul le poids renseigné.
     * Tous les champs sont nullable dans le DTO backend ; le frontend
     * envoie aussi les autres à null et la validation passe.
     */
    @Test
    @DisplayName("POST /vitals avec seulement weightKg : 201 accepté, statut avance")
    void partialVitals_weightOnly_accepted() throws Exception {
        checkIn();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":65}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.weightKg").value(65))
                .andExpect(jsonPath("$.bmi").doesNotExist()); // Jackson omits null: no height → bmi absent

        assertThat(dbStatus()).isEqualTo("CONSTANTES_PRISES");
    }

    /**
     * Scénario 3 — Guard statut invalide : RDV en PLANIFIE sans check-in.
     * Le backend enregistre les constantes (201) mais le statut ne peut
     * avancer que depuis ARRIVE / EN_ATTENTE_CONSTANTES. PLANIFIE reste PLANIFIE.
     * Documente le comportement observé — pas un bug (l'UI devrait pré-valider).
     */
    @Test
    @DisplayName("POST /vitals sur RDV PLANIFIE : 201 enregistré mais statut reste PLANIFIE")
    void vitalsOnPlanifieAppointment_recordedButStatusUnchanged() throws Exception {
        // No check-in — appointment stays PLANIFIE
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":70}"))
                .andExpect(status().isCreated());

        // Vital signs were created
        assertThat(dbVitalsCount()).isEqualTo(1);
        // But status did NOT advance from PLANIFIE
        assertThat(dbStatus()).isEqualTo("PLANIFIE");
    }

    /**
     * Scénario 4 — Guard bound-check : température hors plage (99 > 46).
     * Backend @DecimalMax("46.0") doit rejeter → 400 VALIDATION.
     * Aucune ligne vital_signs créée.
     * REGRESSION GUARD : ce 400 est exactement le type d'erreur que le
     * try/catch manquant laissait s'échapper silencieusement côté UI.
     */
    @Test
    @DisplayName("POST /vitals avec temperatureC=99 hors plage : 400 VALIDATION, aucun vital créé")
    void outOfBoundTemperature_returns400_noVitalCreated() throws Exception {
        checkIn();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"temperatureC\":99.0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));

        // No vital row must have been created
        assertThat(dbVitalsCount()).isEqualTo(0);
        // Appointment status must be unchanged (ARRIVE)
        assertThat(dbStatus()).isEqualTo("ARRIVE");
    }

    /**
     * Scénario 5 — Guard bound-check : poids hors plage (0.1 < 0.2 minimum).
     * Backend @DecimalMin("0.2") doit rejeter → 400 VALIDATION.
     * Statut reste ARRIVE, aucun vital créé.
     */
    @Test
    @DisplayName("POST /vitals avec weightKg=0.1 sous le minimum : 400 VALIDATION, statut inchangé")
    void belowMinimumWeight_returns400_statusUnchanged() throws Exception {
        checkIn();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":0.1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));

        assertThat(dbVitalsCount()).isEqualTo(0);
        assertThat(dbStatus()).isEqualTo("ARRIVE");
    }

    /**
     * Scénario 6 — Guard appointment inconnu : UUID inexistant → 404.
     */
    @Test
    @DisplayName("POST /vitals sur appointment inexistant : 404 APPT_NOT_FOUND")
    void unknownAppointment_returns404() throws Exception {
        mockMvc.perform(post("/api/appointments/" + UUID.randomUUID() + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":70}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("APPT_NOT_FOUND"));
    }

    /**
     * Scénario 7 — RBAC autorisé : SECRETAIRE peut enregistrer les constantes.
     * Le contrôleur déclare hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN').
     */
    @Test
    @DisplayName("RBAC : SECRETAIRE peut POST /vitals → 201")
    void secretaire_canRecordVitals() throws Exception {
        checkIn();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", secBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":68}"))
                .andExpect(status().isCreated());

        assertThat(dbStatus()).isEqualTo("CONSTANTES_PRISES");
    }

    /**
     * Scénario 8 — RBAC interdit : sans token → 401.
     */
    @Test
    @DisplayName("RBAC : sans token POST /vitals → 401")
    void unauthenticated_cannotRecordVitals() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":70}"))
                .andExpect(status().isUnauthorized());

        // Nothing created in DB
        assertThat(dbVitalsCount()).isEqualTo(0);
    }

    /**
     * Scénario 9 — Idempotence (append-only) : deux POSTs successifs créent
     * deux lignes distinctes dans clinical_vital_signs. Le statut reste
     * CONSTANTES_PRISES après le second appel (no regression).
     */
    @Test
    @DisplayName("Deux POST /vitals successifs : deux lignes créées, statut reste CONSTANTES_PRISES")
    void doublePost_createsTwoRows_statusStable() throws Exception {
        checkIn();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":70}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":71}"))
                .andExpect(status().isCreated());

        assertThat(dbVitalsCount()).isEqualTo(2);
        assertThat(dbStatus()).isEqualTo("CONSTANTES_PRISES");
    }

    /**
     * Scénario 10 — Statut EN_ATTENTE_CONSTANTES → CONSTANTES_PRISES.
     * Le service avance le statut depuis ARRIVE mais aussi depuis
     * EN_ATTENTE_CONSTANTES (deuxième état valide selon VitalsService.record).
     */
    @Test
    @DisplayName("POST /vitals sur statut EN_ATTENTE_CONSTANTES : statut passe en CONSTANTES_PRISES")
    void vitalsOnEnAttenteConstantes_advancesStatus() throws Exception {
        // Force the appointment to EN_ATTENTE_CONSTANTES
        jdbc.update(
                "UPDATE scheduling_appointment SET status = 'EN_ATTENTE_CONSTANTES' WHERE id = ?",
                appointmentId);

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":70}"))
                .andExpect(status().isCreated());

        assertThat(dbStatus()).isEqualTo("CONSTANTES_PRISES");
    }

    /**
     * Scénario 11 — Regression "rien ne se passe" 2026-05-02.
     * Le frontend envoyait glycemiaGPerL=0 quand le champ Glycémie restait vide
     * parce que le setValueAs du form ne traitait pas null (Number(null)===0).
     * Le backend rejetait avec @DecimalMin("0.1") → 400 VALIDATION. L'absence
     * de try/catch côté UI cachait l'erreur, l'utilisateur voyait "rien ne se passe".
     *
     * Ce test verrouille le contrat backend : 0 reste rejeté (pas de relâchement
     * silencieux). Le fix frontend (setValueAs gère v == null) sérialise null.
     */
    @Test
    @DisplayName("POST /vitals avec glycemiaGPerL=0 : 400 VALIDATION (le frontend doit envoyer null)")
    void vitalsWithGlycemiaZero_isRejected() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "weightKg": 70,
                                  "temperatureC": 36.8,
                                  "heightCm": 170,
                                  "glycemiaGPerL": 0
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"))
                .andExpect(jsonPath("$.fields[0].field").value("glycemiaGPerL"));

        assertThat(dbVitalsCount()).isZero();
    }

    /**
     * Scénario 12 — Symmetric happy path : le frontend envoie null pour les
     * champs optionnels vides → backend accepte et le statut avance. C'est
     * exactement le payload que produit le fix frontend après correction
     * du setValueAs (champs optionnels non remplis → null, pas 0).
     */
    @Test
    @DisplayName("POST /vitals avec champs optionnels null (poids+temp+taille seulement) : 201 + CONSTANTES_PRISES")
    void vitalsWithOptionalNullFields_succeeds() throws Exception {
        checkIn();
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "systolicMmhg": null,
                                  "diastolicMmhg": null,
                                  "heartRateBpm": null,
                                  "spo2Percent": null,
                                  "temperatureC": 36.8,
                                  "weightKg": 70,
                                  "heightCm": 170,
                                  "glycemiaGPerL": null,
                                  "notes": ""
                                }
                                """))
                .andExpect(status().isCreated());

        assertThat(dbStatus()).isEqualTo("CONSTANTES_PRISES");
    }
}
