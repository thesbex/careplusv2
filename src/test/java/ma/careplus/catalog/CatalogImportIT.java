package ma.careplus.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
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
 * V018 — import CSV catalogue (médicaments / analyses / radio).
 *
 * Couvre :
 *   - happy path médicaments (insert + upsert)
 *   - happy path analyses + radio
 *   - lignes en erreur accumulées dans `errors[]` (skipped, le reste passe)
 *   - SECRETAIRE : 403 (gate @PreAuthorize hasAnyRole ADMIN, MEDECIN)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class CatalogImportIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Catalog-Import-2026!";

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

        // Wipe users + their roles in correct order.
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID medId = UUID.randomUUID();
        medEmail = "med-import-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Import', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        UUID secId = UUID.randomUUID();
        secEmail = "sec-import-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Sec', 'Import', TRUE, 0, 0, now(), now())
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

    private static MockMultipartFile csv(String body) {
        return new MockMultipartFile(
                "file",
                "import.csv",
                "text/csv",
                body.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void importMedications_addsAndUpserts() throws Exception {
        String token = bearer(medEmail);
        String unique = "IT-" + UUID.randomUUID().toString().substring(0, 8);

        // First pass — both rows are new ⇒ added=2.
        String body1 = """
                commercial_name,dci,form,dosage,atc_code,tags,active
                %s-A,Guaifenesine,sirop,200mg/5ml,R05CA03,mucolytique,true
                %s-B,Paracetamol,suppositoire,150mg,N02BE01,antalgique,true
                """.formatted(unique, unique);

        mockMvc.perform(multipart("/api/catalog/medications/import")
                        .file(csv(body1))
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(2))
                .andExpect(jsonPath("$.updated").value(0))
                .andExpect(jsonPath("$.skipped").value(0))
                .andExpect(jsonPath("$.errors.length()").value(0));

        // Second pass — same rows, but tag changed ⇒ updated=2.
        String body2 = """
                commercial_name,dci,form,dosage,atc_code,tags,active
                %s-A,Guaifenesine,sirop,200mg/5ml,R05CA03,toux,true
                %s-B,Paracetamol,suppositoire,150mg,N02BE01,fievre,true
                """.formatted(unique, unique);

        mockMvc.perform(multipart("/api/catalog/medications/import")
                        .file(csv(body2))
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(0))
                .andExpect(jsonPath("$.updated").value(2));

        // Both rows are now searchable.
        mockMvc.perform(get("/api/catalog/medications?q=" + unique)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void importMedications_perRowErrorsAccumulated() throws Exception {
        String token = bearer(medEmail);
        String unique = "ITERR-" + UUID.randomUUID().toString().substring(0, 6);

        // Row 2 = OK ; row 3 = missing dci ; row 4 = OK.
        String body = """
                commercial_name,dci,form,dosage
                %s-OK,Guaifenesine,sirop,200mg
                %s-BAD,,sirop,5ml
                %s-OK2,Paracetamol,gelule,500mg
                """.formatted(unique, unique, unique);

        MvcResult r = mockMvc.perform(multipart("/api/catalog/medications/import")
                        .file(csv(body))
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(2))
                .andExpect(jsonPath("$.skipped").value(1))
                .andExpect(jsonPath("$.errors.length()").value(1))
                .andReturn();

        // The error string should mention the line number so a human can fix it.
        String json = r.getResponse().getContentAsString();
        assertThat(json).contains("Ligne 3");
    }

    @Test
    void importLabTests_addsByCode() throws Exception {
        String token = bearer(medEmail);
        String code = "IT-LAB-" + UUID.randomUUID().toString().substring(0, 6);

        String body = """
                code,name,category,active
                %s,Bilan IT spec,Hématologie,true
                """.formatted(code);

        mockMvc.perform(multipart("/api/catalog/lab-tests/import")
                        .file(csv(body))
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(1));

        mockMvc.perform(get("/api/catalog/lab-tests?q=" + code).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].code").value(code));
    }

    @Test
    void importImagingExams_addsByCode() throws Exception {
        String token = bearer(medEmail);
        String code = "IT-IMG-" + UUID.randomUUID().toString().substring(0, 6);

        String body = """
                code,name,modality,active
                %s,IRM IT spec,IRM,true
                """.formatted(code);

        mockMvc.perform(multipart("/api/catalog/imaging-exams/import")
                        .file(csv(body))
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(1));

        mockMvc.perform(get("/api/catalog/imaging-exams?q=" + code).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].code").value(code));
    }

    @Test
    void importMedications_secretaire_returns403() throws Exception {
        String token = bearer(secEmail);
        String body = "commercial_name,dci,form,dosage\nIT-DENIED,Test,sirop,5ml\n";

        mockMvc.perform(multipart("/api/catalog/medications/import")
                        .file(csv(body))
                        .header("Authorization", token))
                .andExpect(status().isForbidden());
    }

    @Test
    void importLabTests_secretaire_returns403() throws Exception {
        String token = bearer(secEmail);
        String body = "code,name\nIT-DENIED-LAB,Test\n";

        mockMvc.perform(multipart("/api/catalog/lab-tests/import")
                        .file(csv(body))
                        .header("Authorization", token))
                .andExpect(status().isForbidden());
    }

    @Test
    void importImagingExams_secretaire_returns403() throws Exception {
        String token = bearer(secEmail);
        String body = "code,name\nIT-DENIED-IMG,Test\n";

        mockMvc.perform(multipart("/api/catalog/imaging-exams/import")
                        .file(csv(body))
                        .header("Authorization", token))
                .andExpect(status().isForbidden());
    }
}
