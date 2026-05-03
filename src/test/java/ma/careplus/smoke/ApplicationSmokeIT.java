package ma.careplus.smoke;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * J1 smoke test. Proves: Spring context loads, Postgres starts, Flyway migrations apply,
 * reference data is seeded, actuator health is public and green.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ApplicationSmokeIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus")
            .withUsername("test")
            .withPassword("test");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DataSource dataSource;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void context_loads_and_postgres_is_connected() {
        assertThat(dataSource).isNotNull();
    }

    @Test
    void health_endpoint_is_public_and_up() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void openapi_docs_are_reachable() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("careplus API"));
    }

    @Test
    void flyway_has_applied_baseline_and_reference_migrations() {
        Integer migrations = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = TRUE", Integer.class);
        assertThat(migrations).isNotNull().isGreaterThanOrEqualTo(2);
    }

    @Test
    void four_roles_are_seeded() {
        Integer roleCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_role", Integer.class);
        assertThat(roleCount).isEqualTo(4);
    }

    @Test
    void moroccan_holidays_seeded() {
        Integer holidays = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_holiday WHERE EXTRACT(YEAR FROM date) = 2026", Integer.class);
        assertThat(holidays).isNotNull().isGreaterThanOrEqualTo(10);
    }

    @Test
    void default_document_templates_seeded() {
        Integer templates = jdbc.queryForObject(
                "SELECT COUNT(*) FROM configuration_document_template", Integer.class);
        assertThat(templates).isNotNull().isGreaterThanOrEqualTo(5);
    }

    @Test
    void invoice_sequence_initialized_for_current_year() {
        Integer currentYear = java.time.LocalDate.now(java.time.ZoneId.of("Africa/Casablanca")).getYear();
        Long nextValue = jdbc.queryForObject(
                "SELECT next_value FROM billing_invoice_sequence WHERE year = ?", Long.class, currentYear);
        assertThat(nextValue).isEqualTo(1L);
    }
}
