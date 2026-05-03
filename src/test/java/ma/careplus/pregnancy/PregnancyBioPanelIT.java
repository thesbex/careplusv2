package ma.careplus.pregnancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
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
 * Integration tests for PregnancyBioPanelService — Étape 3.
 *
 * Scenarios:
 *  1. GET T1 retourne les 10 lignes PSGA avec mapping catalog code quand le test existe
 *  2. GET T2 retourne NFS + HGPO + toxoplasmose contrôle
 *  3. GET T3 retourne NFS + RAI + Strepto B + sérologies récapitulatives
 *  4. GET T4 → 422 INVALID_TRIMESTER
 *  5. RBAC: SECRETAIRE/ASSISTANT → 403; MEDECIN → 200
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyBioPanelIT {

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

    private static final String PWD = "Bio-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    String asstEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        jdbc.update("DELETE FROM pregnancy_visit_plan WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'BioTest'))");
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name = 'BioTest')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name = 'BioTest'");

        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'bio-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'bio-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'bio-test-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "bio-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'User', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", userId, roleId);
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

    private String createPregnancy(String token) throws Exception {
        String body = """
                {"firstName":"BioPatient","lastName":"BioTest",
                 "gender":"F","birthDate":"1993-05-20",
                 "phone":"+212600003000","city":"Meknes"}
                """;
        MvcResult pr = mockMvc.perform(post("/api/patients")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        String patientId = objectMapper.readTree(pr.getResponse().getContentAsString()).get("id").asText();

        MvcResult pg = mockMvc.perform(post("/api/patients/" + patientId + "/pregnancies")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lmpDate\":\"" + LocalDate.now().minusWeeks(10) + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(pg.getResponse().getContentAsString()).get("id").asText();
    }

    // ── Scenario 1: T1 template → 10 lines, catalog codes mapped ────────────

    @Test
    void sc1_t1_template_hasTenLines_withCatalogCodes() throws Exception {
        String token = bearer(medEmail);
        String pregId = createPregnancy(token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/" + pregId + "/bio-panel-template")
                        .header("Authorization", token)
                        .param("trimester", "T1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trimester").value("T1"))
                .andExpect(jsonPath("$.pregnancyId").value(pregId))
                .andExpect(jsonPath("$.lines").isArray())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode lines = body.get("lines");
        assertThat(lines.size()).isEqualTo(10); // 8 main tests + BU + ECBU

        // Verify that known catalog codes (e.g. GROUPE_RH, NFS, SERO_SYPH) are resolved
        // Note: non_null Jackson config omits null catalogCode fields from JSON
        boolean hasGroupeRh = false;
        boolean hasSerSyph = false;
        for (JsonNode line : lines) {
            JsonNode codeNode = line.get("catalogCode");
            String code = (codeNode != null && !codeNode.isNull()) ? codeNode.asText() : null;
            if ("GROUPE_RH".equals(code)) hasGroupeRh = true;
            if ("SERO_SYPH".equals(code)) hasSerSyph = true;
            // Each line must have at least a label
            assertThat(line.get("label").asText()).isNotBlank();
        }
        assertThat(hasGroupeRh).as("GROUPE_RH should be mapped from catalog").isTrue();
        assertThat(hasSerSyph).as("SERO_SYPH should be mapped from catalog").isTrue();
    }

    // ── Scenario 2: T2 template → NFS + HGPO + toxo ─────────────────────────

    @Test
    void sc2_t2_template_hasNfsHgpoToxo() throws Exception {
        String token = bearer(medEmail);
        String pregId = createPregnancy(token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/" + pregId + "/bio-panel-template")
                        .header("Authorization", token)
                        .param("trimester", "T2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trimester").value("T2"))
                .andExpect(jsonPath("$.lines").isArray())
                .andReturn();

        JsonNode lines = objectMapper.readTree(result.getResponse().getContentAsString()).get("lines");
        assertThat(lines.size()).isEqualTo(3); // NFS, SERO_TOXO, HGPO

        boolean hasNfs  = false;
        boolean hasHgpo = false;
        boolean hasToxo = false;
        for (JsonNode line : lines) {
            JsonNode codeNode = line.get("catalogCode");
            String code = (codeNode != null && !codeNode.isNull()) ? codeNode.asText() : null;
            if ("NFS".equals(code))       hasNfs  = true;
            if ("HGPO".equals(code))      hasHgpo = true;
            if ("SERO_TOXO".equals(code)) hasToxo = true;
        }
        assertThat(hasNfs).as("T2 panel must include NFS").isTrue();
        assertThat(hasHgpo).as("T2 panel must include HGPO").isTrue();
        assertThat(hasToxo).as("T2 panel must include toxoplasmose control").isTrue();
    }

    // ── Scenario 3: T3 template → NFS + RAI + Strepto B ─────────────────────

    @Test
    void sc3_t3_template_hasNfsRaiStreptoB() throws Exception {
        String token = bearer(medEmail);
        String pregId = createPregnancy(token);

        MvcResult result = mockMvc.perform(get("/api/pregnancies/" + pregId + "/bio-panel-template")
                        .header("Authorization", token)
                        .param("trimester", "T3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trimester").value("T3"))
                .andReturn();

        JsonNode lines = objectMapper.readTree(result.getResponse().getContentAsString()).get("lines");
        assertThat(lines.size()).isEqualTo(4); // NFS, RAI, STREPTO_B, SERO_RECAP

        boolean hasNfs      = false;
        boolean hasRai      = false;
        boolean hasStreptoB = false;
        for (JsonNode line : lines) {
            JsonNode codeNode = line.get("catalogCode");
            String code = (codeNode != null && !codeNode.isNull()) ? codeNode.asText() : null;
            String label = line.get("label").asText();
            if ("NFS".equals(code))  hasNfs  = true;
            if ("RAI".equals(code))  hasRai  = true;
            // STREPTO_B may not be in catalog (no code in V012) — check label
            if (label.toLowerCase().contains("strepto")) hasStreptoB = true;
        }
        assertThat(hasNfs).as("T3 panel must include NFS").isTrue();
        assertThat(hasRai).as("T3 panel must include RAI").isTrue();
        assertThat(hasStreptoB).as("T3 panel must include Streptocoque B").isTrue();
    }

    // ── Scenario 4: Invalid trimester → 422 INVALID_TRIMESTER ───────────────

    @Test
    void sc4_invalidTrimester_422() throws Exception {
        String token = bearer(medEmail);
        String pregId = createPregnancy(token);

        mockMvc.perform(get("/api/pregnancies/" + pregId + "/bio-panel-template")
                        .header("Authorization", token)
                        .param("trimester", "T4"))
                .andExpect(status().isUnprocessableEntity());
    }

    // ── Scenario 5: RBAC — SECRETAIRE/ASSISTANT 403, MEDECIN 200 ─────────────

    @Test
    void sc5_rbac_secretaire403_assistant403_medecin200() throws Exception {
        String medToken  = bearer(medEmail);
        String secToken  = bearer(secEmail);
        String asstToken = bearer(asstEmail);
        String pregId    = createPregnancy(medToken);

        mockMvc.perform(get("/api/pregnancies/" + pregId + "/bio-panel-template")
                        .header("Authorization", secToken)
                        .param("trimester", "T1"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/pregnancies/" + pregId + "/bio-panel-template")
                        .header("Authorization", asstToken)
                        .param("trimester", "T1"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/pregnancies/" + pregId + "/bio-panel-template")
                        .header("Authorization", medToken)
                        .param("trimester", "T1"))
                .andExpect(status().isOk());
    }
}
