package ma.careplus.configuration;

import static org.assertj.core.api.Assertions.assertThat;
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
 * V069 (ADR-040) — rôle SUPER_ADMIN sur les sections sensibles du paramétrage
 * cabinet (Identité du centre, Services internes, Hospitalisation).
 *
 * Bottle de la walk QA du 2026-05-30 (PUT /api/settings/clinic) :
 *   - un SUPER_ADMIN peut modifier l'identité + les flags services internes ;
 *   - un ADMIN « normal » est refusé (403) dès qu'un champ protégé change ;
 *   - un ADMIN normal qui ré-émet l'identité inchangée passe (200) — il doit
 *     pouvoir toucher les champs non protégés (cloisonnement, modules).
 * Garde réelle : SettingsController.requireSuperAdminIfProtectedChanges.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class SuperAdminSettingsIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String CLINIC_URL = "/api/settings/clinic";
    private static final String LOGIN_URL = "/api/auth/login";
    private static final String PWD = "Admin-Pwd-Seed-2026!";

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
    void seed() {
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
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, now(), now())
                """,
                superId, superAdminEmail, passwordEncoder.encode(PWD), "Super", "Admin");
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", superId, ROLE_ADMIN);
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", superId, ROLE_SUPER_ADMIN);

        UUID adminId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, now(), now())
                """,
                adminId, adminEmail, passwordEncoder.encode(PWD), "Normal", "Admin");
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", adminId, ROLE_ADMIN);

        // Identité connue de départ pour les comparaisons de la garde (single-row).
        jdbc.update("DELETE FROM configuration_clinic_settings");
        jdbc.update("""
                INSERT INTO configuration_clinic_settings
                    (id, name, address, city, phone, establishment_type,
                     imaging_internal, lab_internal, hospitalization_enabled)
                VALUES (?, 'Cabinet Test', '1 rue', 'Casa', '+212600000000', 'CABINET',
                        FALSE, FALSE, FALSE)
                """, UUID.randomUUID());
    }

    private String token(String email) throws Exception {
        MvcResult result = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    @Test
    void superAdminCanChangeIdentityAndInternalServices() throws Exception {
        String t = token(superAdminEmail);
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Clinique Renommée","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "labInternal":true,"imagingInternal":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Clinique Renommée"))
                .andExpect(jsonPath("$.labInternal").value(true));

        String name = jdbc.queryForObject(
                "SELECT name FROM configuration_clinic_settings LIMIT 1", String.class);
        assertThat(name).isEqualTo("Clinique Renommée");
    }

    @Test
    void normalAdminCannotRenameCentre() throws Exception {
        String t = token(adminEmail);
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"HACK Rename","address":"1 rue","city":"Casa","phone":"+212600000000"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUPER_ADMIN_REQUIRED"));

        String name = jdbc.queryForObject(
                "SELECT name FROM configuration_clinic_settings LIMIT 1", String.class);
        assertThat(name).isEqualTo("Cabinet Test");
    }

    @Test
    void normalAdminCannotToggleInternalService() throws Exception {
        String t = token(adminEmail);
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "labInternal":true}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUPER_ADMIN_REQUIRED"));

        Boolean lab = jdbc.queryForObject(
                "SELECT lab_internal FROM configuration_clinic_settings LIMIT 1", Boolean.class);
        assertThat(lab).isFalse();
    }

    @Test
    void normalAdminCanReSaveUnchangedIdentity() throws Exception {
        String t = token(adminEmail);
        // Aucun champ protégé ne change → autorisé (permet d'éditer cloisonnement/modules).
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000"}
                                """))
                .andExpect(status().isOk());
    }
}
