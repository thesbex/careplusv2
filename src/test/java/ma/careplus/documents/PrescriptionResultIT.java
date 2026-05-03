package ma.careplus.documents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V015 — Résultat attaché à une ligne de prescription LAB / IMAGING.
 *
 * Workflow réel : le médecin prescrit une analyse en consultation, le
 * patient revient avec le résultat (PDF / image), le résultat doit
 * pouvoir être attaché DIRECTEMENT à la ligne de prescription d'origine
 * (pas seulement à la liste générale documents).
 *
 * SCÉNARIOS COUVERTS :
 *  1. Happy path LAB : attachement PDF → 200, line.resultDocumentId
 *     pointe vers le doc, /content sert le binaire bit-pour-bit.
 *  2. Happy path IMAGING : même chose avec une image.
 *  3. Remplacement : un 2e PUT soft-delete l'ancien résultat et
 *     repointe la ligne.
 *  4. DELETE : remet result_document_id à NULL et soft-delete le doc.
 *  5. Rejet métier : ligne médicament (medication_id) → 400
 *     RESULT_NOT_APPLICABLE, FK reste NULL.
 *  6. Rejet MIME : application/x-msdownload → 415 DOCUMENT_MIME_REJECTED.
 *  7. Ligne inconnue → 404 PRESCRIPTION_LINE_NOT_FOUND.
 *  8. Le RESULTAT n'apparaît PAS dans /api/patients/{id}/documents
 *     (anti-doublon — il est exposé via la ligne).
 *  9. RBAC PUT — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN autorisés.
 * 10. RBAC DELETE — SECRETAIRE 403 ; ASSISTANT 204.
 *
 * REGRESSION GUARD : reproduit le piège QA5 (JPA save + JdbcTemplate
 * UPDATE → FK violation si pas de flush). Le scénario 1 vérifie la
 * dénormalisation côté `clinical_prescription_line.result_document_id`
 * — toute regression du flush ramènerait un 500.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PrescriptionResultIT {

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
    private static final String PWD = "Result-Test-2026!";

    private static final byte[] TINY_PDF = "%PDF-1.4 fake bytes".getBytes();
    private static final byte[] TINY_PNG = "fake png bytes".getBytes();

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail, asstEmail, medEmail, adminEmail;
    UUID medId;
    UUID patientId;
    UUID consultationId;
    UUID labTestId;
    UUID imagingExamId;
    UUID medicationId;
    final Map<String, String> tokenCache = new HashMap<>();

    @BeforeEach
    void seed() {
        tokenCache.clear();
        rateLimitFilter.clearBucketsForTests();

        // Ordre FK-safe : casser les dénormalisations avant les targets.
        jdbc.update("UPDATE clinical_prescription_line SET result_document_id = NULL");
        jdbc.update("UPDATE patient_patient SET photo_document_id = NULL");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM patient_document");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");
        jdbc.update("DELETE FROM catalog_lab_test WHERE name LIKE 'IT-%'");
        jdbc.update("DELETE FROM catalog_imaging_exam WHERE name LIKE 'IT-%'");
        jdbc.update("DELETE FROM catalog_medication WHERE commercial_name LIKE 'IT-%'");

        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        asstEmail  = seedUser("asst",  ROLE_ASSISTANT);
        medEmail   = seedUser("med",   ROLE_MEDECIN);
        adminEmail = seedUser("admin", ROLE_ADMIN);

        // Le médecin est aussi le practitioner référence.
        medId = jdbc.queryForObject("SELECT id FROM identity_user WHERE email = ?", UUID.class, medEmail);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'Test', 'Patient', 'M', '1990-01-01', 'IT-RES-001',
                        0, 0, 'ACTIF', now(), now())
                """, patientId);

        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId);

        labTestId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_lab_test (id, code, name, category, active, created_at, updated_at)
                VALUES (?, 'IT-GLY', 'IT-Glycémie', 'BIOCHEMISTRY', TRUE, now(), now())
                """, labTestId);

        imagingExamId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_imaging_exam (id, code, name, modality, active, created_at, updated_at)
                VALUES (?, 'IT-RX', 'IT-Radio thorax', 'RADIO', TRUE, now(), now())
                """, imagingExamId);

        medicationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags,
                    favorite, active, created_at, updated_at)
                VALUES (?, 'IT-Doliprane', 'Paracétamol', 'comprimé', '1g', 'antalgique',
                        TRUE, TRUE, now(), now())
                """, medicationId);
    }

    @Test
    @DisplayName("1. Happy path LAB — PDF attaché, dénormalisation et binaire OK")
    void attachLabResult_pdf_storesBinary() throws Exception {
        UUID lineId = createPrescriptionLine("LAB");

        MockMultipartFile pdf = new MockMultipartFile("file", "result.pdf", "application/pdf", TINY_PDF);
        MvcResult r = mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                        .file(pdf)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("RESULTAT"))
                .andExpect(jsonPath("$.mimeType").value("application/pdf"))
                .andReturn();

        UUID docId = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());

        // Dénormalisation suit (le test prouve aussi que le flush JPA tourne :
        // le FK clinical_prescription_line_result_document_id_fkey passe).
        assertThat(jdbc.queryForObject(
                "SELECT result_document_id FROM clinical_prescription_line WHERE id = ?",
                UUID.class, lineId))
                .isEqualTo(docId);

        // Binaire récupérable bit-pour-bit.
        MvcResult dl = mockMvc.perform(get("/api/documents/" + docId + "/content")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(dl.getResponse().getContentAsByteArray()).isEqualTo(TINY_PDF);
    }

    @Test
    @DisplayName("2. Happy path IMAGING — image attachée")
    void attachImagingResult_png() throws Exception {
        UUID lineId = createPrescriptionLine("IMAGING");
        MockMultipartFile png = new MockMultipartFile("file", "rx.png", "image/png", TINY_PNG);

        mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                        .file(png)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mimeType").value("image/png"));
    }

    @Test
    @DisplayName("3. Remplacement — soft-delete de l'ancien, dénormalisation suit")
    void replacingResult_softDeletesPrevious() throws Exception {
        UUID lineId = createPrescriptionLine("LAB");
        UUID idA = upload(lineId, new MockMultipartFile("file", "a.pdf", "application/pdf", TINY_PDF));
        UUID idB = upload(lineId, new MockMultipartFile("file", "b.pdf", "application/pdf", TINY_PDF));

        assertThat(idA).isNotEqualTo(idB);
        assertThat(jdbc.queryForObject(
                "SELECT result_document_id FROM clinical_prescription_line WHERE id = ?",
                UUID.class, lineId))
                .isEqualTo(idB);

        Boolean aDeleted = jdbc.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM patient_document WHERE id = ?",
                Boolean.class, idA);
        assertThat(aDeleted).isTrue();
    }

    @Test
    @DisplayName("4. DELETE — remet result_document_id à NULL et soft-delete le doc")
    void deleteResult_clearsPointerAndSoftDeletes() throws Exception {
        UUID lineId = createPrescriptionLine("LAB");
        UUID docId = upload(lineId, new MockMultipartFile("file", "x.pdf", "application/pdf", TINY_PDF));

        mockMvc.perform(delete("/api/prescriptions/lines/" + lineId + "/result")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject(
                "SELECT result_document_id FROM clinical_prescription_line WHERE id = ?",
                UUID.class, lineId))
                .isNull();

        Boolean deleted = jdbc.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM patient_document WHERE id = ?",
                Boolean.class, docId);
        assertThat(deleted).isTrue();
    }

    @Test
    @DisplayName("5. Ligne médicament rejetée — 400 RESULT_NOT_APPLICABLE")
    void medicationLineRejected() throws Exception {
        UUID lineId = createPrescriptionLine("DRUG");
        MockMultipartFile pdf = new MockMultipartFile("file", "x.pdf", "application/pdf", TINY_PDF);

        mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                        .file(pdf)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("RESULT_NOT_APPLICABLE"));

        // FK ne doit pas avoir été touchée.
        assertThat(jdbc.queryForObject(
                "SELECT result_document_id FROM clinical_prescription_line WHERE id = ?",
                UUID.class, lineId))
                .isNull();
    }

    @Test
    @DisplayName("6. MIME rejeté — 415 DOCUMENT_MIME_REJECTED")
    void unsupportedMimeRejected() throws Exception {
        UUID lineId = createPrescriptionLine("LAB");
        MockMultipartFile evil = new MockMultipartFile(
                "file", "evil.exe", "application/x-msdownload", new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                        .file(evil)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("DOCUMENT_MIME_REJECTED"));
    }

    @Test
    @DisplayName("7. Ligne inconnue — 404 PRESCRIPTION_LINE_NOT_FOUND")
    void unknownLineRejected() throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("file", "x.pdf", "application/pdf", TINY_PDF);
        mockMvc.perform(multipart("/api/prescriptions/lines/" + UUID.randomUUID() + "/result")
                        .file(pdf)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PRESCRIPTION_LINE_NOT_FOUND"));
    }

    @Test
    @DisplayName("8. Le RESULTAT n'apparaît pas dans /patients/{id}/documents")
    void resultDoesNotPolluteDocumentsList() throws Exception {
        UUID lineId = createPrescriptionLine("LAB");
        upload(lineId, new MockMultipartFile("file", "x.pdf", "application/pdf", TINY_PDF));

        mockMvc.perform(get("/api/patients/" + patientId + "/documents")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("9. RBAC PUT — Secrétaire/Assistant/Médecin/Admin autorisés")
    void allFourRolesCanAttach() throws Exception {
        for (String email : new String[]{secEmail, asstEmail, medEmail, adminEmail}) {
            UUID lineId = createPrescriptionLine("LAB");
            MockMultipartFile pdf = new MockMultipartFile("file", "x.pdf", "application/pdf", TINY_PDF);
            mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                            .file(pdf)
                            .with(req -> { req.setMethod("PUT"); return req; })
                            .header("Authorization", bearer(email)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("10. RBAC DELETE — Secrétaire 403, Assistant 204")
    void deleteRbac() throws Exception {
        UUID lineId = createPrescriptionLine("LAB");
        upload(lineId, new MockMultipartFile("file", "x.pdf", "application/pdf", TINY_PDF));

        mockMvc.perform(delete("/api/prescriptions/lines/" + lineId + "/result")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/prescriptions/lines/" + lineId + "/result")
                        .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isNoContent());
    }

    // ---------- helpers ----------

    /**
     * Crée une prescription + une ligne du type demandé via l'API. Retourne
     * l'id de la ligne. Préférable à un INSERT direct : on couvre le chemin
     * de création et on aligne sur le contrat HTTP réel.
     */
    private UUID createPrescriptionLine(String kind) throws Exception {
        String body = switch (kind) {
            case "LAB" -> """
                    {"type":"LAB","lines":[{"labTestId":"%s","instructions":"À jeun"}]}
                    """.formatted(labTestId);
            case "IMAGING" -> """
                    {"type":"IMAGING","lines":[{"imagingExamId":"%s","instructions":"Profil debout"}]}
                    """.formatted(imagingExamId);
            case "DRUG" -> """
                    {"type":"DRUG","lines":[{"medicationId":"%s","dosage":"1 cp","frequency":"3x/j","duration":"5j","quantity":15}]}
                    """.formatted(medicationId);
            default -> throw new IllegalArgumentException(kind);
        };
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode root = objectMapper.readTree(r.getResponse().getContentAsString());
        return UUID.fromString(root.get("lines").get(0).get("id").asText());
    }

    private UUID upload(UUID lineId, MockMultipartFile file) throws Exception {
        MvcResult r = mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                        .file(file)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(PWD), prefix, "Test",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return email;
    }

    private String tokenFor(String email) throws Exception {
        if (tokenCache.containsKey(email)) return tokenCache.get(email);
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String token = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
        tokenCache.put(email, token);
        return token;
    }

    private String bearer(String email) throws Exception {
        return "Bearer " + tokenFor(email);
    }
}
