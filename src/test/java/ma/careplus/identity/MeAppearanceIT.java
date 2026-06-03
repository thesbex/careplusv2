package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Map;
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
 * V073 — apparence PERSONNELLE par utilisateur (override du défaut cabinet, ADR-045).
 *
 * Mise en bouteille de la walk QA IHM (drive Playlist du 2026-06-02) : chaque
 * scénario joué dans le navigateur devient un @Test isolé asserrant l'état
 * persisté (colonne {@code identity_user.appearance}), pas juste le 200.
 *
 * SCÉNARIOS COUVERTS :
 *  1. Non authentifié → 401 (la garde isAuthenticated() ferme l'endpoint).
 *  2. État initial : pas d'override → réponse sans champ appearance, colonne NULL.
 *  3. PUT d'un override → 200 + écho, GET le reflète, colonne = le JSON exact.
 *  4. PUT appearance=null → réinitialise : réponse vide, GET vide, colonne NULL.
 *  5. Override > 2000 car. → 400 (borne @Size = taille colonne VARCHAR 2000).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class MeAppearanceIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String APPEARANCE_URL = "/api/users/me/appearance";
    private static final String LOGIN_URL = "/api/auth/login";

    private static final String TEST_EMAIL = "appearance.user@careplus.ma";
    private static final String TEST_PASSWORD = "ChangeMe123!";
    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");

    /** JSON d'apparence opaque (le backend le stocke tel quel ; le front le normalise). */
    private static final String OVERRIDE_JSON =
            "{\"accent\":\"#0e5b3e\",\"dark\":false,\"font\":\"geist\",\"tone\":\"sage\"}";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter loginRateLimitFilter;

    private UUID testUserId;

    @BeforeEach
    void seedTestUser() {
        loginRateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN (SELECT id FROM identity_user WHERE email = ?)", TEST_EMAIL);
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN (SELECT id FROM identity_user WHERE email = ?)", TEST_EMAIL);
        jdbc.update("DELETE FROM identity_user WHERE email = ?", TEST_EMAIL);

        testUserId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, phone, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                testUserId, TEST_EMAIL, passwordEncoder.encode(TEST_PASSWORD), "Appearance", "User", "+212600000009",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", testUserId, ROLE_MEDECIN);
    }

    @Test
    @DisplayName("1. Non authentifié — GET /me/appearance → 401")
    void unauthenticated_401() throws Exception {
        mockMvc.perform(get(APPEARANCE_URL))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("2. État initial — pas d'override : réponse sans appearance, colonne NULL")
    void initial_noOverride() throws Exception {
        String token = bearer();
        mockMvc.perform(get(APPEARANCE_URL).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appearance").doesNotExist());

        assertThat(currentAppearanceColumn()).isNull();
    }

    @Test
    @DisplayName("3. PUT override — 200 + écho, GET le reflète, colonne = JSON exact")
    void putOverride_persistsAndIsReadBack() throws Exception {
        String token = bearer();
        String body = objectMapper.writeValueAsString(Map.of("appearance", OVERRIDE_JSON));

        mockMvc.perform(put(APPEARANCE_URL)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appearance").value(OVERRIDE_JSON));

        // Persisté en base (la walk IHM voyait le thème survivre au refetch).
        assertThat(currentAppearanceColumn()).isEqualTo(OVERRIDE_JSON);

        // Et relu à l'identique par un GET ultérieur.
        mockMvc.perform(get(APPEARANCE_URL).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appearance").value(OVERRIDE_JSON));
    }

    @Test
    @DisplayName("4. PUT appearance=null — réinitialise au défaut cabinet (colonne NULL)")
    void putNull_resetsToCabinetDefault() throws Exception {
        String token = bearer();
        // D'abord poser un override…
        mockMvc.perform(put(APPEARANCE_URL)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("appearance", OVERRIDE_JSON))))
                .andExpect(status().isOk());
        assertThat(currentAppearanceColumn()).isEqualTo(OVERRIDE_JSON);

        // …puis le réinitialiser (bouton « Réinitialiser au défaut du cabinet »).
        mockMvc.perform(put(APPEARANCE_URL)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appearance\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appearance").doesNotExist());

        assertThat(currentAppearanceColumn()).isNull();
    }

    @Test
    @DisplayName("5. Override > 2000 car. — 400 (borne @Size = colonne VARCHAR 2000)")
    void oversize_rejected() throws Exception {
        String token = bearer();
        String tooLong = "x".repeat(2100);
        String body = objectMapper.writeValueAsString(Map.of("appearance", tooLong));

        mockMvc.perform(put(APPEARANCE_URL)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        // Rien n'a été écrit.
        assertThat(currentAppearanceColumn()).isNull();
    }

    // ---------- helpers ----------

    private String currentAppearanceColumn() {
        return jdbc.queryForObject(
                "SELECT appearance FROM identity_user WHERE id = ?", String.class, testUserId);
    }

    private String bearer() throws Exception {
        MvcResult r = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + TEST_EMAIL + "\",\"password\":\"" + TEST_PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }
}
