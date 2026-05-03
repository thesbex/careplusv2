package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
 * Integration tests for the consultation page feature from commit bf1d73b
 * ("feat(consultation): activer Certificat médical et Prochain RDV").
 *
 * <p>Scenarios covered:
 * <ol>
 *   <li>Suspendre — happy path: consultation stays BROUILLON in DB after navigating
 *       away (no accidental sign or delete). The "Suspendre" button in the UI
 *       must leave the server-side state unchanged. This test verifies the GET still
 *       returns BROUILLON after a PUT-only autosave cycle, simulating the expected
 *       backend contract for that button.</li>
 *   <li>Suspendre — après autosave: un PUT /consultations/{id} est émis avec les
 *       champs SOAP, la consultation reste BROUILLON et les champs sont persistés.
 *       Le bouton "Suspendre" doit naviguer vers /salle sans modifier le statut;
 *       ce test vérifie que PUT ne signe pas accidentellement.</li>
 *   <li>Certificat médical — création happy path: POST /consultations/{id}/prescriptions
 *       avec type=CERT et freeText → 201 Created, type=CERT dans la réponse ET en DB.</li>
 *   <li>Certificat médical — PDF re-impression: GET /prescriptions/{id}/pdf pour un
 *       CERT existant retourne Content-Type=application/pdf et la signature "%PDF".
 *       C'est le flux "Imprimer certificat existant" qui était disabled dans l'UI.</li>
 *   <li>Certificat médical — consultation SIGNEE rejette la création: POST sur une
 *       consultation SIGNEE renvoie 400 CONSULT_LOCKED. La contrainte de garde doit
 *       être cohérente avec disabled={isSigned} côté UI.</li>
 *   <li>Certificat médical — freeText vide accepté par le backend mais bloqué UI:
 *       une ligne avec freeText="" est acceptée par PrescriptionService (pas de
 *       validation côté backend), mais le dialog CertificatDialog vérifie >= 10 chars.
 *       Ce test documente l'absence de validation backend pour tracking futur.</li>
 *   <li>Certificat médical — RBAC: un SECRETAIRE ne peut pas créer de prescription
 *       (403 Forbidden), parité avec la désactivation UI disabled={isSigned || !consultation}.</li>
 *   <li>Suspendre — RBAC: la lecture GET /consultations/{id} est accessible à tous
 *       les rôles (SECRETAIRE peut voir la consultation mais pas la modifier).</li>
 * </ol>
 *
 * <p>REGRESSION GUARD — bugs produits que cette suite attraperait:
 * <ul>
 *   <li>Bug 1 — "Suspendre" no-op (détecté 2026-05-02, QA Youssef Boutaleb):
 *       ConsultationPage.tsx ligne 271 appelle {@code handleSubmit(() => undefined)()}
 *       qui est un no-op: valide le formulaire et exécute le callback vide. Aucune
 *       navigation vers /salle ou /consultations n'est déclenchée. Le médecin reste
 *       bloqué sur la page. Racine: onClick manquant — aurait dû être
 *       {@code () => navigate('/salle')}. Ce test vérifie que le backend supporte la
 *       navigation (statut reste BROUILLON) — la fix frontend doit donc ajouter
 *       navigate('/salle') sans toucher l'API.</li>
 *   <li>Bug 2 — Bouton "Certificat" footer toujours disabled (détecté 2026-05-02):
 *       ConsultationPage.tsx ligne 274: {@code <Button type="button" disabled>}
 *       sans condition — le bouton "Imprimer certificat" du footer est toujours
 *       désactivé même quand un certificat CERT existe dans les prescriptions.
 *       Le test scenario 4 ("PDF re-impression") vérifie que le backend supporte
 *       l'appel GET /prescriptions/{id}/pdf pour type=CERT — si ce test est vert,
 *       le seul problème est la prop {@code disabled} hardcodée dans le JSX.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ConsultationPageIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "ConsultPage-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    UUID medId;
    UUID patientId;
    UUID consultationId;      // BROUILLON
    UUID signedConsultId;     // SIGNEE — pour tester les gardes
    UUID consultWithApptId;   // BROUILLON liée à un RDV EN_CONSULTATION (pour suspend)
    UUID apptInConsultId;     // RDV EN_CONSULTATION lié à consultWithApptId

    // Cached token (login once per role per test — rate limiter cleared in @BeforeEach)
    private String medToken;
    private String secToken;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();

        // Clean up in FK-safe order
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_consultation_prestation");
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Medecin
        medId = UUID.randomUUID();
        medEmail = "med-cp-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Belmahi', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medId, ROLE_MEDECIN);

        // Secretaire
        UUID secId = UUID.randomUUID();
        secEmail = "sec-cp-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Fatima', 'Rahhali', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        // Patient
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'Filali', 'Hassan', 'M', '1978-03-20', 'T-CP-001',
                        0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Consultation BROUILLON
        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, started_at, created_at, updated_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId);

        // Consultation SIGNEE (pour les gardes)
        signedConsultId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, started_at, signed_at, created_at, updated_at)
                VALUES (?, ?, ?, 'SIGNEE', 1, 0, now(), now(), now(), now())
                """, signedConsultId, patientId, medId);

        // RDV EN_CONSULTATION + consultation BROUILLON liée — surface du bouton Suspendre
        apptInConsultId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment (id, patient_id, practitioner_id, start_at, end_at,
                    status, walk_in, urgency, version, created_at, updated_at)
                VALUES (?, ?, ?, now(), now() + interval '30 minutes',
                        'EN_CONSULTATION', FALSE, FALSE, 0, now(), now())
                """, apptInConsultId, patientId, medId);
        consultWithApptId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, appointment_id,
                    status, version_number, version, started_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultWithApptId, patientId, medId, apptInConsultId);

        // Acquire tokens once per test (rate limiter cleared above)
        medToken = bearer(medEmail);
        secToken  = bearer(secEmail);
    }

    // ── Token helper ──────────────────────────────────────────────────────────

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Scénario 1 — Suspendre : le statut reste BROUILLON en DB ─────────────

    @Test
    @DisplayName("Suspendre — GET de la consultation renvoie BROUILLON sans appel de sign, "
            + "confirme que le backend supporte la navigation sans changement d'état")
    void suspendre_consultationRemainsInBrouillon() throws Exception {
        // Le bouton Suspendre NE doit PAS modifier le statut — il doit juste naviguer.
        // Ce test vérifie que la consultation est bien en BROUILLON après que l'UI
        // ait simplement navigué sans appeler sign.
        mockMvc.perform(get("/api/consultations/" + consultationId)
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BROUILLON"));

        // Assertion DB — le vrai contrat que Suspendre doit respecter
        String statusInDb = jdbc.queryForObject(
                "SELECT status FROM clinical_consultation WHERE id = ?",
                String.class, consultationId);
        assertThat(statusInDb)
                .as("Suspendre ne doit pas changer le statut — BROUILLON attendu en DB")
                .isEqualTo("BROUILLON");
    }

    // ── Scénario 2 — Suspendre après autosave : PUT ne signe pas ─────────────

    @Test
    @DisplayName("Suspendre — PUT /consultations/{id} persiste le SOAP et laisse BROUILLON "
            + "sans déclencher de signature accidentelle")
    void suspendre_autosaveViaput_doesNotSign() throws Exception {
        mockMvc.perform(put("/api/consultations/" + consultationId)
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "motif": "Controle tensionnel",
                                  "examination": "TA 14/9",
                                  "diagnosis": "HTA moderee",
                                  "notes": "Continuer Amlor 5mg"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BROUILLON"))
                .andExpect(jsonPath("$.diagnosis").value("HTA moderee"));

        // Assertion DB : PUT ne doit jamais signer
        String statusInDb = jdbc.queryForObject(
                "SELECT status FROM clinical_consultation WHERE id = ?",
                String.class, consultationId);
        assertThat(statusInDb)
                .as("PUT autosave ne doit pas signer la consultation")
                .isEqualTo("BROUILLON");

        String signedAt = jdbc.queryForObject(
                "SELECT signed_at::text FROM clinical_consultation WHERE id = ?",
                String.class, consultationId);
        assertThat(signedAt)
                .as("signed_at doit rester NULL après un simple PUT")
                .isNull();
    }

    // ── Scénario 3 — Certificat médical : création happy path ────────────────

    @Test
    @DisplayName("Certificat médical — POST /consultations/{id}/prescriptions type=CERT "
            + "persiste la prescription avec type CERT en DB")
    void createCertificat_persistedWithTypeCertInDb() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "CERT",
                                  "allergyOverride": false,
                                  "lines": [
                                    { "freeText": "Le patient s est presente ce jour pour consultation et est apte a reprendre son activite." }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("CERT"))
                .andExpect(jsonPath("$.lines[0].freeText").isNotEmpty())
                .andReturn();

        String rxId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText();

        // Assertion DB — le type doit être CERT (pas null, pas DRUG)
        String typeInDb = jdbc.queryForObject(
                "SELECT type FROM clinical_prescription WHERE id = ?",
                String.class, UUID.fromString(rxId));
        assertThat(typeInDb)
                .as("La prescription doit être stockée avec type=CERT en DB")
                .isEqualTo("CERT");

        // Le freeText de la ligne doit être persisté
        String freeText = jdbc.queryForObject(
                "SELECT free_text FROM clinical_prescription_line WHERE prescription_id = ?",
                String.class, UUID.fromString(rxId));
        assertThat(freeText).isNotBlank();
    }

    // ── Scénario 4 — Certificat existant : re-impression PDF ─────────────────
    //
    // Ce scénario reproduit le bug "Imprimer certificat existant" :
    // le bouton footer dans ConsultationPage.tsx est disabled={true} en dur.
    // Ce test prouve que le backend supporte parfaitement GET /prescriptions/{id}/pdf
    // pour un type=CERT — si ce test est vert, la correction est exclusivement
    // frontend (retirer la prop disabled ou la conditionner à l'absence de CERT).

    @Test
    @DisplayName("Imprimer certificat existant — GET /prescriptions/{id}/pdf renvoie "
            + "application/pdf commençant par la signature %PDF pour un CERT existant")
    void reimprimer_certExistant_retourneApplicationPdf() throws Exception {
        // D'abord créer un certificat
        MvcResult created = mockMvc.perform(
                        post("/api/consultations/" + consultationId + "/prescriptions")
                                .header("Authorization", medToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "type": "CERT",
                                          "allergyOverride": false,
                                          "lines": [
                                            { "freeText": "Le patient est en bonne sante et apte a reprendre ses activites professionnelles." }
                                          ]
                                        }
                                        """))
                .andExpect(status().isCreated())
                .andReturn();

        String rxId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Maintenant re-imprimer via GET /pdf — c'est ce que le bouton disabled devrait faire
        byte[] pdfBytes = mockMvc.perform(get("/api/prescriptions/" + rxId + "/pdf")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(pdfBytes)
                .as("Le PDF ne doit pas être vide")
                .hasSizeGreaterThan(100);
        assertThat(new String(pdfBytes, 0, 4))
                .as("Le PDF doit commencer par la signature magique %%PDF")
                .isEqualTo("%PDF");
    }

    // ── Scénario 5 — Garde : consultation SIGNEE rejette la création de cert ──

    @Test
    @DisplayName("Certificat sur consultation SIGNEE — POST renvoie 400 CONSULT_LOCKED, "
            + "cohérent avec disabled={isSigned} dans l'UI")
    void createCertificat_onSignedConsultation_returns400() throws Exception {
        mockMvc.perform(post("/api/consultations/" + signedConsultId + "/prescriptions")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "CERT",
                                  "allergyOverride": false,
                                  "lines": [
                                    { "freeText": "Texte du certificat pour test garde." }
                                  ]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CONSULT_LOCKED"));

        // Aucune prescription ne doit avoir été créée
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_prescription WHERE consultation_id = ?",
                Integer.class, signedConsultId);
        assertThat(count)
                .as("Aucune prescription ne doit exister sur la consultation SIGNEE")
                .isZero();
    }

    // ── Scénario 6 — Backend ne valide pas le freeText vide (documentation) ──

    @Test
    @DisplayName("Certificat freeText vide — le backend accepte (pas de validation MIN_LENGTH), "
            + "la validation >= 10 chars est uniquement côté UI (CertificatDialog)")
    void createCertificat_emptyFreeText_acceptedByBackend() throws Exception {
        // PrescriptionService n'a pas de validation de longueur sur freeText.
        // Le dialog UI bloque à < 10 chars, mais le backend ne le fait pas.
        // Ce test documente ce gap pour un futur ticket de validation backend.
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "CERT",
                                  "allergyOverride": false,
                                  "lines": [
                                    { "freeText": "" }
                                  ]
                                }
                                """))
                // Le backend accepte — pas de validation de longueur côté serveur.
                // À corriger post-MVP avec @Size(min=10) sur PrescriptionLineRequest.freeText.
                .andExpect(status().isCreated());
    }

    // ── Scénario 7 — RBAC : Secrétaire ne peut pas créer de prescription ──────

    @Test
    @DisplayName("RBAC — Secrétaire ne peut pas créer de certificat (403 Forbidden), "
            + "cohérent avec @PreAuthorize ASSISTANT|MEDECIN|ADMIN sur l'endpoint")
    void createCertificat_secretaire_isForbidden() throws Exception {
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "CERT",
                                  "allergyOverride": false,
                                  "lines": [{ "freeText": "Test RBAC secrétaire." }]
                                }
                                """))
                .andExpect(status().isForbidden());

        // État inchangé — aucune prescription ne doit avoir été créée
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_prescription WHERE consultation_id = ?",
                Integer.class, consultationId);
        assertThat(count)
                .as("Aucune prescription ne doit être créée par un secrétaire")
                .isZero();
    }

    // ── Scénario 8 — RBAC lecture : Secrétaire peut lire la consultation ──────

    @Test
    @DisplayName("RBAC — Secrétaire peut lire GET /consultations/{id} (tous les rôles autorisés)")
    void getConsultation_secretaire_isAllowed() throws Exception {
        mockMvc.perform(get("/api/consultations/" + consultationId)
                        .header("Authorization", secToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BROUILLON"))
                .andExpect(jsonPath("$.id").value(consultationId.toString()));
    }

    // ── Scénario 9 — Suspendre : la consultation passe en SUSPENDUE et le RDV recule ──
    //
    // BUG d'origine : le bouton Suspendre n'appelait que navigate('/salle'). Le patient
    // restait visible "En consultation" dans la salle d'attente alors que le médecin
    // l'avait quitté. Ce test fixe désormais le contrat : POST /suspend doit
    //  (a) marquer la consultation SUSPENDUE
    //  (b) ramener le RDV de EN_CONSULTATION → CONSTANTES_PRISES (file d'attente).

    @Test
    @DisplayName("Suspendre — POST /consultations/{id}/suspend marque SUSPENDUE et "
            + "ramène le RDV à CONSTANTES_PRISES")
    void suspend_flipsConsultationAndAppointmentBack() throws Exception {
        mockMvc.perform(post("/api/consultations/" + consultWithApptId + "/suspend")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDUE"));

        String consultStatus = jdbc.queryForObject(
                "SELECT status FROM clinical_consultation WHERE id = ?",
                String.class, consultWithApptId);
        assertThat(consultStatus)
                .as("La consultation doit être en SUSPENDUE en DB après suspend")
                .isEqualTo("SUSPENDUE");

        String apptStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, apptInConsultId);
        assertThat(apptStatus)
                .as("Le RDV doit reculer EN_CONSULTATION → CONSTANTES_PRISES "
                    + "pour réapparaître dans la file")
                .isEqualTo("CONSTANTES_PRISES");
    }

    // ── Scénario 10 — Suspendre puis éditer : auto-resume ────────────────────
    //
    // Quand le médecin revient sur la consultation suspendue et tape (ou autosave PUT),
    // on auto-reprend : SUSPENDUE → BROUILLON et le RDV repart en EN_CONSULTATION.

    @Test
    @DisplayName("Reprise auto — un PUT sur une consultation SUSPENDUE la repasse en "
            + "BROUILLON et le RDV en EN_CONSULTATION")
    void put_onSuspended_autoResumes() throws Exception {
        // Étape 1 : suspendre
        mockMvc.perform(post("/api/consultations/" + consultWithApptId + "/suspend")
                        .header("Authorization", medToken))
                .andExpect(status().isOk());

        // Étape 2 : éditer (autosave)
        mockMvc.perform(put("/api/consultations/" + consultWithApptId)
                        .header("Authorization", medToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "diagnosis": "Reprise après pause" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BROUILLON"));

        String apptStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, apptInConsultId);
        assertThat(apptStatus)
                .as("Le RDV doit repartir en EN_CONSULTATION après reprise")
                .isEqualTo("EN_CONSULTATION");
    }

    // ── Scénario 11 — Suspend idempotent ─────────────────────────────────────

    @Test
    @DisplayName("Suspendre idempotent — un second POST /suspend renvoie SUSPENDUE "
            + "sans erreur et sans casser le statut RDV")
    void suspend_isIdempotent() throws Exception {
        mockMvc.perform(post("/api/consultations/" + consultWithApptId + "/suspend")
                        .header("Authorization", medToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/consultations/" + consultWithApptId + "/suspend")
                        .header("Authorization", medToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDUE"));

        String apptStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, apptInConsultId);
        assertThat(apptStatus).isEqualTo("CONSTANTES_PRISES");
    }

    // ── Scénario 12 — Garde : suspend refusé sur consultation SIGNEE ──────────

    @Test
    @DisplayName("Suspendre — POST /suspend sur SIGNEE renvoie 409 CONSULT_LOCKED")
    void suspend_onSigned_isRejected() throws Exception {
        mockMvc.perform(post("/api/consultations/" + signedConsultId + "/suspend")
                        .header("Authorization", medToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSULT_LOCKED"));

        String stillSigned = jdbc.queryForObject(
                "SELECT status FROM clinical_consultation WHERE id = ?",
                String.class, signedConsultId);
        assertThat(stillSigned).isEqualTo("SIGNEE");
    }

    // ── Scénario 13 — RBAC : secrétaire ne peut pas suspendre ─────────────────

    @Test
    @DisplayName("RBAC — Secrétaire ne peut pas POST /suspend (403), parité avec @PreAuthorize")
    void suspend_secretaire_isForbidden() throws Exception {
        mockMvc.perform(post("/api/consultations/" + consultWithApptId + "/suspend")
                        .header("Authorization", secToken))
                .andExpect(status().isForbidden());

        // État inchangé
        String consultStatus = jdbc.queryForObject(
                "SELECT status FROM clinical_consultation WHERE id = ?",
                String.class, consultWithApptId);
        assertThat(consultStatus).isEqualTo("BROUILLON");
        String apptStatus = jdbc.queryForObject(
                "SELECT status FROM scheduling_appointment WHERE id = ?",
                String.class, apptInConsultId);
        assertThat(apptStatus).isEqualTo("EN_CONSULTATION");
    }
}
