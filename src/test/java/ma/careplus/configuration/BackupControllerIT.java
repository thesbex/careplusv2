package ma.careplus.configuration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * ADR-042 — écran in-app de sauvegarde / restauration (BackupController).
 *
 * Bottle de la walk QA du 2026-05-30 (Paramètres > Sauvegarde & restauration) :
 *   - GET /api/admin/backups réservé SUPER_ADMIN : liste les .dump du dossier
 *     configuré (ADMIN normal → 403) ;
 *   - POST /restore valide le nom de fichier : traversée de chemin → 400,
 *     fichier absent → 404. (Le pg_restore réel n'est pas exécuté en CI — pas de
 *     binaire dans le conteneur de test ; le mécanisme est prouvé hors-test.)
 *
 * `careplus.backup.dir` est pointé sur un @TempDir via @DynamicPropertySource.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class BackupControllerIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    @TempDir
    static Path backupDir;

    @DynamicPropertySource
    static void backupProps(DynamicPropertyRegistry registry) {
        registry.add("careplus.backup.dir", () -> backupDir.toString());
    }

    private static final String BASE = "/api/admin/backups";
    private static final String PWD = "Backup-IT-Pwd-2026!";
    private static final UUID ROLE_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID ROLE_SUPER_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000009");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String superAdminEmail;
    private String adminEmail;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        superAdminEmail = "super-" + UUID.randomUUID() + "@test.ma";
        adminEmail = "admin-" + UUID.randomUUID() + "@test.ma";

        UUID superId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Super', 'Admin', TRUE, 0, 0, now(), now())
                """, superId, superAdminEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", superId, ROLE_ADMIN);
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", superId, ROLE_SUPER_ADMIN);

        UUID adminId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Normal', 'Admin', TRUE, 0, 0, now(), now())
                """, adminId, adminEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", adminId, ROLE_ADMIN);

        // Un faux .dump pour que la liste ne soit pas vide.
        Files.writeString(backupDir.resolve("careplus_20260530_020000.dump"), "PGDMP-fake");
    }

    private String token(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    @Test
    void superAdminListsBackups() throws Exception {
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + token(superAdminEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("careplus_20260530_020000.dump"));
    }

    @Test
    void normalAdminCannotListBackups() throws Exception {
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + token(adminEmail)))
                .andExpect(status().isForbidden());
    }

    @Test
    void restoreRejectsPathTraversal() throws Exception {
        mockMvc.perform(post(BASE + "/restore")
                        .header("Authorization", "Bearer " + token(superAdminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileName\":\"../etc/passwd.dump\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_BACKUP_NAME"));
    }

    @Test
    void restoreRejectsMissingFile() throws Exception {
        mockMvc.perform(post(BASE + "/restore")
                        .header("Authorization", "Bearer " + token(superAdminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileName\":\"careplus_inexistant.dump\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BACKUP_NOT_FOUND"));
    }

    @Test
    void normalAdminCannotRestore() throws Exception {
        mockMvc.perform(post(BASE + "/restore")
                        .header("Authorization", "Bearer " + token(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileName\":\"careplus_20260530_020000.dump\"}"))
                .andExpect(status().isForbidden());
    }
}
