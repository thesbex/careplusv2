package ma.careplus.documents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * QA5-3 — Photo patient. Tests construits comme une checklist QA manuelle :
 * chaque scénario (ce qu'un testeur ferait pas-à-pas) est un @Test isolé,
 * nommé par DisplayName en français.
 *
 * SCÉNARIOS COUVERTS :
 *  1. Happy path PNG : Médecin ouvre un dossier sans photo, téléverse photo.png →
 *     200, patient_document.PHOTO créé, patient_patient.photo_document_id renseigné,
 *     l'URL /api/documents/{id}/content sert le binaire exact.
 *  2. Happy path JPEG : même chose avec image/jpeg.
 *  3. Remplacement : on téléverse une 2e photo → l'ancienne est soft-deletée
 *     (deleted_at non null), la nouvelle prend la dénormalisation, photo_document_id
 *     pointe vers la nouvelle.
 *  4. Suppression : DELETE /photo → 204, soft-delete de la PHOTO active,
 *     photo_document_id remis à NULL, /content sur l'ancien doc renvoie 404.
 *  5. MIME rejeté (PDF) : 415 avec code DOCUMENT_MIME_REJECTED, photo_document_id reste NULL.
 *  6. MIME rejeté (text) : idem 415.
 *  7. Taille limite : un fichier > 2 Mo est rejeté en 413 DOCUMENT_TOO_LARGE.
 *  8. Fichier vide : 400 DOCUMENT_EMPTY.
 *  9. Patient inconnu : 404 PATIENT_NOT_FOUND, photo_document_id non créé.
 * 10. RBAC PUT : SECRETAIRE/ASSISTANT/MEDECIN/ADMIN autorisés (capture du flux assistant).
 * 11. RBAC DELETE : SECRETAIRE refusé (403), ASSISTANT/MEDECIN autorisés.
 * 12. La PHOTO n'apparaît jamais dans la liste documents historiques (filtrée
 *     par DocumentType.PHOTO dans findActiveByPatient — sinon le rectangle "Photo"
 *     du panneau Modifier polluerait le panneau Documents).
 *
 * REGRESSION GUARD : la combinaison `repository.save(...)` JPA puis
 * `jdbc.update("UPDATE patient_patient SET photo_document_id = ?")` raw a fait
 * sauter QA5 le 2026-05-01 (FK violation, INSERT non flushé). Les scénarios
 * 1/2/3 vérifient que photo_document_id pointe bien vers la PHOTO active —
 * ce qui aurait attrapé le 500 du jour.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PatientPhotoIT {

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

    private static final String PWD = "Care-Plus-Test-2026!";

    // Tiny but valid 1x1 PNG (real header — quelques décodeurs strictes le
    // veulent, et MockMultipartFile transmet content-type tel quel).
    private static final byte[] TINY_PNG = new byte[]{
            (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A,
            0, 0, 0, 0x0D, 'I', 'H', 'D', 'R',
            0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0,
            0x1F, 0x15, (byte) 0xC4, (byte) 0x89,
            0, 0, 0, 0x0A, 'I', 'D', 'A', 'T',
            0x78, (byte) 0x9C, 0x63, 0, 1, 0, 0, 5, 0, 1,
            0x0D, 0x0A, 0x2D, (byte) 0xB4,
            0, 0, 0, 0, 'I', 'E', 'N', 'D', (byte) 0xAE, 0x42, 0x60, (byte) 0x82
    };

    private static final byte[] TINY_JPEG = new byte[]{
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9
    };

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail;
    String asstEmail;
    String medEmail;
    String adminEmail;
    final Map<String, String> tokenCache = new HashMap<>();

    @BeforeEach
    void seed() {
        tokenCache.clear();
        rateLimitFilter.clearBucketsForTests();
        // photo_document_id FK pointe vers patient_document — on doit casser
        // la dénormalisation AVANT de purger patient_document.
        jdbc.update("UPDATE patient_patient SET photo_document_id = NULL");
        jdbc.update("DELETE FROM patient_document");
        jdbc.update("DELETE FROM patient_note");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM patient_antecedent");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        asstEmail  = seedUser("asst",  ROLE_ASSISTANT);
        medEmail   = seedUser("med",   ROLE_MEDECIN);
        adminEmail = seedUser("admin", ROLE_ADMIN);
    }

    @Test
    @DisplayName("1. Happy path — médecin téléverse un PNG, dénormalisation et binaire OK")
    void medecin_uploadsPng_storesBinary_andDenormalizesPointer() throws Exception {
        // QA manuel : ouvre dossier patient sans photo → clique Modifier →
        //   Photo → Téléverser → choisit photo.png → la photo doit apparaître.
        String patientId = createPatient();

        MockMultipartFile png = new MockMultipartFile("file", "photo.png", "image/png", TINY_PNG);
        MvcResult res = mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                        .file(png)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("PHOTO"))
                .andExpect(jsonPath("$.mimeType").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(TINY_PNG.length))
                .andReturn();

        String docId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // Dénormalisation visible côté patient (le bug QA5 du 2026-05-01
        // bloquait précisément cette assertion : photo_document_id restait NULL
        // car la transaction rollbackait sur FK).
        assertThat(jdbc.queryForObject(
                "SELECT photo_document_id FROM patient_patient WHERE id = ?",
                UUID.class, UUID.fromString(patientId)))
                .isEqualTo(UUID.fromString(docId));

        // Le binaire servi est bit-pour-bit celui qu'on a téléversé.
        MvcResult dl = mockMvc.perform(get("/api/documents/" + docId + "/content")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(dl.getResponse().getContentAsByteArray()).isEqualTo(TINY_PNG);
        assertThat(dl.getResponse().getContentType()).startsWith("image/png");
    }

    @Test
    @DisplayName("2. Happy path — JPEG accepté (image/jpeg)")
    void jpegAccepted() throws Exception {
        String patientId = createPatient();
        MockMultipartFile jpeg = new MockMultipartFile("file", "photo.jpg", "image/jpeg", TINY_JPEG);

        mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                        .file(jpeg)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mimeType").value("image/jpeg"));
    }

    @Test
    @DisplayName("3. Remplacement — la nouvelle photo soft-delete l'ancienne, dénormalisation suit")
    void replacingPhoto_softDeletesPrevious_andRepoints() throws Exception {
        // QA manuel : téléverse photo A, puis téléverse photo B → l'avatar
        //   change ; l'historique des documents ne doit jamais lister la PHOTO
        //   (panneau séparé) et l'ancienne doit être marquée deleted_at.
        String patientId = createPatient();
        MockMultipartFile a = new MockMultipartFile("file", "a.png", "image/png", TINY_PNG);
        MockMultipartFile b = new MockMultipartFile("file", "b.png", "image/png", TINY_PNG);

        String idA = upload(patientId, a, medEmail);
        String idB = upload(patientId, b, medEmail);

        assertThat(idA).isNotEqualTo(idB);

        // Dénormalisation pointe sur B.
        assertThat(jdbc.queryForObject(
                "SELECT photo_document_id FROM patient_patient WHERE id = ?",
                UUID.class, UUID.fromString(patientId)))
                .isEqualTo(UUID.fromString(idB));

        // A est soft-deletée.
        Boolean aDeleted = jdbc.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM patient_document WHERE id = ?",
                Boolean.class, UUID.fromString(idA));
        assertThat(aDeleted).isTrue();

        // B est active.
        Boolean bDeleted = jdbc.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM patient_document WHERE id = ?",
                Boolean.class, UUID.fromString(idB));
        assertThat(bDeleted).isFalse();
    }

    @Test
    @DisplayName("4. Suppression — DELETE remet photo_document_id à NULL, /content devient 404")
    void deletePhoto_clearsPointer_andHidesBinary() throws Exception {
        String patientId = createPatient();
        MockMultipartFile png = new MockMultipartFile("file", "photo.png", "image/png", TINY_PNG);
        String docId = upload(patientId, png, medEmail);

        mockMvc.perform(delete("/api/patients/" + patientId + "/photo")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject(
                "SELECT photo_document_id FROM patient_patient WHERE id = ?",
                UUID.class, UUID.fromString(patientId)))
                .isNull();

        // Le binaire ne doit plus être servi.
        mockMvc.perform(get("/api/documents/" + docId + "/content")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DOCUMENT_NOT_FOUND"));
    }

    @Test
    @DisplayName("5. PDF rejeté — 415 DOCUMENT_MIME_REJECTED, dénormalisation intacte")
    void pdfRejected() throws Exception {
        String patientId = createPatient();
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "scan.pdf", "application/pdf", "%PDF-1.4 …".getBytes());

        mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                        .file(pdf)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("DOCUMENT_MIME_REJECTED"));

        assertThat(jdbc.queryForObject(
                "SELECT photo_document_id FROM patient_patient WHERE id = ?",
                UUID.class, UUID.fromString(patientId)))
                .isNull();
    }

    @Test
    @DisplayName("6. text/plain rejeté — 415 DOCUMENT_MIME_REJECTED")
    void textRejected() throws Exception {
        String patientId = createPatient();
        MockMultipartFile txt = new MockMultipartFile(
                "file", "note.txt", "text/plain", "not an image".getBytes());

        mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                        .file(txt)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("DOCUMENT_MIME_REJECTED"));
    }

    @Test
    @DisplayName("7. > 2 Mo rejeté — 413 DOCUMENT_TOO_LARGE")
    void oversizeRejected() throws Exception {
        String patientId = createPatient();
        byte[] big = new byte[2 * 1024 * 1024 + 1];
        MockMultipartFile png = new MockMultipartFile("file", "huge.png", "image/png", big);

        mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                        .file(png)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("DOCUMENT_TOO_LARGE"));
    }

    @Test
    @DisplayName("8. Fichier vide — 400 DOCUMENT_EMPTY")
    void emptyRejected() throws Exception {
        String patientId = createPatient();
        MockMultipartFile empty = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                        .file(empty)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DOCUMENT_EMPTY"));
    }

    @Test
    @DisplayName("9. Patient inconnu — 404 PATIENT_NOT_FOUND")
    void unknownPatient() throws Exception {
        MockMultipartFile png = new MockMultipartFile("file", "photo.png", "image/png", TINY_PNG);

        mockMvc.perform(multipart("/api/patients/" + UUID.randomUUID() + "/photo")
                        .file(png)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PATIENT_NOT_FOUND"));
    }

    @Test
    @DisplayName("10. RBAC PUT — Secrétaire/Assistant/Médecin/Admin sont autorisés")
    void allFourRolesCanUpload() throws Exception {
        for (String email : new String[]{secEmail, asstEmail, medEmail, adminEmail}) {
            String patientId = createPatient();
            MockMultipartFile png = new MockMultipartFile("file", "photo.png", "image/png", TINY_PNG);
            mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                            .file(png)
                            .with(req -> { req.setMethod("PUT"); return req; })
                            .header("Authorization", bearer(email)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("11. RBAC DELETE — Secrétaire 403, Assistant/Médecin 204")
    void deleteRbac() throws Exception {
        String patientId = createPatient();
        MockMultipartFile png = new MockMultipartFile("file", "photo.png", "image/png", TINY_PNG);
        upload(patientId, png, medEmail);

        mockMvc.perform(delete("/api/patients/" + patientId + "/photo")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/patients/" + patientId + "/photo")
                        .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("12. La PHOTO n'apparaît pas dans la liste documents historiques")
    void photoIsHiddenFromDocumentsList() throws Exception {
        String patientId = createPatient();
        MockMultipartFile png = new MockMultipartFile("file", "photo.png", "image/png", TINY_PNG);
        upload(patientId, png, medEmail);

        // En plus, on téléverse un document non-photo pour vérifier que la liste
        // contient bien le doc historique mais pas la PHOTO.
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "compte-rendu.pdf", "application/pdf", "%PDF-1.4".getBytes());
        mockMvc.perform(multipart("/api/patients/" + patientId + "/documents")
                        .file(pdf)
                        .param("type", "COMPTE_RENDU")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/patients/" + patientId + "/documents")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("COMPTE_RENDU"));
    }

    // ---------- helpers ----------

    private String upload(String patientId, MockMultipartFile file, String email) throws Exception {
        MvcResult res = mockMvc.perform(multipart("/api/patients/" + patientId + "/photo")
                        .file(file)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(email)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
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

    private String createPatient() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Photo\",\"lastName\":\"Subject\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
    }
}
