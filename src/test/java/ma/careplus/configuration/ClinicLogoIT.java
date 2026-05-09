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
 * V037 — endpoints de gestion du logo établissement.
 *
 * Bottles le walk Playwright du 2026-05-09 :
 *   • PUT /api/settings/clinic/logo : ADMIN seul, MIME et taille validés
 *   • DELETE /api/settings/clinic/logo : ADMIN seul, idempotent
 *   • GET  /api/settings/clinic/logo : tous rôles auth, retourne les bytes
 *   • GET  /api/settings/clinic/logo/meta : tous rôles auth, retourne mime + date
 *
 * Pattern aligné sur SettingsSignatureIT (signature médecin V031).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ClinicLogoIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Logo-Test-Pwd-2026!";

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
        // Reset logo state on the (single) cabinet row, if any.
        jdbc.update("UPDATE configuration_clinic_settings "
                + "SET logo_blob = NULL, logo_mime = NULL, logo_uploaded_at = NULL");

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

    /** Génère un JPEG valide (32×16). */
    private static byte[] tinyJpeg() throws Exception {
        BufferedImage img = new BufferedImage(32, 16, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "JPEG", baos);
        return baos.toByteArray();
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    @Test
    void adminCanUploadLogoAsPng() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", png);

        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mime").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(png.length))
                .andExpect(jsonPath("$.uploadedAt").exists());
    }

    @Test
    void adminCanUploadLogoAsJpeg() throws Exception {
        byte[] jpg = tinyJpeg();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.jpg", "image/jpeg", jpg);

        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mime").value("image/jpeg"));
    }

    @Test
    void medecinCannotUploadLogo() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", png);

        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isForbidden());
    }

    @Test
    void secretaireCannotUploadLogo() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", png);

        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(secretaireEmail)))
                .andExpect(status().isForbidden());
    }

    @Test
    void uploadRejectsPdfMime() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.pdf", "application/pdf", "%PDF-fake".getBytes());

        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isBadRequest());
    }

    /**
     * V037 v1 : SVG explicitement repoussé en BACKLOG (cf. design doc) car openhtmltopdf
     * nécessite un module séparé. On verrouille le rejet pour éviter de l'oublier en v2.
     */
    @Test
    void uploadRejectsSvgMime() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.svg", "image/svg+xml", "<svg/>".getBytes());

        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsTooLargeFile() throws Exception {
        byte[] big = new byte[600 * 1024]; // 600 Ko > 500 Ko cap
        Arrays.fill(big, (byte) 0xAA);
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", big);

        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isBadRequest());
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @Test
    void getLogoReturnsBytesAfterUpload() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk());

        // Tous les rôles auth peuvent lire (pour PDF / aperçu côté FE).
        byte[] body = mockMvc.perform(get("/api/settings/clinic/logo")
                        .header("Authorization", bearer(secretaireEmail)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(body).isEqualTo(png);

        mockMvc.perform(get("/api/settings/clinic/logo")
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isOk());
    }

    @Test
    void getLogoMetaReturnsMimeAndDate() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/settings/clinic/logo/meta")
                        .header("Authorization", bearer(secretaireEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mime").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(png.length));
    }

    @Test
    void getLogoReturns204WhenNotConfigured() throws Exception {
        mockMvc.perform(get("/api/settings/clinic/logo")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/settings/clinic/logo/meta")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());
    }

    @Test
    void clinicSettingsHasLogoFlagReflectsState() throws Exception {
        // Pas de logo → hasLogo=false (ou pas de row → 204)
        mockMvc.perform(get("/api/settings/clinic")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status == 200) {
                        assertThat(result.getResponse().getContentAsString())
                                .contains("\"hasLogo\":false");
                    } else {
                        assertThat(status).isEqualTo(204);
                    }
                });

        // Upload logo
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk());

        // Maintenant hasLogo=true
        mockMvc.perform(get("/api/settings/clinic")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasLogo").value(true));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Test
    void adminCanDeleteLogo() throws Exception {
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", png);
        mockMvc.perform(multipart("/api/settings/clinic/logo").file(file)
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/settings/clinic/logo")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // GET now 204
        mockMvc.perform(get("/api/settings/clinic/logo")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());
    }

    @Test
    void medecinCannotDeleteLogo() throws Exception {
        mockMvc.perform(delete("/api/settings/clinic/logo")
                        .header("Authorization", bearer(medecinEmail)))
                .andExpect(status().isForbidden());
    }
}
