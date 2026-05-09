package ma.careplus.configuration;

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
 * V039 — vérifie que GET/PUT /api/settings/clinic exposent et préservent
 * pregnancyOrphanVisibleRoles, symétriquement à vaccinationOrphanVisibleRoles
 * (V036). Sœur jumelle d'AgendaStrictToggleIT pour le nouveau champ.
 *
 * <p>Bottle la walk Playwright manuelle 2026-05-09 sur le panneau
 * « Grossesses sans médecin référent » dans /parametres → onglet Cabinet.
 *
 * <p>Scénarios :
 * <ol>
 *   <li>Default à la 1ère création = tous les rôles ({MEDECIN,ADMIN,SECRETAIRE,ASSISTANT}).</li>
 *   <li>PUT avec une liste réduite → GET reflète la nouvelle valeur.</li>
 *   <li>PUT sans le champ → préserve la dernière valeur (legacy clients ignorés).</li>
 *   <li>PUT avec un rôle invalide → 400 (validation @Pattern).</li>
 *   <li>RBAC : MEDECIN PUT → 403 (seul ADMIN peut écrire les settings).</li>
 *   <li>Indépendance V036 vs V039 : modifier l'un ne touche pas l'autre.</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyOrphanRolesSettingsIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "PregOrphan-IT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String adminEmail;
    private String medEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM configuration_clinic_settings");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'preg-orphan-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'preg-orphan-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'preg-orphan-%'");

        adminEmail = "preg-orphan-admin-" + UUID.randomUUID() + "@test.ma";
        UUID adminId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Admin', 'PregOrphan', TRUE, 0, 0, now(), now())
                """, adminId, adminEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", adminId, ROLE_ADMIN);

        medEmail = "preg-orphan-med-" + UUID.randomUUID() + "@test.ma";
        UUID medId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Med', 'PregOrphan', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", medId, ROLE_MEDECIN);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Scénario 1 — Default à la 1ère création = tous les rôles ─────────────

    @Test
    void s1_defaultIsAllRoles() throws Exception {
        String token = bearer(adminEmail);

        // 1ère création de la ligne — sans préciser le champ.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test",
                                 "address":"Bd Mohammed V",
                                 "city":"Casablanca",
                                 "phone":"+212522000000"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles.length()").value(4))
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles", org.hamcrest.Matchers.containsInAnyOrder(
                        "MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT")));

        // GET reflète aussi.
        mockMvc.perform(get("/api/settings/clinic")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles", org.hamcrest.Matchers.containsInAnyOrder(
                        "MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT")));
    }

    // ── Scénario 2 — PUT avec liste réduite → GET reflète ───────────────────

    @Test
    void s2_putReducedRoles_persists() throws Exception {
        String token = bearer(adminEmail);

        // Bootstrap.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212"}
                                """))
                .andExpect(status().isOk());

        // Restreint aux ADMIN seulement.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212",
                                 "pregnancyOrphanVisibleRoles":["ADMIN"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles.length()").value(1))
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles[0]").value("ADMIN"));
    }

    // ── Scénario 3 — PUT sans le champ → préserve la dernière valeur ────────

    @Test
    void s3_putWithoutField_preserves() throws Exception {
        String token = bearer(adminEmail);

        // Set restreint.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212",
                                 "pregnancyOrphanVisibleRoles":["MEDECIN","ADMIN"]}
                                """))
                .andExpect(status().isOk());

        // PUT sans le champ → préserve.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles.length()").value(2))
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles", org.hamcrest.Matchers.containsInAnyOrder(
                        "MEDECIN", "ADMIN")));
    }

    // ── Scénario 4 — PUT avec rôle invalide → 400 ──────────────────────────

    @Test
    void s4_putInvalidRole_returns400() throws Exception {
        String token = bearer(adminEmail);

        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212",
                                 "pregnancyOrphanVisibleRoles":["FAKE_ROLE"]}
                                """))
                .andExpect(status().isBadRequest());
    }

    // ── Scénario 5 — MEDECIN PUT → 403 ─────────────────────────────────────

    @Test
    void s5_medecinPut_returns403() throws Exception {
        String token = bearer(medEmail);

        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212",
                                 "pregnancyOrphanVisibleRoles":["ADMIN"]}
                                """))
                .andExpect(status().isForbidden());
    }

    // ── Scénario 6 — Indépendance V036 vs V039 ─────────────────────────────

    @Test
    void s6_vaccinationAndPregnancyRolesIndependent() throws Exception {
        String token = bearer(adminEmail);

        // Bootstrap avec les 2 champs définis distinctement.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212",
                                 "vaccinationOrphanVisibleRoles":["ADMIN","SECRETAIRE"],
                                 "pregnancyOrphanVisibleRoles":["MEDECIN","ADMIN"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vaccinationOrphanVisibleRoles", org.hamcrest.Matchers.containsInAnyOrder(
                        "ADMIN", "SECRETAIRE")))
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles", org.hamcrest.Matchers.containsInAnyOrder(
                        "MEDECIN", "ADMIN")));

        // Modifier UNIQUEMENT vaccination → pregnancy doit rester intact.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cabinet Test","address":"X","city":"Y","phone":"+212",
                                 "vaccinationOrphanVisibleRoles":["MEDECIN"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vaccinationOrphanVisibleRoles.length()").value(1))
                .andExpect(jsonPath("$.vaccinationOrphanVisibleRoles[0]").value("MEDECIN"))
                // pregnancy intact :
                .andExpect(jsonPath("$.pregnancyOrphanVisibleRoles", org.hamcrest.Matchers.containsInAnyOrder(
                        "MEDECIN", "ADMIN")));
    }
}
