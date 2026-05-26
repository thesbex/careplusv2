package ma.careplus.confrere;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * Integration tests for QA9-10 — Courrier au confrère.
 *
 * <p>Scenarios covered :
 * <ol>
 *   <li>POST .../confrere-letter as MEDECIN → 200 with documentId</li>
 *   <li>GET  /api/documents/{docId}/content → application/pdf starting %PDF</li>
 *   <li>DB row has type=LETTRE_CONFRERE</li>
 *   <li>GET  .../confrere-letters → list includes the generated letter</li>
 *   <li>RBAC : SECRETAIRE → 403 on POST</li>
 *   <li>Unknown consultationId → 404</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ConfrereLetterIT {

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
    private static final String PWD = "Confrere-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    UUID medId;
    UUID patientId;
    UUID consultationId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up in FK-safe order
        jdbc.update("DELETE FROM patient_document WHERE type = 'LETTRE_CONFRERE'");
        jdbc.update("DELETE FROM patient_document WHERE type = 'CONSENTEMENT'");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Seed médecin
        medId = UUID.randomUUID();
        medEmail = "med-cf-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Omar', 'Bensalem', TRUE, 0, 0, now(), now())
                """,
                medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medId, ROLE_MEDECIN);

        // Seed secrétaire (pour test RBAC 403)
        UUID secId = UUID.randomUUID();
        secEmail = "sec-cf-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Amina', 'Karimi', TRUE, 0, 0, now(), now())
                """,
                secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        // Seed patient
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, tier,
                     version, number_children, status, created_at, updated_at)
                VALUES (?, 'FILALI', 'Hassan', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """,
                patientId);

        // Seed consultation BROUILLON
        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation
                    (id, patient_id, practitioner_id, status,
                     version_number, version, started_at, created_at, updated_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """,
                consultationId, patientId, medId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. POST → 200 with documentId
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("1. POST .../confrere-letter as MEDECIN → 200 with documentId")
    void generate_asMedecin_returns200WithDocumentId() throws Exception {
        MvcResult result = mockMvc.perform(post(url("/confrere-letter"))
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(letterJson(
                                "Benchekroun",
                                "Cardiologue",
                                "Casablanca",
                                "Cher confrère, je vous adresse M. Filali Hassan pour avis cardiologique.")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").exists())
                .andReturn();

        String documentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("documentId").asText();
        assertThat(documentId).isNotBlank();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. GET content → application/pdf %PDF
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("2. GET /api/documents/{docId}/content → application/pdf starting %PDF")
    void downloadLetter_returnsPdfBytes() throws Exception {
        MvcResult generated = mockMvc.perform(post(url("/confrere-letter"))
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(letterJson("Alaoui", "Neurologue", "Rabat",
                                "Cher confrère, veuillez examiner ce patient.")))
                .andExpect(status().isOk())
                .andReturn();

        String documentId = objectMapper.readTree(generated.getResponse().getContentAsString())
                .get("documentId").asText();

        MvcResult download = mockMvc.perform(get("/api/documents/" + documentId + "/content")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andReturn();

        byte[] pdfBytes = download.getResponse().getContentAsByteArray();
        assertThat(pdfBytes).isNotEmpty();
        assertThat(new String(pdfBytes, 0, Math.min(4, pdfBytes.length))).isEqualTo("%PDF");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. DB row type = LETTRE_CONFRERE
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("3. DB row has type=LETTRE_CONFRERE")
    void generatedDocument_hasTypeLettre() throws Exception {
        MvcResult result = mockMvc.perform(post(url("/confrere-letter"))
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(letterJson("Ziani", null, null,
                                "Je vous adresse ce patient pour avis spécialisé.")))
                .andExpect(status().isOk())
                .andReturn();

        String documentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("documentId").asText();

        String typeInDb = jdbc.queryForObject(
                "SELECT type FROM patient_document WHERE id = ?::uuid",
                String.class, documentId);
        assertThat(typeInDb).isEqualTo("LETTRE_CONFRERE");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. GET .../confrere-letters lists the generated letter
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("4. GET .../confrere-letters → list includes generated letter")
    void listLetters_includesGenerated() throws Exception {
        // Generate
        mockMvc.perform(post(url("/confrere-letter"))
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(letterJson("El Fassi", "Ophtalmologiste", "Fès",
                                "Je vous adresse ce patient pour bilan ophtalmologique.")))
                .andExpect(status().isOk());

        // List
        MvcResult list = mockMvc.perform(get(url("/confrere-letters"))
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();
        assertThat(body.size()).isGreaterThanOrEqualTo(1);

        for (JsonNode node : body) {
            assertThat(node.get("type").asText()).isEqualTo("LETTRE_CONFRERE");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. RBAC : SECRETAIRE → 403 on POST
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("5. RBAC : SECRETAIRE → 403 on POST")
    void generate_asSecretaire_returns403() throws Exception {
        mockMvc.perform(post(url("/confrere-letter"))
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(letterJson("Mansouri", null, null, "Corps de lettre.")))
                .andExpect(status().isForbidden());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Unknown consultationId → 404
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("6. Unknown consultationId → 404")
    void generate_unknownConsultation_returns404() throws Exception {
        UUID unknownId = UUID.randomUUID();
        mockMvc.perform(post("/api/consultations/" + unknownId + "/confrere-letter")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(letterJson("Chraibi", null, null, "Corps.")))
                .andExpect(status().isNotFound());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String url(String suffix) {
        return "/api/consultations/" + consultationId + suffix;
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

    private String letterJson(String recipientName, String recipientSpecialty,
                              String recipientCity, String body) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"recipientName\":\"").append(escapeJson(recipientName)).append("\"");
        if (recipientSpecialty != null) {
            sb.append(",\"recipientSpecialty\":\"").append(escapeJson(recipientSpecialty)).append("\"");
        }
        if (recipientCity != null) {
            sb.append(",\"recipientCity\":\"").append(escapeJson(recipientCity)).append("\"");
        }
        sb.append(",\"body\":\"").append(escapeJson(body)).append("\"");
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
