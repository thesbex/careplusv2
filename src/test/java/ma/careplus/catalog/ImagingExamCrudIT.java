package ma.careplus.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * IT pour CRUD unitaire catalog_imaging_exam — QA6-4 (commit 6431cb4).
 *
 * Scénarios :
 *  S1 : POST /api/catalog/imaging-exams (code + nom + modalité) → 201 + apparaît dans GET.
 *  S2 : PUT  /api/catalog/imaging-exams/{id} → 204 + ligne mise à jour en DB.
 *  S3 : DELETE /api/catalog/imaging-exams/{id} → 204 + soft-delete (active=false) + disparaît du GET.
 *  S4 : POST code dupliqué → 409 (pas 500), row original inchangé.
 *  S5 : POST nom vide → 400 (@NotBlank validation).
 *  S6 : SECRETAIRE POST → 403 Forbidden.
 *  S7 : SECRETAIRE DELETE → 403 Forbidden.
 *  S8 : PUT code en collision avec code existant → 409.
 *  S9 : PUT id inconnu → 404.
 *  S10: DELETE id inconnu → 404.
 *  S11: POST code vide → 400 (@NotBlank validation).
 *  BUG-GUARD: DELETE puis POST même code → DOIT retourner 409 parce que la
 *             vérification du doublon ignore active=FALSE (bug CatalogController:200).
 *
 * REGRESSION GUARD :
 *   BUG identifié 2026-05-02 (QA6-4 walk) :
 *   CatalogController.java:200 — la requête de pré-check doublon est
 *   `SELECT COUNT(*) FROM catalog_imaging_exam WHERE code = ?` sans filtre
 *   `active = TRUE`. Conséquence : après un soft-delete d'un code, toute
 *   tentative de recréer ce code retourne 409 CONFLICT (code "empoisonné").
 *   De même le PUT (ligne 221) ne filtre pas sur active — un code désactivé
 *   bloque le renommage d'un item actif vers ce code pourtant libre.
 *   Ce test (bugGuard_deleteAndRecreate) sera RED contre le code actuel et VERT
 *   après le fix : `WHERE code = ? AND active = TRUE`.
 *   Même bug sur catalog_lab_test, couvert dans LabTestCrudIT.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ImagingExamCrudIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "ImagingExam-QA-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;

    private String medToken;
    private String secToken;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();

        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID medId = UUID.randomUUID();
        medEmail = "med-img-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Img', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        UUID secId = UUID.randomUUID();
        secEmail = "sec-img-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Img', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);

        medToken = null;
        secToken = null;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String token(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private String med() throws Exception {
        if (medToken == null) medToken = token(medEmail);
        return medToken;
    }

    private String sec() throws Exception {
        if (secToken == null) secToken = token(secEmail);
        return secToken;
    }

    private String code() {
        return "RX-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private UUID createRaw(String code, String name, String modality) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"%s\",\"modality\":\"%s\"}",
                                code, name, modality)))
                .andExpect(status().isCreated()).andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
    }

    // ── S1 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S1 — POST examen imagerie valide retourne 201 et apparaît dans GET")
    void s1_createImagingExam_happyPath() throws Exception {
        String c = code();
        MvcResult r = mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Radio thorax QA\",\"modality\":\"RADIO\"}", c)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(c))
                .andExpect(jsonPath("$.name").value("Radio thorax QA"))
                .andExpect(jsonPath("$.modality").value("RADIO"))
                .andReturn();

        UUID id = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
        assertThat(id).isNotNull();

        // DB assertion.
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_imaging_exam WHERE id = ?", Boolean.class, id);
        assertThat(active).isTrue();

        // Apparaît dans le GET.
        mockMvc.perform(get("/api/catalog/imaging-exams").param("q", c)
                        .header("Authorization", med()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value(c));
    }

    // ── S2 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S2 — PUT examen imagerie existant retourne 204 et la DB reflète le changement")
    void s2_updateImagingExam_happyPath() throws Exception {
        String c = code();
        UUID id = createRaw(c, "IRM cérébrale initiale", "IRM");

        String newCode = code();
        mockMvc.perform(put("/api/catalog/imaging-exams/" + id)
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"IRM crâne renommée\",\"modality\":\"IRM\"}",
                                newCode)))
                .andExpect(status().isNoContent());

        // DB assertion.
        String name = jdbc.queryForObject(
                "SELECT name FROM catalog_imaging_exam WHERE id = ?", String.class, id);
        assertThat(name).isEqualTo("IRM crâne renommée");
    }

    // ── S3 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S3 — DELETE examen imagerie retourne 204, soft-delete (active=false), disparaît du GET")
    void s3_deleteImagingExam_softDelete() throws Exception {
        String c = code();
        UUID id = createRaw(c, "À désactiver", "ECHO");

        mockMvc.perform(delete("/api/catalog/imaging-exams/" + id)
                        .header("Authorization", med()))
                .andExpect(status().isNoContent());

        // Disparaît du GET.
        String body = mockMvc.perform(get("/api/catalog/imaging-exams").param("q", c)
                        .header("Authorization", med()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).isEqualTo("[]");

        // DB row existe mais active=false.
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_imaging_exam WHERE id = ?", Boolean.class, id);
        assertThat(active).isFalse();
    }

    // ── S4 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S4 — POST code dupliqué retourne 409 et le row original est inchangé")
    void s4_createImagingExam_duplicateCode_returns409() throws Exception {
        String c = code();
        UUID firstId = createRaw(c, "Original", "SCANNER");

        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Doublon\",\"modality\":\"SCANNER\"}", c)))
                .andExpect(status().isConflict());

        // Row original inchangé.
        String name = jdbc.queryForObject(
                "SELECT name FROM catalog_imaging_exam WHERE id = ?", String.class, firstId);
        assertThat(name).isEqualTo("Original");
    }

    // ── S5 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S5 — POST nom vide retourne 400 (@NotBlank)")
    void s5_createImagingExam_missingName_returns400() throws Exception {
        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"code\":\"%s\",\"modality\":\"RADIO\"}", code())))
                .andExpect(status().isBadRequest());
    }

    // ── S11 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S11 — POST code vide retourne 400 (@NotBlank)")
    void s11_createImagingExam_missingCode_returns400() throws Exception {
        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test sans code\",\"modality\":\"RADIO\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── S6 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S6 — SECRETAIRE POST /imaging-exams retourne 403 Forbidden")
    void s6_secretaire_postImagingExam_returns403() throws Exception {
        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", sec())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Interdit\",\"modality\":\"RADIO\"}",
                                code())))
                .andExpect(status().isForbidden());
    }

    // ── S7 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S7 — SECRETAIRE DELETE /imaging-exams/{id} retourne 403 Forbidden")
    void s7_secretaire_deleteImagingExam_returns403() throws Exception {
        String c = code();
        UUID id = createRaw(c, "Protect me", "ECHO");

        mockMvc.perform(delete("/api/catalog/imaging-exams/" + id)
                        .header("Authorization", sec()))
                .andExpect(status().isForbidden());

        // Row toujours actif après la tentative refusée.
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_imaging_exam WHERE id = ?", Boolean.class, id);
        assertThat(active).isTrue();
    }

    // ── S8 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S8 — PUT qui change le code vers un code déjà pris retourne 409")
    void s8_updateImagingExam_codeCollision_returns409() throws Exception {
        String cA = code();
        String cB = code();
        UUID idA = createRaw(cA, "A", "RADIO");
        createRaw(cB, "B", "RADIO");

        mockMvc.perform(put("/api/catalog/imaging-exams/" + idA)
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"A renamed\",\"modality\":\"RADIO\"}",
                                cB)))
                .andExpect(status().isConflict());

        // L'élément A est inchangé en DB.
        String name = jdbc.queryForObject(
                "SELECT name FROM catalog_imaging_exam WHERE id = ?", String.class, idA);
        assertThat(name).isEqualTo("A");
    }

    // ── S9 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S9 — PUT id inconnu retourne 404")
    void s9_updateImagingExam_unknownId_returns404() throws Exception {
        mockMvc.perform(put("/api/catalog/imaging-exams/" + UUID.randomUUID())
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Ghost\",\"modality\":\"IRM\"}",
                                code())))
                .andExpect(status().isNotFound());
    }

    // ── S10 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S10 — DELETE id inconnu retourne 404")
    void s10_deleteImagingExam_unknownId_returns404() throws Exception {
        mockMvc.perform(delete("/api/catalog/imaging-exams/" + UUID.randomUUID())
                        .header("Authorization", med()))
                .andExpect(status().isNotFound());
    }

    // ── BUG-GUARD ─────────────────────────────────────────────────────────────
    //
    // Ce test expose le bug CatalogController.java:200 :
    //   SELECT COUNT(*) FROM catalog_imaging_exam WHERE code = ?
    // sans filtre active=TRUE. Un code soft-deleted est "empoisonné" — on ne
    // peut plus le recréer. La contrainte UNIQUE PG bloquerait l'INSERT mais
    // le check applicatif se déclenche avant et retourne 409 prématurément.
    //
    // Comportement ATTENDU après correction :
    //   DELETE code X → POST même code X → 201 Created.
    // Comportement ACTUEL (bug) :
    //   DELETE code X → POST même code X → 409 Conflict.
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("BUG-GUARD — DELETE puis POST même code doit retourner 201, pas 409")
    void bugGuard_deleteAndRecreate_sameCode_shouldReturn201() throws Exception {
        String c = code();
        UUID firstId = createRaw(c, "Première instance", "ECHO");

        // Soft-delete.
        mockMvc.perform(delete("/api/catalog/imaging-exams/" + firstId)
                        .header("Authorization", med()))
                .andExpect(status().isNoContent());

        // Recréer avec le même code — le row précédent est inactif.
        // BUG: retourne 409 au lieu de 201.
        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Deuxième instance\",\"modality\":\"ECHO\"}",
                                c)))
                .andExpect(status().isCreated());
    }

    // ── QA6-5 sister guard ────────────────────────────────────────────────────

    @Test
    @DisplayName("QA6-5 sister — POST sans champ 'active' crée l'examen avec active=true en DB")
    void qa65Sister_noActiveField_dbAlwaysActiveTrue() throws Exception {
        String c = code();
        MvcResult r = mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Active test\",\"modality\":\"SCANNER\"}", c)))
                .andExpect(status().isCreated()).andReturn();

        UUID id = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());

        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_imaging_exam WHERE id = ?", Boolean.class, id);
        assertThat(active).isTrue();
    }
}
