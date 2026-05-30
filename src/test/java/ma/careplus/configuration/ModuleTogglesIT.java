package ma.careplus.configuration;

import static org.assertj.core.api.Assertions.assertThat;
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
 * V070 (ADR-041) — habilitation des modules par l'admin.
 *
 * Bottle de la walk QA du 2026-05-30 (panneau « Modules de l'application ») :
 *   - un ADMIN désactive des modules secondaires (stock, messages) → 200, persisté
 *     dans configuration_clinic_settings.disabled_modules, et GET les renvoie ;
 *   - tenter de désactiver un module cœur (agenda) → 400 (validation @Pattern,
 *     liste blanche des seuls modules débrayables).
 * La garde SUPER_ADMIN (V069) ne s'applique PAS ici : disabled_modules n'est pas
 * un champ protégé, un ADMIN normal doit pouvoir l'éditer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ModuleTogglesIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String CLINIC_URL = "/api/settings/clinic";
    private static final String PWD = "Module-IT-Pwd-2026!";
    private static final UUID ROLE_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000004");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String adminEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = "admin-" + UUID.randomUUID() + "@test.ma";
        UUID adminId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Mod', 'Admin', TRUE, 0, 0, now(), now())
                """, adminId, adminEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", adminId, ROLE_ADMIN);

        jdbc.update("DELETE FROM configuration_clinic_settings");
        jdbc.update("""
                INSERT INTO configuration_clinic_settings (id, name, address, city, phone)
                VALUES (?, 'Cabinet Test', '1 rue', 'Casa', '+212600000000')
                """, UUID.randomUUID());
    }

    private String token() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + adminEmail + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    @Test
    void adminDisablesSecondaryModulesPersistedAndReturned() throws Exception {
        String t = token();
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "disabledModules":["stock","messages"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disabledModules.length()").value(2));

        mockMvc.perform(get(CLINIC_URL).header("Authorization", "Bearer " + t))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disabledModules.length()").value(2));

        String[] db = (String[]) jdbc.queryForObject(
                "SELECT disabled_modules FROM configuration_clinic_settings LIMIT 1",
                (rs, i) -> (String[]) rs.getArray("disabled_modules").getArray());
        assertThat(db).containsExactlyInAnyOrder("stock", "messages");
    }

    @Test
    void coreModuleCannotBeDisabled() throws Exception {
        String t = token();
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "disabledModules":["agenda"]}
                                """))
                .andExpect(status().isBadRequest());

        // Rien n'a été désactivé en base.
        Integer len = jdbc.queryForObject(
                "SELECT COALESCE(array_length(disabled_modules, 1), 0) FROM configuration_clinic_settings LIMIT 1",
                Integer.class);
        assertThat(len).isZero();
    }

    @Test
    void omittedDisabledModulesLeavesValueUnchanged() throws Exception {
        String t = token();
        // 1) désactive stock
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "disabledModules":["stock"]}
                                """))
                .andExpect(status().isOk());
        // 2) PUT sans le champ → ne doit pas réinitialiser
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disabledModules.length()").value(1));
    }
}
