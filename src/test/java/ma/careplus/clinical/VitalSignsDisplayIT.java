package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
 * QA — Affichage des constantes médicales (bugs B1 + B5, 2026-05-06).
 *
 * Bug B1 — Constantes partiellement affichées en SDA / consultation.
 *   Le médecin saisit poids + taille + FC, l'écran « Patient en consultation »
 *   n'affiche QUE FC. Cause racine côté FE : le composant `PatientContextCard`
 *   ne rendait que TA/FC/T°/SpO₂/IMC. Côté BE : les colonnes
 *   respiratory_rate_bpm, abdominal_perimeter_cm, head_circumference_cm
 *   n'existaient pas → données silencieusement perdues à la persistance.
 *
 * Bug B5 — Onglet « Constantes — dernière visite » du dossier patient vide.
 *   `usePatient` ne peuplait jamais `lastVitals`, donc même après plusieurs
 *   consultations clôturées, la carte restait vide. Fix : le `SummaryPanel`
 *   lit directement `/patients/{id}/vitals` (même endpoint).
 *
 * Ce test verrouille le contrat backend qui sous-tend les deux fixs :
 *
 *  1. Le DTO `RecordVitalsRequest` accepte les 11 mesures (les 8 originales
 *     + respiratoryRateBpm + abdominalPerimeterCm + headCircumferenceCm) et
 *     les persiste toutes en DB.
 *  2. Le DTO `VitalSignsView` les ré-expose toutes via GET /patients/{id}/vitals
 *     ET via POST /vitals (réponse).
 *  3. Le walk de bout en bout (prise SDA → POST /consultations → clôture →
 *     GET /patients/{id}/vitals) renvoie bien la mesure avec ses valeurs et
 *     le consultationId rétroactivement lié.
 *  4. Bornes de validation des 3 nouveaux champs (rejet hors plage).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class VitalSignsDisplayIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD           = "Vitals-Display-2026!";

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
    UUID appointmentId;
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

        medToken = null;
        asstToken = null;
        secToken = null;

        medId  = UUID.randomUUID();
        asstId = UUID.randomUUID();
        secId  = UUID.randomUUID();
        medEmail  = "med-vd-"  + UUID.randomUUID() + "@test.ma";
        asstEmail = "asst-vd-" + UUID.randomUUID() + "@test.ma";
        secEmail  = "sec-vd-"  + UUID.randomUUID() + "@test.ma";

        insertUser(medId,  medEmail,  ROLE_MEDECIN);
        insertUser(asstId, asstEmail, ROLE_ASSISTANT);
        insertUser(secId,  secEmail,  ROLE_SECRETAIRE);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children,
                    status, created_at, updated_at)
                VALUES (?, 'Bennani', 'Sara', 0, 0, 'ACTIF', now(), now())
                """, patientId);

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

    private void checkIn() throws Exception {
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/check-in")
                        .header("Authorization", asstBearer()))
                .andExpect(status().isNoContent());
    }

    // ── Tests ──────────────────────────────────────────────────────

    /**
     * Scénario 1 — POST /vitals avec les 11 mesures persiste en DB ET les
     * réexpose dans la réponse 201. Verrouille le contrat write→read complet
     * pour B1.
     */
    @Test
    @DisplayName("POST /vitals avec 11 constantes persiste tout en DB et les renvoie en réponse")
    void recordVitals_allEleven_persistsAndReturns() throws Exception {
        checkIn();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "systolicMmhg": 132,
                                  "diastolicMmhg": 84,
                                  "heartRateBpm": 72,
                                  "respiratoryRateBpm": 16,
                                  "spo2Percent": 98,
                                  "temperatureC": 36.8,
                                  "weightKg": 70.5,
                                  "heightCm": 170,
                                  "glycemiaGPerL": 0.95,
                                  "abdominalPerimeterCm": 92,
                                  "headCircumferenceCm": 56,
                                  "notes": "RAS"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.systolicMmhg").value(132))
                .andExpect(jsonPath("$.diastolicMmhg").value(84))
                .andExpect(jsonPath("$.heartRateBpm").value(72))
                .andExpect(jsonPath("$.respiratoryRateBpm").value(16))
                .andExpect(jsonPath("$.spo2Percent").value(98))
                .andExpect(jsonPath("$.temperatureC").value(36.8))
                .andExpect(jsonPath("$.weightKg").value(70.5))
                .andExpect(jsonPath("$.heightCm").value(170))
                .andExpect(jsonPath("$.glycemiaGPerL").value(0.95))
                .andExpect(jsonPath("$.abdominalPerimeterCm").value(92))
                .andExpect(jsonPath("$.headCircumferenceCm").value(56));

        // Garde DB explicite — les 3 nouvelles colonnes ne doivent pas être NULL.
        Integer fr = jdbc.queryForObject(
                "SELECT respiratory_rate_bpm FROM clinical_vital_signs WHERE appointment_id = ?",
                Integer.class, appointmentId);
        Number abdo = jdbc.queryForObject(
                "SELECT abdominal_perimeter_cm FROM clinical_vital_signs WHERE appointment_id = ?",
                Number.class, appointmentId);
        Number head = jdbc.queryForObject(
                "SELECT head_circumference_cm FROM clinical_vital_signs WHERE appointment_id = ?",
                Number.class, appointmentId);
        assertThat(fr).isEqualTo(16);
        assertThat(abdo.doubleValue()).isEqualTo(92.0);
        assertThat(head.doubleValue()).isEqualTo(56.0);
    }

    /**
     * Scénario 2 — Walk de bout en bout exact du bug report B1+B5 :
     *   1. SECRETAIRE prend les constantes en SDA (taille + FC seules)
     *   2. MEDECIN démarre la consultation depuis SDA
     *   3. MEDECIN signe la consultation
     *   4. GET /patients/{id}/vitals doit renvoyer la ligne avec
     *      heightCm + heartRateBpm + consultationId rétroactivement liée.
     *
     * Avant le fix B1, taille était présente en DB mais le composant FE
     * la filtrait. Avant le fix B5, le dossier patient ne lisait jamais
     * cet endpoint. Ce test verrouille la couche transport — la couche FE
     * est couverte par les tests Vitest siblings.
     */
    @Test
    @DisplayName("Walk SDA → consultation → clôture : GET /patients/{id}/vitals expose la mesure liée")
    void endToEnd_secInputsHeightFc_doctorClosesConsultation_dossierShowsBoth() throws Exception {
        // 1. Secrétaire en SDA : seul taille + FC saisis (cas exact du bug B1)
        checkIn();
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", secBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"heightCm\":170,\"heartRateBpm\":72}"))
                .andExpect(status().isCreated());

        // 2. Médecin démarre la consultation
        MvcResult started = mockMvc.perform(post("/api/consultations")
                        .header("Authorization", medBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "patientId": "%s",
                                  "appointmentId": "%s",
                                  "motif": "Contrôle"
                                }
                                """.formatted(patientId, appointmentId)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID consultationId = UUID.fromString(objectMapper
                .readTree(started.getResponse().getContentAsString())
                .get("id").asText());

        // 3. Médecin signe (clôture) la consultation après remplissage SOAP
        mockMvc.perform(put("/api/consultations/" + consultationId)
                        .header("Authorization", medBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "motif": "Contrôle",
                                  "examination": "Examen clinique normal",
                                  "diagnosis": "I10",
                                  "notes": "Renouvellement traitement"
                                }
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/consultations/" + consultationId + "/sign")
                        .header("Authorization", medBearer()))
                .andExpect(status().isOk());

        // 4. Le dossier patient (GET /patients/{id}/vitals) doit renvoyer la
        //    mesure complète avec consultationId rétroactivement lié.
        MvcResult historyRes = mockMvc.perform(get("/api/patients/" + patientId + "/vitals")
                        .header("Authorization", medBearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].heightCm").value(170))
                .andExpect(jsonPath("$[0].heartRateBpm").value(72))
                .andExpect(jsonPath("$[0].appointmentId").value(appointmentId.toString()))
                .andExpect(jsonPath("$[0].consultationId").value(consultationId.toString()))
                .andReturn();

        // 5. Et la liste expose aussi les 3 nouveaux champs (bien à null ici
        //    puisqu'ils n'ont pas été saisis), garantissant que le contrat DTO
        //    ne les omet pas accidentellement (sinon `usePatientVitalsHistory`
        //    dans le frontend planterait quand on les lit).
        JsonNode arr = objectMapper.readTree(historyRes.getResponse().getContentAsString());
        assertThat(arr).hasSize(1);
        JsonNode row = arr.get(0);
        assertThat(row.has("respiratoryRateBpm")).isTrue();
        assertThat(row.has("abdominalPerimeterCm")).isTrue();
        assertThat(row.has("headCircumferenceCm")).isTrue();
        // Les non-saisis sont bien null (pas absents, pas 0).
        assertThat(row.get("respiratoryRateBpm").isNull()).isTrue();
        assertThat(row.get("abdominalPerimeterCm").isNull()).isTrue();
        assertThat(row.get("headCircumferenceCm").isNull()).isTrue();
    }

    /**
     * Scénario 3 — POST /consultations rétro-rattache les vitals existantes
     * (linkUnlinkedToConsultation) avec les nouveaux champs préservés.
     * Reprend l'invariant déjà testé dans PriseConstantesIT mais le ré-affirme
     * sur les champs FR / abdo / cranien (B1).
     */
    @Test
    @DisplayName("Vitals saisies en SDA avec FR/abdo/cranien : POST /consultations préserve TOUT")
    void newColumns_arePreservedAcrossConsultationLink() throws Exception {
        checkIn();
        // Mesure complète sur les 3 nouveaux champs en SDA
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", secBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "heartRateBpm": 80,
                                  "respiratoryRateBpm": 18,
                                  "abdominalPerimeterCm": 88,
                                  "headCircumferenceCm": 36
                                }
                                """))
                .andExpect(status().isCreated());

        // Démarrer la consultation
        MvcResult started = mockMvc.perform(post("/api/consultations")
                        .header("Authorization", medBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "patientId": "%s",
                                  "appointmentId": "%s"
                                }
                                """.formatted(patientId, appointmentId)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID consultationId = UUID.fromString(objectMapper
                .readTree(started.getResponse().getContentAsString())
                .get("id").asText());

        // Le rattachement à la consultation ne doit pas perdre les nouveaux champs
        mockMvc.perform(get("/api/patients/" + patientId + "/vitals")
                        .header("Authorization", medBearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].consultationId").value(consultationId.toString()))
                .andExpect(jsonPath("$[0].respiratoryRateBpm").value(18))
                .andExpect(jsonPath("$[0].abdominalPerimeterCm").value(88))
                .andExpect(jsonPath("$[0].headCircumferenceCm").value(36));
    }

    /**
     * Scénario 4 — Garde de bornes : périmètre crânien hors plage (5 cm).
     * Backend @DecimalMin("20.0") doit rejeter → 400 VALIDATION.
     */
    @Test
    @DisplayName("POST /vitals avec headCircumferenceCm=5 hors plage : 400 VALIDATION")
    void headCircumference_outOfBound_returns400() throws Exception {
        checkIn();
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"headCircumferenceCm\":5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_vital_signs WHERE appointment_id = ?",
                Integer.class, appointmentId);
        assertThat(count).isZero();
    }

    /**
     * Scénario 5 — Garde de bornes : FR hors plage (-1).
     * Backend @Min(0) doit rejeter → 400 VALIDATION.
     */
    @Test
    @DisplayName("POST /vitals avec respiratoryRateBpm=-1 sous le minimum : 400 VALIDATION")
    void respiratoryRate_belowMinimum_returns400() throws Exception {
        checkIn();
        mockMvc.perform(post("/api/appointments/" + appointmentId + "/vitals")
                        .header("Authorization", asstBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"respiratoryRateBpm\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }

    /**
     * Scénario 6 — POST /consultations/{id}/vitals (ad-hoc, sans appointment)
     * accepte aussi les 3 nouveaux champs et les expose dans la réponse.
     * Garde la parité entre les deux endpoints d'écriture.
     */
    @Test
    @DisplayName("POST /consultations/{id}/vitals (ad-hoc) accepte aussi FR/abdo/cranien")
    void recordForConsultation_acceptsNewColumns() throws Exception {
        // Consultation ad-hoc sans appointment
        MvcResult started = mockMvc.perform(post("/api/consultations")
                        .header("Authorization", medBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "patientId": "%s",
                                  "motif": "Consultation directe"
                                }
                                """.formatted(patientId)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID consultationId = UUID.fromString(objectMapper
                .readTree(started.getResponse().getContentAsString())
                .get("id").asText());

        mockMvc.perform(post("/api/consultations/" + consultationId + "/vitals")
                        .header("Authorization", medBearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "respiratoryRateBpm": 14,
                                  "abdominalPerimeterCm": 95.5,
                                  "headCircumferenceCm": 57.2
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.respiratoryRateBpm").value(14))
                .andExpect(jsonPath("$.abdominalPerimeterCm").value(95.5))
                .andExpect(jsonPath("$.headCircumferenceCm").value(57.2))
                .andExpect(jsonPath("$.consultationId").value(consultationId.toString()));
    }
}
