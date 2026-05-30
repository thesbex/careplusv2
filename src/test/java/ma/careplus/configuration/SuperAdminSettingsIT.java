package ma.careplus.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 *
 * V072 (ADR-044) — l'apparence (thème) est un champ protégé au même titre que la
 * langue : bottle de la walk QA du 2026-05-30 (panneau Apparence super admin) —
 * round-trip JSON, refus 403 pour un ADMIN normal, taille bornée (400).
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
    void superAdminCanChangeLanguage() throws Exception {
        String t = token(superAdminEmail);
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "language":"ar"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.language").value("ar"));

        String lang = jdbc.queryForObject(
                "SELECT language FROM configuration_clinic_settings LIMIT 1", String.class);
        assertThat(lang).isEqualTo("ar");
    }

    @Test
    void normalAdminCannotChangeLanguage() throws Exception {
        String t = token(adminEmail);
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "language":"en"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUPER_ADMIN_REQUIRED"));

        String lang = jdbc.queryForObject(
                "SELECT language FROM configuration_clinic_settings LIMIT 1", String.class);
        assertThat(lang).isEqualTo("fr");
    }

    @Test
    void invalidLanguageRejected() throws Exception {
        String t = token(superAdminEmail);
        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"1 rue","city":"Casa","phone":"+212600000000",
                                 "language":"zz"}
                                """))
                .andExpect(status().isBadRequest());
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

    // ── V072 — Apparence (thème) ──────────────────────────────────────────────

    /** Le JSON d'apparence tel qu'envoyé par le panneau Apparence (preview puis save). */
    private static final String APPEARANCE_JSON =
            "{\"font\":\"jakarta\",\"tone\":\"default\",\"accent\":\"#5b53d8\",\"dark\":true}";

    /**
     * Bottle QA : un SUPER_ADMIN enregistre l'apparence (mode sombre + accent indigo +
     * police) → 200, renvoyée telle quelle, et persistée en base (cabinet-wide).
     */
    @Test
    void superAdminCanSaveAndReadBackAppearance() throws Exception {
        String t = token(superAdminEmail);
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Cabinet Test", "address", "1 rue", "city", "Casa",
                "phone", "+212600000000", "appearance", APPEARANCE_JSON));

        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appearance").value(APPEARANCE_JSON));

        String stored = jdbc.queryForObject(
                "SELECT appearance FROM configuration_clinic_settings LIMIT 1", String.class);
        assertThat(stored).isEqualTo(APPEARANCE_JSON);

        // Re-lecture via GET → le thème est rechargé depuis le backend (preuve cabinet-wide).
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get(CLINIC_URL).header("Authorization", "Bearer " + t))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appearance").value(APPEARANCE_JSON));
    }

    /** Bottle QA : un ADMIN normal ne peut pas changer l'apparence (champ protégé) → 403. */
    @Test
    void normalAdminCannotChangeAppearance() throws Exception {
        String t = token(adminEmail);
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Cabinet Test", "address", "1 rue", "city", "Casa",
                "phone", "+212600000000", "appearance", APPEARANCE_JSON));

        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUPER_ADMIN_REQUIRED"));

        String stored = jdbc.queryForObject(
                "SELECT appearance FROM configuration_clinic_settings LIMIT 1", String.class);
        assertThat(stored).isNull();
    }

    /** Garde de taille : une apparence > 2000 caractères est rejetée (400). */
    @Test
    void oversizedAppearanceRejected() throws Exception {
        String t = token(superAdminEmail);
        String huge = "{\"x\":\"" + "a".repeat(2100) + "\"}";
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Cabinet Test", "address", "1 rue", "city", "Casa",
                "phone", "+212600000000", "appearance", huge));

        mockMvc.perform(put(CLINIC_URL)
                        .header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }
}
