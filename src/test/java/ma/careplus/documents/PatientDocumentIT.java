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
 * QA2-2 — Documents historiques rattachés au dossier patient.
 * Couvre : upload (multipart), list, download (stream), MIME rejeté,
 * permission DELETE limitée à MEDECIN/ADMIN, soft-delete invisible en list.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PatientDocumentIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");

    private static final String PWD = "Care-Plus-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail;
    String medEmail;
    String asstEmail;
    final Map<String, String> tokenCache = new HashMap<>();

    @BeforeEach
    void seed() {
        tokenCache.clear();
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM patient_document");
        jdbc.update("DELETE FROM patient_note");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM patient_antecedent");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        medEmail  = seedUser("med",  ROLE_MEDECIN);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
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
                        .content("{\"firstName\":\"Doc\",\"lastName\":\"Test\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
    }

    @Test
    void secretaire_canUploadAndListAndDownload() throws Exception {
        String patientId = createPatient();

        byte[] payload = "%PDF-1.4 fake bytes".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "ancienne-ordonnance.pdf", "application/pdf", payload);

        MvcResult uploaded = mockMvc.perform(multipart("/api/patients/" + patientId + "/documents")
                        .file(file)
                        .param("type", "PRESCRIPTION_HISTORIQUE")
                        .param("notes", "Reçu en consultation")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("PRESCRIPTION_HISTORIQUE"))
                .andExpect(jsonPath("$.originalFilename").value("ancienne-ordonnance.pdf"))
                .andExpect(jsonPath("$.mimeType").value("application/pdf"))
                .andExpect(jsonPath("$.sizeBytes").value(payload.length))
                .andReturn();

        String docId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

        // ASSISTANT can list (read-only access).
        mockMvc.perform(get("/api/patients/" + patientId + "/documents")
                        .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(docId));

        // ASSISTANT can download too.
        MvcResult dl = mockMvc.perform(get("/api/documents/" + docId + "/content")
                        .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(dl.getResponse().getContentAsByteArray()).isEqualTo(payload);
        assertThat(dl.getResponse().getContentType()).startsWith("application/pdf");
    }

    @Test
    void rejectsUnsupportedMimeType() throws Exception {
        String patientId = createPatient();
        MockMultipartFile evil = new MockMultipartFile(
                "file", "x.exe", "application/x-msdownload", new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/patients/" + patientId + "/documents")
                        .file(evil)
                        .param("type", "AUTRE")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("DOCUMENT_MIME_REJECTED"));
    }

    @Test
    void rejectsUnknownDocumentType() throws Exception {
        String patientId = createPatient();
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "x.pdf", "application/pdf", new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/patients/" + patientId + "/documents")
                        .file(pdf)
                        .param("type", "NOT_A_REAL_TYPE")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DOCUMENT_TYPE_INVALID"));
    }

    @Test
    void assistantCannotUpload() throws Exception {
        String patientId = createPatient();
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "x.pdf", "application/pdf", new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/patients/" + patientId + "/documents")
                        .file(pdf)
                        .param("type", "AUTRE")
                        .header("Authorization", bearer(asstEmail)))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyMedecinOrAdminCanDelete() throws Exception {
        String patientId = createPatient();
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "x.pdf", "application/pdf", new byte[]{1, 2, 3});

        MvcResult uploaded = mockMvc.perform(multipart("/api/patients/" + patientId + "/documents")
                        .file(pdf)
                        .param("type", "ANALYSE")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isCreated())
                .andReturn();
        String docId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

        // SECRETAIRE cannot delete.
        mockMvc.perform(delete("/api/documents/" + docId)
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());

        // MEDECIN can.
        mockMvc.perform(delete("/api/documents/" + docId)
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNoContent());

        // List no longer returns the soft-deleted doc.
        mockMvc.perform(get("/api/patients/" + patientId + "/documents")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // GET content on soft-deleted doc → 404.
        mockMvc.perform(get("/api/documents/" + docId + "/content")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DOCUMENT_NOT_FOUND"));
    }

    @Test
    void unknownPatientRejected() throws Exception {
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "x.pdf", "application/pdf", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/api/patients/" + UUID.randomUUID() + "/documents")
                        .file(pdf)
                        .param("type", "AUTRE")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PATIENT_NOT_FOUND"));
    }
}
