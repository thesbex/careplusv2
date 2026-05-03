package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integration test for the one-shot admin bootstrap endpoint.
 * See AdminBootstrapController for the full safety model.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class AdminBootstrapIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String URL = "/api/admin/bootstrap";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void emptyUserTable() {
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");
    }

    @Test
    void createsFirstAdmin_whenDbIsEmpty() throws Exception {
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@careplus.ma",
                                 "password":"Bootstrap-Pwd-1234!",
                                 "firstName":"Karim",
                                 "lastName":"El Amrani"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("admin@careplus.ma"))
                .andExpect(jsonPath("$.roles[0]").value("ADMIN"));

        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM identity_user", Integer.class);
        assertThat(count).isEqualTo(1);

        Integer roleLink = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user_role ur JOIN identity_role r ON r.id = ur.role_id WHERE r.code = 'ADMIN'",
                Integer.class);
        assertThat(roleLink).isEqualTo(1);
    }

    @Test
    void rejectsSecondCall_whenAnyUserAlreadyExists() throws Exception {
        // First call creates the admin
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@careplus.ma",
                                 "password":"Bootstrap-Pwd-1234!",
                                 "firstName":"K","lastName":"E"}
                                """))
                .andExpect(status().isCreated());

        // Second call must be refused
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"attacker@evil.ma",
                                 "password":"Attacker-Pwd-9999!",
                                 "firstName":"X","lastName":"Y"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTSTRAP_LOCKED"));

        // No attacker row created
        Integer attackerRows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user WHERE email = 'attacker@evil.ma'", Integer.class);
        assertThat(attackerRows).isZero();
    }

    @Test
    void rejectsWeakPassword() throws Exception {
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@careplus.ma",
                                 "password":"short",
                                 "firstName":"K","lastName":"E"}
                                """))
                .andExpect(status().isBadRequest());

        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM identity_user", Integer.class);
        assertThat(count).isZero();
    }

    @Test
    void rejectsInvalidEmail() throws Exception {
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email",
                                 "password":"Bootstrap-Pwd-1234!",
                                 "firstName":"K","lastName":"E"}
                                """))
                .andExpect(status().isBadRequest());
    }
}
