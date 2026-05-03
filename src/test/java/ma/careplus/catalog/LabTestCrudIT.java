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
 * IT pour CRUD unitaire catalog_lab_test — QA6-4 (commit 6431cb4).
 *
 * Scénarios :
 *  S1 : POST /api/catalog/lab-tests (code + nom + catégorie) → 201 + apparaît dans GET.
 *  S2 : PUT  /api/catalog/lab-tests/{id} → 204 + ligne mise à jour en DB.
 *  S3 : DELETE /api/catalog/lab-tests/{id} → 204 + soft-delete (active=false) + disparaît du GET.
 *  S4 : POST code dupliqué → 409 (pas 500), row original inchangé.
 *  S5 : POST nom vide → 400 (@NotBlank validation).
 *  S6 : SECRETAIRE POST → 403 Forbidden.
 *  S7 : SECRETAIRE DELETE → 403 Forbidden.
 *  S8 : PUT code en collision avec code existant → 409.
 *  S9 : PUT id inconnu → 404.
 *  S10: DELETE id inconnu → 404.
 *  S11: POST code vide → 400 (@NotBlank validation).
 *  BUG-GUARD: DELETE puis POST même code → DOIT retourner 409 parce que la
 *             vérification du doublon ignore active=FALSE (bug CatalogController:148).
 *             Ce test échoue si le bug est présent, réussit si corrigé.
 *
 * REGRESSION GUARD :
 *   BUG identifié 2026-05-02 (QA6-4 walk) :
 *   CatalogController.java:148 — la requête de pré-check doublon est
 *   `SELECT COUNT(*) FROM catalog_lab_test WHERE code = ?` sans filtre
 *   `active = TRUE`. Conséquence : après un soft-delete d'un code, toute
 *   tentative de recréer ce code retourne 409 CONFLICT (code "empoisonné").
 *   De même, le PUT (ligne 170) ne filtre pas sur active — un code désactivé
 *   bloque le renommage d'un item actif vers ce code pourtant libre.
 *   Ce test (S_BUG_DELETE_THEN_RECREATE) échoue contre le code actuel et
 *   passera une fois le filtre ajouté : `WHERE code = ? AND active = TRUE`.
 *   Même bug sur catalog_imaging_exam, couvert dans ImagingExamCrudIT.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class LabTestCrudIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "LabTest-QA-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;

    // Cached tokens — login once per role per test run to avoid repetition.
    private String medToken;
    private String secToken;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();

        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID medId = UUID.randomUUID();
        medEmail = "med-lab-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Lab', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        UUID secId = UUID.randomUUID();
        secEmail = "sec-lab-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Lab', TRUE, 0, 0, now(), now())
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
        return "QA-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private UUID createRaw(String code, String name, String category) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"%s\",\"category\":\"%s\"}",
                                code, name, category)))
                .andExpect(status().isCreated()).andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
    }

    // ── S1 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S1 — POST analyse valide retourne 201 et l'élément apparaît dans GET")
    void s1_createLabTest_happyPath() throws Exception {
        String c = code();
        MvcResult r = mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"NFS QA\",\"category\":\"Hémato\"}", c)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(c))
                .andExpect(jsonPath("$.name").value("NFS QA"))
                .andExpect(jsonPath("$.category").value("Hémato"))
                .andReturn();

        UUID id = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
        assertThat(id).isNotNull();

        // DB assertion — ne pas se fier uniquement au corps de réponse.
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_lab_test WHERE id = ?", Boolean.class, id);
        assertThat(active).isTrue();

        // Apparaît dans le GET /lab-tests?q=code.
        mockMvc.perform(get("/api/catalog/lab-tests").param("q", c)
                        .header("Authorization", med()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value(c));
    }

    // ── S2 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S2 — PUT analyse existante retourne 204 et la DB reflète le changement")
    void s2_updateLabTest_happyPath() throws Exception {
        String c = code();
        UUID id = createRaw(c, "Initial", "Bio");

        String newCode = code();
        mockMvc.perform(put("/api/catalog/lab-tests/" + id)
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Renommé\",\"category\":\"Bactério\"}",
                                newCode)))
                .andExpect(status().isNoContent());

        // DB assertion.
        String name = jdbc.queryForObject(
                "SELECT name FROM catalog_lab_test WHERE id = ?", String.class, id);
        assertThat(name).isEqualTo("Renommé");
    }

    // ── S3 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S3 — DELETE analyse retourne 204, soft-delete (active=false), disparaît du GET")
    void s3_deleteLabTest_softDelete() throws Exception {
        String c = code();
        UUID id = createRaw(c, "À désactiver", "Bio");

        mockMvc.perform(delete("/api/catalog/lab-tests/" + id)
                        .header("Authorization", med()))
                .andExpect(status().isNoContent());

        // Disparaît du GET (active=FALSE filtré).
        String body = mockMvc.perform(get("/api/catalog/lab-tests").param("q", c)
                        .header("Authorization", med()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).isEqualTo("[]");

        // DB row existe mais active=false.
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_lab_test WHERE id = ?", Boolean.class, id);
        assertThat(active).isFalse();
    }

    // ── S4 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S4 — POST code dupliqué retourne 409 et le row original est inchangé")
    void s4_createLabTest_duplicateCode_returns409() throws Exception {
        String c = code();
        UUID firstId = createRaw(c, "Original", "Bio");

        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Doublon\",\"category\":\"Bio\"}", c)))
                .andExpect(status().isConflict());

        // Row original inchangé.
        String name = jdbc.queryForObject(
                "SELECT name FROM catalog_lab_test WHERE id = ?", String.class, firstId);
        assertThat(name).isEqualTo("Original");
    }

    // ── S5 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S5 — POST nom vide retourne 400 (@NotBlank)")
    void s5_createLabTest_missingName_returns400() throws Exception {
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"code\":\"%s\",\"category\":\"Bio\"}", code())))
                .andExpect(status().isBadRequest());
    }

    // ── S11 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S11 — POST code vide retourne 400 (@NotBlank)")
    void s11_createLabTest_missingCode_returns400() throws Exception {
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test sans code\",\"category\":\"Bio\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── S6 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S6 — SECRETAIRE POST /lab-tests retourne 403 Forbidden")
    void s6_secretaire_postLabTest_returns403() throws Exception {
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", sec())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Interdit\",\"category\":\"Bio\"}",
                                code())))
                .andExpect(status().isForbidden());
    }

    // ── S7 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S7 — SECRETAIRE DELETE /lab-tests/{id} retourne 403 Forbidden")
    void s7_secretaire_deleteLabTest_returns403() throws Exception {
        String c = code();
        UUID id = createRaw(c, "Protect me", "Bio");

        mockMvc.perform(delete("/api/catalog/lab-tests/" + id)
                        .header("Authorization", sec()))
                .andExpect(status().isForbidden());

        // Row toujours actif après la tentative refusée.
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_lab_test WHERE id = ?", Boolean.class, id);
        assertThat(active).isTrue();
    }

    // ── S8 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S8 — PUT qui change le code vers un code déjà pris retourne 409")
    void s8_updateLabTest_codeCollision_returns409() throws Exception {
        String cA = code();
        String cB = code();
        UUID idA = createRaw(cA, "A", "Bio");
        createRaw(cB, "B", "Bio");

        // Tenter de renommer A vers le code de B → 409.
        mockMvc.perform(put("/api/catalog/lab-tests/" + idA)
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"A renamed\",\"category\":\"Bio\"}",
                                cB)))
                .andExpect(status().isConflict());

        // L'élément A est inchangé en DB.
        String name = jdbc.queryForObject(
                "SELECT name FROM catalog_lab_test WHERE id = ?", String.class, idA);
        assertThat(name).isEqualTo("A");
    }

    // ── S9 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S9 — PUT id inconnu retourne 404")
    void s9_updateLabTest_unknownId_returns404() throws Exception {
        mockMvc.perform(put("/api/catalog/lab-tests/" + UUID.randomUUID())
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Ghost\",\"category\":\"Bio\"}",
                                code())))
                .andExpect(status().isNotFound());
    }

    // ── S10 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S10 — DELETE id inconnu retourne 404")
    void s10_deleteLabTest_unknownId_returns404() throws Exception {
        mockMvc.perform(delete("/api/catalog/lab-tests/" + UUID.randomUUID())
                        .header("Authorization", med()))
                .andExpect(status().isNotFound());
    }

    // ── BUG-GUARD ─────────────────────────────────────────────────────────────
    //
    // Ce test expose le bug CatalogController.java:148 :
    //   SELECT COUNT(*) FROM catalog_lab_test WHERE code = ?
    // sans filtre active=TRUE. Un code soft-deleted est "empoisonné" — on ne
    // peut plus le recréer même si la contrainte UNIQUE PG bloquerait un INSERT
    // (elle n'est pas atteinte car le check applicatif refuse en premier).
    //
    // Comportement ATTENDU après correction :
    //   DELETE code X → POST même code X → 201 Created (recréation autorisée).
    // Comportement ACTUEL (bug) :
    //   DELETE code X → POST même code X → 409 Conflict.
    //
    // Ce test sera RED contre le code actuel et VERT après le fix :
    //   WHERE code = ? AND active = TRUE
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("BUG-GUARD — DELETE puis POST même code doit retourner 201, pas 409")
    void bugGuard_deleteAndRecreate_samecode_shouldReturn201() throws Exception {
        String c = code();
        UUID firstId = createRaw(c, "Première instance", "Bio");

        // Soft-delete.
        mockMvc.perform(delete("/api/catalog/lab-tests/" + firstId)
                        .header("Authorization", med()))
                .andExpect(status().isNoContent());

        // Recréer avec le même code — le row précédent est inactif, le code est libre.
        // BUG: retourne 409 au lieu de 201.
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Deuxième instance\",\"category\":\"Bio\"}",
                                c)))
                .andExpect(status().isCreated());
    }

    // ── QA6-5 sister guard ────────────────────────────────────────────────────
    //
    // Vérifie que LabTestWriteRequest N'A PAS de champ 'active' — contrairement
    // à MedicationWriteRequest (QA6-5 bug). La désactivation passe par DELETE.
    // Ce test est structurel : si quelqu'un ajoute un champ active au DTO et
    // oublie de le persister, le test qui suit détecte que active=TRUE en DB
    // même si le POST envoyait active=false dans un champ extra ignoré par JSON.
    // On vérifie au moins que POST sans champ active donne bien active=TRUE en DB.
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("QA6-5 sister — POST sans champ 'active' crée l'analyse avec active=true en DB")
    void qa65Sister_noActiveField_dbAlwaysActiveTrue() throws Exception {
        String c = code();
        MvcResult r = mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", med())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format(
                                "{\"code\":\"%s\",\"name\":\"Active test\",\"category\":\"Bio\"}", c)))
                .andExpect(status().isCreated()).andReturn();

        UUID id = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());

        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_lab_test WHERE id = ?", Boolean.class, id);
        assertThat(active).isTrue();
    }
}
