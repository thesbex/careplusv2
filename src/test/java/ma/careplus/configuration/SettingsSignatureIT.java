package ma.careplus.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.UUID;
import javax.imageio.ImageIO;
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
 * F16 — endpoints de gestion de la signature scannée du médecin.
 *
 * Couvre :
 *   • PUT /api/settings/signature : ADMIN seul, MIME et taille validés
 *   • DELETE /api/settings/signature : ADMIN seul, idempotent
 *   • GET  /api/settings/signature : tous rôles auth, retourne les bytes
 *   • GET  /api/settings/signature/meta : tous rôles auth, retourne mime + date
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class SettingsSignatureIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Sig-Test-Pwd-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String adminEmail;
    private String medecinEmail;
    private String secretaireEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        // Reset signature state on the (single) cabinet row, if any
        jdbc.update("UPDATE configuration_clinic_settings "
                + "SET signature_blob = NULL, signature_mime = NULL, signature_uploaded_at = NULL");

        // Wipe + re-seed three users, one per relevant role.
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = createUser("admin", ROLE_ADMIN);
        medecinEmail = createUser("med", ROLE_MEDECIN);
        secretaireEmail = createUser("sec", ROLE_SECRETAIRE);
    }

    private String createUser(String prefix, UUID roleId) {
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        UUID userId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts,
                     version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                userId, email, passwordEncoder.encode(PWD),
                "First", "Last", OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", userId, roleId);
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

    /** Génère un PNG transparent minimal valide (32×16). */
    private static byte[] tinyPng() throws Exception {
        BufferedImage img = new BufferedImage(32, 16, BufferedImage.TYPE_INT_ARGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "PNG", baos);
        return baos.toByteArray();
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    @Test
    void adminCanUploadSignatureAsPng() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", png);

        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mime").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(png.length))
                .andExpect(jsonPath("$.uploadedAt").exists());
    }

    @Test
    void medecinCannotUploadSignature() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", png);

        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isForbidden());
    }

    @Test
    void secretaireCannotUploadSignature() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", png);

        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(secretaireEmail)))
                .andExpect(status().isForbidden());
    }

    @Test
    void uploadRejectsTextMime() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.txt", "text/plain", "not an image".getBytes());

        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsTooLargeFile() throws Exception {
        // 600 Ko > 500 Ko cap
        byte[] big = new byte[600 * 1024];
        Arrays.fill(big, (byte) 0xAA);
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", big);

        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isBadRequest());
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @Test
    void getSignatureReturnsBytesAfterUpload() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk());

        // Tous les rôles auth peuvent lire la signature (pour PDF / aperçu).
        byte[] body = mockMvc.perform(get("/api/settings/signature")
                        .header("Authorization", bearer(secretaireEmail)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(body).isEqualTo(png);

        // Médecin aussi
        mockMvc.perform(get("/api/settings/signature")
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isOk());
    }

    @Test
    void getSignatureMetaReturnsMimeAndDate() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/settings/signature/meta")
                        .header("Authorization", bearer(secretaireEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mime").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(png.length));
    }

    @Test
    void getSignatureReturns204WhenNotConfigured() throws Exception {
        mockMvc.perform(get("/api/settings/signature")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/settings/signature/meta")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Test
    void adminCanDeleteSignature() throws Exception {
        // Upload first
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "sig.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/signature").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk());

        // Delete
        mockMvc.perform(delete("/api/settings/signature")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // GET now 204
        mockMvc.perform(get("/api/settings/signature")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());
    }

    @Test
    void medecinCannotDeleteSignature() throws Exception {
        mockMvc.perform(delete("/api/settings/signature")
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isForbidden());
    }
}
