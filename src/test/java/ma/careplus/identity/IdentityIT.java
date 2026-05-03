package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.identity.infrastructure.persistence.UserRepository;
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
 * Integration tests for the identity module.
 * Seeds 3 dev users via JDBC to match DevUserSeeder's data (test profile = no @Profile("dev") beans).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class IdentityIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String LOGIN_URL = "/api/auth/login";
    private static final String REFRESH_URL = "/api/auth/refresh";
    private static final String LOGOUT_URL = "/api/auth/logout";
    private static final String ME_URL = "/api/users/me";

    private static final String TEST_EMAIL = "youssef.elamrani@careplus.ma";
    private static final String TEST_PASSWORD = "ChangeMe123!";
    private static final String COOKIE_NAME = "careplus_refresh";

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    UserRepository userRepository;

    @Autowired
    LoginRateLimitFilter loginRateLimitFilter;

    private UUID testUserId;

    @BeforeEach
    void seedTestUser() {
        // Reset Bucket4j state so earlier tests don't exhaust the 5-per-15-min quota
        // of the shared 127.0.0.1 MockMvc client IP.
        loginRateLimitFilter.clearBucketsForTests();
        // Clean up prior runs
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN (SELECT id FROM identity_user WHERE email = ?)", TEST_EMAIL);
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN (SELECT id FROM identity_user WHERE email = ?)", TEST_EMAIL);
        jdbc.update("DELETE FROM identity_user WHERE email = ?", TEST_EMAIL);

        testUserId = UUID.randomUUID();
        String hash = passwordEncoder.encode(TEST_PASSWORD);
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, phone, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                testUserId, TEST_EMAIL, hash, "Youssef", "El Amrani", "+212600000001",
                OffsetDateTime.now(), OffsetDateTime.now());

        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", testUserId, ROLE_MEDECIN);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", testUserId, ROLE_ADMIN);
    }

    // --- helpers ---

    private String loginBody(String email, String password) throws Exception {
        return objectMapper.writeValueAsString(new java.util.Map.Entry<String, String>() {
            @Override public String getKey() { return email; }
            @Override public String getValue() { return password; }
            @Override public String setValue(String v) { return null; }
        });
    }

    private String buildLoginJson(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    private Cookie performLoginAndGetCookie() throws Exception {
        MvcResult result = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildLoginJson(TEST_EMAIL, TEST_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie refreshCookie = result.getResponse().getCookie(COOKIE_NAME);
        assertThat(refreshCookie).isNotNull();
        return refreshCookie;
    }

    private String performLoginAndGetAccessToken() throws Exception {
        MvcResult result = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildLoginJson(TEST_EMAIL, TEST_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        return objectMapper.readTree(body).get("accessToken").asText();
    }

    // --- tests ---

    @Test
    void login_happyPath_returnsAccessTokenAndSetsCookie() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildLoginJson(TEST_EMAIL, TEST_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.expiresInSeconds").value(900))
                .andExpect(jsonPath("$.user.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.user.roles").isArray());

        // Cookie is verified via Set-Cookie header (since MockMvc cookie support checks response cookies)
        // The Set-Cookie header approach via response header
        MvcResult result = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildLoginJson(TEST_EMAIL, TEST_PASSWORD)))
                .andReturn();

        String setCookieHeader = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookieHeader).isNotNull().contains(COOKIE_NAME);
        assertThat(setCookieHeader).contains("HttpOnly");
        assertThat(setCookieHeader).contains("SameSite=Strict");
    }

    @Test
    void login_wrongPassword_401_incrementsFailedAttempts() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildLoginJson(TEST_EMAIL, "WrongPassword!")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("IDN-001"));

        Integer attempts = jdbc.queryForObject(
                "SELECT failed_attempts FROM identity_user WHERE id = ?", Integer.class, testUserId);
        assertThat(attempts).isEqualTo(1);
    }

    @Test
    void login_rateLimitKicksInAfter5Attempts() throws Exception {
        // 5 allowed, 6th should be 429
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post(LOGIN_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(buildLoginJson(TEST_EMAIL, "BadPassword!"))
                            .with(req -> { req.setRemoteAddr("10.0.0.99"); return req; }))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildLoginJson(TEST_EMAIL, "BadPassword!"))
                        .with(req -> { req.setRemoteAddr("10.0.0.99"); return req; }))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void refresh_happyPath_rotatesToken() throws Exception {
        Cookie refreshCookie = performLoginAndGetCookie();

        MvcResult result = mockMvc.perform(post(REFRESH_URL)
                        .cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();

        String newSetCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(newSetCookie).isNotNull().contains(COOKIE_NAME);

        // Old cookie value should not work again (rotation)
        mockMvc.perform(post(REFRESH_URL).cookie(refreshCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_withRevokedToken_401() throws Exception {
        Cookie refreshCookie = performLoginAndGetCookie();

        // Logout revokes the token
        mockMvc.perform(post(LOGOUT_URL).cookie(refreshCookie))
                .andExpect(status().isNoContent());

        // Now refresh should fail
        mockMvc.perform(post(REFRESH_URL).cookie(refreshCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_revokesRefreshAndClearsCookie() throws Exception {
        Cookie refreshCookie = performLoginAndGetCookie();

        MvcResult result = mockMvc.perform(post(LOGOUT_URL).cookie(refreshCookie))
                .andExpect(status().isNoContent())
                .andReturn();

        String setCookieHeader = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookieHeader).isNotNull().contains("Max-Age=0");
    }

    @Test
    void me_unauthenticated_401() throws Exception {
        mockMvc.perform(get(ME_URL))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void me_authenticated_returnsUser() throws Exception {
        String accessToken = performLoginAndGetAccessToken();

        mockMvc.perform(get(ME_URL)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.firstName").value("Youssef"))
                .andExpect(jsonPath("$.roles").isArray());
    }
}
