package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
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
 * Integration tests for POST /api/admin/users.
 * Seeds an admin and a secretaire to cover the role-based access check.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class AdminUserIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String URL = "/api/admin/users";
    private static final String LOGIN_URL = "/api/auth/login";
    private static final String ADMIN_PASSWORD = "Admin-Pwd-Seed-2026!";
    private static final String SECRETAIRE_PASSWORD = "Sec-Pwd-Seed-2026!";

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000004");

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String adminEmail;
    private String secretaireEmail;

    @BeforeEach
    void seedUsers() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = "admin-" + UUID.randomUUID() + "@test.ma";
        secretaireEmail = "sec-" + UUID.randomUUID() + "@test.ma";

        UUID adminId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                adminId, adminEmail, passwordEncoder.encode(ADMIN_PASSWORD),
                "Admin", "Seed", OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", adminId, ROLE_ADMIN);

        UUID secId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                secId, secretaireEmail, passwordEncoder.encode(SECRETAIRE_PASSWORD),
                "Sec", "Seed", OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", secId, ROLE_SECRETAIRE);
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

    @Test
    void adminCanCreateUser() throws Exception {
        String token = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);

        mockMvc.perform(post(URL)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"new.medecin@test.ma",
                                 "password":"Brand-New-Pwd-2026!",
                                 "firstName":"Karim",
                                 "lastName":"El Amrani",
                                 "phone":"+212600000001",
                                 "roles":["MEDECIN"]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("new.medecin@test.ma"))
                .andExpect(jsonPath("$.roles[0]").value("MEDECIN"));

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user WHERE email = 'new.medecin@test.ma'",
                Integer.class);
        assertThat(count).isEqualTo(1);
    }

    @Test
    void adminCanCreateUserWithMultipleRoles() throws Exception {
        String token = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);

        mockMvc.perform(post(URL)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"multi@test.ma",
                                 "password":"Multi-Role-Pwd-2026!",
                                 "firstName":"Multi",
                                 "lastName":"Role",
                                 "roles":["MEDECIN","ADMIN"]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roles.length()").value(2));

        Integer roleLinks = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user_role ur JOIN identity_user u ON u.id = ur.user_id WHERE u.email = 'multi@test.ma'",
                Integer.class);
        assertThat(roleLinks).isEqualTo(2);
    }

    @Test
    void secretaireCannotCreateUser() throws Exception {
        String token = loginAndGetAccessToken(secretaireEmail, SECRETAIRE_PASSWORD);

        mockMvc.perform(post(URL)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"hack@test.ma",
                                 "password":"Pwd-Attempt-2026!",
                                 "firstName":"H","lastName":"A",
                                 "roles":["ADMIN"]}
                                """))
                .andExpect(status().isForbidden());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user WHERE email = 'hack@test.ma'", Integer.class);
        assertThat(count).isZero();
    }

    @Test
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"anon@test.ma",
                                 "password":"Pwd-Anon-2026!",
                                 "firstName":"A","lastName":"N",
                                 "roles":["MEDECIN"]}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        String token = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);
        String dup = """
                {"email":"%s",
                 "password":"Fresh-Pwd-2026!",
                 "firstName":"Dup","lastName":"Test",
                 "roles":["MEDECIN"]}
                """.formatted(adminEmail);
        mockMvc.perform(post(URL)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dup))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
    }

    @Test
    void unknownRoleReturns400() throws Exception {
        String token = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);
        mockMvc.perform(post(URL)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"bad.role@test.ma",
                                 "password":"Ok-Pwd-2026!",
                                 "firstName":"B","lastName":"R",
                                 "roles":["WIZARD"]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ROLE"));
    }

    @Test
    void weakPasswordReturns400() throws Exception {
        String token = loginAndGetAccessToken(adminEmail, ADMIN_PASSWORD);
        mockMvc.perform(post(URL)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"weak@test.ma",
                                 "password":"short",
                                 "firstName":"W","lastName":"E",
                                 "roles":["MEDECIN"]}
                                """))
                .andExpect(status().isBadRequest());
    }
}
