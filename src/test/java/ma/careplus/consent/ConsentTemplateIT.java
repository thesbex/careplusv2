package ma.careplus.consent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
 * Integration tests for QA9-13 consent module.
 *
 * <p>Scenarios covered :
 * <ol>
 *   <li>POST /api/consent-templates as ADMIN → 201 + body</li>
 *   <li>POST /api/consent-templates as SECRETAIRE → 403</li>
 *   <li>GET  /api/consent-templates → list includes created template</li>
 *   <li>PUT  /api/consent-templates/{id} → 200 + updated fields persisted</li>
 *   <li>DELETE /api/consent-templates/{id} → 204 + excluded from subsequent GET</li>
 *   <li>POST /api/consent-templates with invalid type → 400</li>
 *   <li>POST /api/patients/{id}/consents → 200 with documentId</li>
 *   <li>GET  /api/documents/{docId}/content → application/pdf starting %%PDF</li>
 *   <li>DB row has type=CONSENTEMENT for the generated doc</li>
 *   <li>GET  /api/patients/{id}/consents → list returns the generated consent</li>
 *   <li>MEDECIN sees only active templates; ADMIN sees all (active+inactive)</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ConsentTemplateIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    // Role UUIDs seeded by V001 baseline
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Consent-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String adminEmail;
    String medEmail;
    String secEmail;
    UUID patientId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up consent data first (FK order)
        jdbc.update("DELETE FROM patient_document WHERE type = 'CONSENTEMENT'");
        jdbc.update("DELETE FROM clinical_consent_template");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = seedUser("admin-cs", ROLE_ADMIN);
        medEmail   = seedUser("med-cs",   ROLE_MEDECIN);
        secEmail   = seedUser("sec-cs",   ROLE_SECRETAIRE);

        // Seed a patient for Part B tests
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, tier,
                     version, number_children, status, created_at, updated_at)
                VALUES (?, 'AMRANI', 'Hassan', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """,
                patientId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part A — Template CRUD
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("1. POST /api/consent-templates as ADMIN → 201 with body")
    void createTemplate_asAdmin_returns201() throws Exception {
        mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("ACTE_OPERATOIRE",
                                "Consentement chirurgie",
                                "Je soussigné {{patientNom}}, CIN {{patientCin}}, consens à l'acte.",
                                true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.type").value("ACTE_OPERATOIRE"))
                .andExpect(jsonPath("$.title").value("Consentement chirurgie"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    @DisplayName("2. POST /api/consent-templates as SECRETAIRE → 403")
    void createTemplate_asSecretaire_returns403() throws Exception {
        mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("AUTRE", "Test", "Corps.", true)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("3. GET /api/consent-templates → list includes created template")
    void listTemplates_includesCreated() throws Exception {
        // Create
        mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("IMAGERIE",
                                "Consentement IRM",
                                "Consentement pour {{cabinet}} le {{dateJour}}.",
                                true)))
                .andExpect(status().isCreated());

        // List as médecin
        MvcResult result = mockMvc.perform(get("/api/consent-templates")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();

        boolean found = false;
        for (JsonNode node : body) {
            if ("Consentement IRM".equals(node.get("title").asText())) {
                found = true;
                assertThat(node.get("type").asText()).isEqualTo("IMAGERIE");
            }
        }
        assertThat(found).as("Template 'Consentement IRM' found in list").isTrue();
    }

    @Test
    @DisplayName("4. PUT /api/consent-templates/{id} → 200 + persisted changes")
    void updateTemplate_persistsChanges() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("ANESTHESIE",
                                "Consentement anesthésie v1",
                                "Corps initial.",
                                true)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Update
        mockMvc.perform(put("/api/consent-templates/" + id)
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("ANESTHESIE",
                                "Consentement anesthésie v2",
                                "Corps mis à jour pour {{patientNom}}.",
                                true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Consentement anesthésie v2"));

        // Verify in DB
        String titleInDb = jdbc.queryForObject(
                "SELECT title FROM clinical_consent_template WHERE id = ?::uuid", String.class, id);
        assertThat(titleInDb).isEqualTo("Consentement anesthésie v2");
    }

    @Test
    @DisplayName("5. DELETE /api/consent-templates/{id} → 204 + soft-deleted")
    void deleteTemplate_softDeletes() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("PRELEVEMENT", "Consentement prélèvement", "Corps.", true)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Delete → 204
        mockMvc.perform(delete("/api/consent-templates/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // deleted_at must be set
        String deletedAt = jdbc.queryForObject(
                "SELECT deleted_at::TEXT FROM clinical_consent_template WHERE id = ?::uuid",
                String.class, id);
        assertThat(deletedAt).isNotNull();

        // Must not appear in list anymore
        MvcResult list = mockMvc.perform(get("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        for (JsonNode node : body) {
            assertThat(node.get("id").asText()).isNotEqualTo(id);
        }
    }

    @Test
    @DisplayName("6. POST with invalid type → 400")
    void createTemplate_invalidType_returns400() throws Exception {
        mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("MAUVAIS_TYPE", "Test", "Corps.", true)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("11. MEDECIN sees active only; ADMIN sees all")
    void listVisibility_adminVsMedecin() throws Exception {
        // Create one active + one inactive template
        mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("HOSPITALISATION", "Consentement hospit (actif)", "Corps.", true)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("PARTAGE_DOSSIER", "Consentement partage (inactif)", "Corps.", false)))
                .andExpect(status().isCreated());

        // ADMIN sees both
        MvcResult adminList = mockMvc.perform(get("/api/consent-templates")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode adminBody = objectMapper.readTree(adminList.getResponse().getContentAsString());
        assertThat(adminBody.size()).isGreaterThanOrEqualTo(2);

        // MEDECIN sees only active
        MvcResult medList = mockMvc.perform(get("/api/consent-templates")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode medBody = objectMapper.readTree(medList.getResponse().getContentAsString());
        for (JsonNode node : medBody) {
            assertThat(node.get("active").asBoolean()).isTrue();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Part B — Consent generation for a patient
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("7. POST /api/patients/{id}/consents → 200 with documentId")
    void generateConsent_returns200WithDocumentId() throws Exception {
        String body = consentJson(null,
                "Consentement acte opératoire",
                "Je soussigné AMRANI Hassan, consens à l'acte proposé par le médecin.");

        MvcResult result = mockMvc.perform(post("/api/patients/" + patientId + "/consents")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").exists())
                .andReturn();

        // Capture documentId for follow-up assertions
        String documentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("documentId").asText();
        assertThat(documentId).isNotBlank();

        // Verify DB row has type = CONSENTEMENT (scenario 9)
        String typeInDb = jdbc.queryForObject(
                "SELECT type FROM patient_document WHERE id = ?::uuid", String.class, documentId);
        assertThat(typeInDb).isEqualTo("CONSENTEMENT");
    }

    @Test
    @DisplayName("8. GET /api/documents/{docId}/content → application/pdf starting %PDF")
    void downloadConsentPdf_returnsPdfBytes() throws Exception {
        // Generate first
        MvcResult generated = mockMvc.perform(post("/api/patients/" + patientId + "/consents")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(consentJson(null,
                                "Consentement IMAGERIE",
                                "Je consens à l'examen d'imagerie médicale.")))
                .andExpect(status().isOk())
                .andReturn();

        String documentId = objectMapper.readTree(generated.getResponse().getContentAsString())
                .get("documentId").asText();

        // Download
        MvcResult download = mockMvc.perform(get("/api/documents/" + documentId + "/content")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andReturn();

        byte[] pdfBytes = download.getResponse().getContentAsByteArray();
        assertThat(pdfBytes).isNotEmpty();
        // PDF magic bytes %PDF
        assertThat(new String(pdfBytes, 0, Math.min(4, pdfBytes.length))).isEqualTo("%PDF");
    }

    @Test
    @DisplayName("9. DB row has type=CONSENTEMENT")
    void generatedDocument_hasTypeConsentement() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/patients/" + patientId + "/consents")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(consentJson(null, "Consentement PRELEVEMENT", "Corps texte.")))
                .andExpect(status().isOk())
                .andReturn();

        String documentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("documentId").asText();

        String typeInDb = jdbc.queryForObject(
                "SELECT type FROM patient_document WHERE id = ?::uuid", String.class, documentId);
        assertThat(typeInDb).isEqualTo("CONSENTEMENT");
    }

    @Test
    @DisplayName("10. GET /api/patients/{id}/consents → list returns generated consent")
    void listConsents_returnsPreviouslyGenerated() throws Exception {
        // Generate
        mockMvc.perform(post("/api/patients/" + patientId + "/consents")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(consentJson(null,
                                "Consentement partage dossier",
                                "J'autorise le partage de mon dossier médical.")))
                .andExpect(status().isOk());

        // List
        MvcResult list = mockMvc.perform(get("/api/patients/" + patientId + "/consents")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();
        assertThat(body.size()).isGreaterThanOrEqualTo(1);

        // Every item in the list must be CONSENTEMENT type
        for (JsonNode node : body) {
            assertThat(node.get("type").asText()).isEqualTo("CONSENTEMENT");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String seedUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(PWD),
                prefix, "Test",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
        return "Bearer " + token;
    }

    private String templateJson(String type, String title, String body, boolean active) {
        return "{\"type\":\"" + type + "\","
                + "\"title\":\"" + escapeJson(title) + "\","
                + "\"body\":\"" + escapeJson(body) + "\","
                + "\"active\":" + active + "}";
    }

    private String consentJson(UUID templateId, String title, String body) {
        StringBuilder sb = new StringBuilder("{");
        if (templateId != null) {
            sb.append("\"templateId\":\"").append(templateId).append("\",");
        }
        sb.append("\"title\":\"").append(escapeJson(title)).append("\",");
        sb.append("\"body\":\"").append(escapeJson(body)).append("\"");
        sb.append("}");
        return sb.toString();
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
