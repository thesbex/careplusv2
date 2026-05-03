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
 * QA6-4 — CRUD unitaire sur catalog_lab_test et catalog_imaging_exam. Le tester
 * (Y. Boutaleb 2026-05-02) a remonté que l'add/delete unitaire marchait pour
 * les médicaments mais pas pour les analyses + radio (endpoints absents).
 *
 * Ces tests sont la regression-lock pour les nouveaux POST/PUT/DELETE et
 * couvrent : happy path, RBAC (secrétaire 403), validation @NotBlank (400),
 * conflit UNIQUE sur code (409 — pas 500), 404 sur id inconnu, soft-delete
 * disparaît du GET.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class CatalogReferentielsIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Catalog-Ref-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        // Wipe transactional state, but DON'T touch catalog_lab_test /
        // catalog_imaging_exam globally — d'autres tests partagent cette base
        // testcontainers en mode reuse. On isole nos rows via des codes uniques.
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID medId = UUID.randomUUID();
        medEmail = "med-ref-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Ref', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        UUID secId = UUID.randomUUID();
        secEmail = "sec-ref-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Ref', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private String uniqueCode(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    // ── Lab tests ────────────────────────────────────────────────────────────

    @Test
    void createLabTest_happyPath_returns201_andAppearsInGet() throws Exception {
        String token = bearer(medEmail);
        String code = uniqueCode("NFS");

        MvcResult r = mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"Numération formule sanguine","category":"Hématologie"}
                                """, code)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.name").value("Numération formule sanguine"))
                .andExpect(jsonPath("$.category").value("Hématologie"))
                .andReturn();

        UUID id = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
        assertThat(id).isNotNull();

        // GET avec le filtre q=code retrouve l'élément.
        mockMvc.perform(get("/api/catalog/lab-tests")
                        .param("q", code)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value(code));
    }

    @Test
    void createLabTest_duplicateCode_returns409() throws Exception {
        String token = bearer(medEmail);
        String code = uniqueCode("DUP");

        // 1ère création OK.
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"Test 1","category":"Bio"}
                                """, code)))
                .andExpect(status().isCreated());

        // 2ème création même code → 409 (pas 500).
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"Test 2","category":"Bio"}
                                """, code)))
                .andExpect(status().isConflict());
    }

    @Test
    void createLabTest_secretaire_returns403() throws Exception {
        String token = bearer(secEmail);
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"X","name":"Y","category":"Z"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void createLabTest_missingName_returns400() throws Exception {
        String token = bearer(medEmail);
        // name manquant — @NotBlank doit déclencher 400, pas 500.
        mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","category":"Bio"}
                                """, uniqueCode("MISS"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateLabTest_happyPath_returns204() throws Exception {
        String token = bearer(medEmail);
        UUID id = createLabTestRaw(token, uniqueCode("UPD"), "Initial", "Bio");

        mockMvc.perform(put("/api/catalog/lab-tests/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"Renommé","category":"Bactério"}
                                """, uniqueCode("UPD"))))
                .andExpect(status().isNoContent());
    }

    @Test
    void updateLabTest_unknownId_returns404() throws Exception {
        String token = bearer(medEmail);
        mockMvc.perform(put("/api/catalog/lab-tests/" + UUID.randomUUID())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"X","category":"Y"}
                                """, uniqueCode("404"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateLabTest_codeCollision_returns409() throws Exception {
        String token = bearer(medEmail);
        String codeA = uniqueCode("COLA");
        String codeB = uniqueCode("COLB");
        UUID idA = createLabTestRaw(token, codeA, "A", "Bio");
        createLabTestRaw(token, codeB, "B", "Bio");

        // Renommer A vers le code de B → 409.
        mockMvc.perform(put("/api/catalog/lab-tests/" + idA)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"A renamed","category":"Bio"}
                                """, codeB)))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteLabTest_softDelete_disappearsFromSearch() throws Exception {
        String token = bearer(medEmail);
        String code = uniqueCode("DEL");
        UUID id = createLabTestRaw(token, code, "À désactiver", "Bio");

        mockMvc.perform(delete("/api/catalog/lab-tests/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        // GET ne retourne plus l'élément (active=false).
        String body = mockMvc.perform(get("/api/catalog/lab-tests")
                        .param("q", code)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).isEqualTo("[]");

        // Et le row reste en base avec active=false.
        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_lab_test WHERE id = ?", Boolean.class, id);
        assertThat(active).isFalse();
    }

    @Test
    void deleteLabTest_unknownId_returns404() throws Exception {
        String token = bearer(medEmail);
        mockMvc.perform(delete("/api/catalog/lab-tests/" + UUID.randomUUID())
                        .header("Authorization", token))
                .andExpect(status().isNotFound());
    }

    // ── Imaging exams (mêmes scénarios, structure parallèle) ─────────────────

    @Test
    void createImagingExam_happyPath_returns201_andAppearsInGet() throws Exception {
        String token = bearer(medEmail);
        String code = uniqueCode("RX");

        MvcResult r = mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"Radio thorax","modality":"RADIO"}
                                """, code)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.modality").value("RADIO"))
                .andReturn();

        UUID id = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
        assertThat(id).isNotNull();

        mockMvc.perform(get("/api/catalog/imaging-exams")
                        .param("q", code)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value(code));
    }

    @Test
    void createImagingExam_duplicateCode_returns409() throws Exception {
        String token = bearer(medEmail);
        String code = uniqueCode("RXDUP");
        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"Échographie 1","modality":"ECHO"}
                                """, code)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"Échographie 2","modality":"ECHO"}
                                """, code)))
                .andExpect(status().isConflict());
    }

    @Test
    void createImagingExam_secretaire_returns403() throws Exception {
        String token = bearer(secEmail);
        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"X","name":"Y","modality":"RADIO"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void createImagingExam_missingName_returns400() throws Exception {
        String token = bearer(medEmail);
        mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","modality":"RADIO"}
                                """, uniqueCode("MISS"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateImagingExam_happyPath_returns204() throws Exception {
        String token = bearer(medEmail);
        UUID id = createImagingRaw(token, uniqueCode("UPDIMG"), "IRM cérébrale", "IRM");

        mockMvc.perform(put("/api/catalog/imaging-exams/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"IRM crâne renommée","modality":"IRM"}
                                """, uniqueCode("UPDIMG"))))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteImagingExam_softDelete_disappearsFromSearch() throws Exception {
        String token = bearer(medEmail);
        String code = uniqueCode("DELIMG");
        UUID id = createImagingRaw(token, code, "À désactiver", "RADIO");

        mockMvc.perform(delete("/api/catalog/imaging-exams/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        String body = mockMvc.perform(get("/api/catalog/imaging-exams")
                        .param("q", code)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).isEqualTo("[]");

        Boolean active = jdbc.queryForObject(
                "SELECT active FROM catalog_imaging_exam WHERE id = ?", Boolean.class, id);
        assertThat(active).isFalse();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private UUID createLabTestRaw(String token, String code, String name, String category)
            throws Exception {
        MvcResult r = mockMvc.perform(post("/api/catalog/lab-tests")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"%s","category":"%s"}
                                """, code, name, category)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
    }

    private UUID createImagingRaw(String token, String code, String name, String modality)
            throws Exception {
        MvcResult r = mockMvc.perform(post("/api/catalog/imaging-exams")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {"code":"%s","name":"%s","modality":"%s"}
                                """, code, name, modality)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
    }
}
