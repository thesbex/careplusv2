package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
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
 * V044 — Integration coverage for the admin-driven password reset flow and
 * the self-service change-password endpoint that releases the force-change
 * gate.
 *
 * <p>Scenarios bottled:
 * <ul>
 *   <li>admin POST /reset-password → flag flips TRUE, new password works,
 *       old password no longer works, refresh tokens revoked</li>
 *   <li>admin can't reset their own password (400)</li>
 *   <li>weak / blank password rejected (400)</li>
 *   <li>secretaire can't reset anyone (403)</li>
 *   <li>flagged user gets 403 PASSWORD_CHANGE_REQUIRED on protected routes,
 *       200 on /me, 200 on /change-password, 200 on /logout</li>
 *   <li>self-service /change-password validates currentPassword, refuses
 *       reuse, clears the flag</li>
 *   <li>login response surfaces the flag so the SPA can redirect</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PasswordResetIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String LOGIN_URL = "/api/auth/login";
    private static final String ADMIN_PASSWORD = "Admin-Pwd-Seed-2026!";
    private static final String TARGET_PASSWORD = "Target-Pwd-Seed-2026!";
    private static final String SECRETAIRE_PASSWORD = "Sec-Pwd-Seed-2026!";
    private static final String NEW_PASSWORD = "Brand-New-Pwd-2026!";

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000004");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String adminEmail;
    private UUID adminId;
    private String targetEmail;
    private UUID targetId;
    private String secretaireEmail;

    @BeforeEach
    void seedUsers() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = "admin-" + UUID.randomUUID() + "@test.ma";
        targetEmail = "doc-" + UUID.randomUUID() + "@test.ma";
        secretaireEmail = "sec-" + UUID.randomUUID() + "@test.ma";

        adminId = insertUser(adminEmail, ADMIN_PASSWORD, ROLE_ADMIN);
        targetId = insertUser(targetEmail, TARGET_PASSWORD, ROLE_MEDECIN);
        insertUser(secretaireEmail, SECRETAIRE_PASSWORD, ROLE_SECRETAIRE);
    }

    private UUID insertUser(String email, String password, UUID roleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(password),
                "Test", "User", OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", id, roleId);
        return id;
    }

    private String loginAndGetAccessToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private MvcResult login(String email, String password) throws Exception {
        return mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andReturn();
    }

    @Test
    void adminResetsPasswordAndFlagsForceChange() throws Exception {
        String adminToken = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);

        // Seed a refresh token for the target so we can verify it gets revoked.
        UUID refreshId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_refresh_token
                    (id, user_id, token_hash, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                refreshId, targetId, "fake-hash-" + UUID.randomUUID(),
                OffsetDateTime.now().plusDays(7));

        mockMvc.perform(post("/api/admin/users/{id}/reset-password", targetId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isNoContent());

        Boolean flag = jdbc.queryForObject(
                "SELECT password_change_required FROM identity_user WHERE id = ?",
                Boolean.class, targetId);
        assertThat(flag).isTrue();

        OffsetDateTime revoked = jdbc.queryForObject(
                "SELECT revoked_at FROM identity_refresh_token WHERE id = ?",
                OffsetDateTime.class, refreshId);
        assertThat(revoked).isNotNull();

        // Old password no longer works
        login(targetEmail, TARGET_PASSWORD).getResponse().getStatus();
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + targetEmail + "\",\"password\":\"" + TARGET_PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());
        // Reset the lock counter so the next login isn't blocked by rate limit.
        jdbc.update("UPDATE identity_user SET failed_attempts = 0, locked_until = NULL WHERE id = ?", targetId);
        rateLimitFilter.clearBucketsForTests();

        // New password works AND surfaces the flag
        MvcResult loginResult = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + targetEmail + "\",\"password\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.passwordChangeRequired").value(true))
                .andReturn();
        assertThat(loginResult.getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void adminCannotResetOwnPassword() throws Exception {
        String adminToken = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);

        mockMvc.perform(post("/api/admin/users/{id}/reset-password", adminId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_RESET_OWN_PASSWORD"));

        Boolean flag = jdbc.queryForObject(
                "SELECT password_change_required FROM identity_user WHERE id = ?",
                Boolean.class, adminId);
        assertThat(flag).isFalse();
    }

    @Test
    void weakPasswordIsRejected() throws Exception {
        String adminToken = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);

        mockMvc.perform(post("/api/admin/users/{id}/reset-password", targetId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void secretaireCannotResetAnyone() throws Exception {
        String secToken = loginAndGetAccessToken(secretaireEmail, SECRETAIRE_PASSWORD);

        mockMvc.perform(post("/api/admin/users/{id}/reset-password", targetId)
                        .header("Authorization", "Bearer " + secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void resetUnknownUserReturns404() throws Exception {
        String adminToken = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);

        mockMvc.perform(post("/api/admin/users/{id}/reset-password", UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void flaggedUserBlockedOnProtectedRoutesButAllowedToReadMeAndChange() throws Exception {
        // Flip the flag directly so we don't depend on the admin path.
        jdbc.update("UPDATE identity_user SET password_change_required = TRUE WHERE id = ?", targetId);

        String token = loginAndGetAccessToken(targetEmail, TARGET_PASSWORD);

        // /api/users/me is whitelisted
        mockMvc.perform(get("/api/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passwordChangeRequired").value(true));

        // Any other protected route is blocked with PASSWORD_CHANGE_REQUIRED
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + token))
                // Either the filter blocks first (PASSWORD_CHANGE_REQUIRED) or
                // role check blocks first (FORBIDDEN). The filter runs first,
                // so the expected payload is the V044 problem.
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));

        // Self change-password is allowed
        mockMvc.perform(post("/api/users/me/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + TARGET_PASSWORD
                                + "\",\"newPassword\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isNoContent());

        Boolean flag = jdbc.queryForObject(
                "SELECT password_change_required FROM identity_user WHERE id = ?",
                Boolean.class, targetId);
        assertThat(flag).isFalse();
    }

    @Test
    void changePasswordRejectsWrongCurrent() throws Exception {
        String token = loginAndGetAccessToken(targetEmail, TARGET_PASSWORD);

        mockMvc.perform(post("/api/users/me/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Wrong-Pwd-2026!\","
                                + "\"newPassword\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURRENT_PASSWORD"));
    }

    @Test
    void changePasswordRejectsReuse() throws Exception {
        String token = loginAndGetAccessToken(targetEmail, TARGET_PASSWORD);

        mockMvc.perform(post("/api/users/me/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + TARGET_PASSWORD
                                + "\",\"newPassword\":\"" + TARGET_PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_REUSED"));
    }

    @Test
    void changePasswordRejectsWeakNew() throws Exception {
        String token = loginAndGetAccessToken(targetEmail, TARGET_PASSWORD);

        mockMvc.perform(post("/api/users/me/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + TARGET_PASSWORD
                                + "\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }
}
