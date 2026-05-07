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
 * V032 — verifies the agendaStrictIsolation toggle on
 * configuration_clinic_settings:
 * default value is FALSE, PUT can flip it true, GET reflects the new value,
 * and a subsequent PUT that omits the field leaves it untouched.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class AgendaStrictToggleIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "Agenda-Toggle-Pwd-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String adminEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        // Reset clinic settings between runs so the assertions on default = false hold.
        jdbc.update("DELETE FROM configuration_clinic_settings");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = "agenda-admin-" + UUID.randomUUID() + "@test.ma";
        UUID adminId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Admin', 'Boss', TRUE, 0, 0, now(), now())
                """, adminId, adminEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", adminId, ROLE_ADMIN);
    }

    private String bearer() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + adminEmail + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    @Test
    void defaultIsFalse_thenPutTrue_thenGetReflects_thenPutWithoutFieldPreserves() throws Exception {
        String token = bearer();

        // 1. Initial PUT to create the row WITHOUT the toggle → default false.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test Cabinet",
                                 "address":"Boulevard Mohamed V",
                                 "city":"Casablanca",
                                 "phone":"+212522000000"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agendaStrictIsolation").value(false));

        // 2. GET should reflect false
        mockMvc.perform(get("/api/settings/clinic")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agendaStrictIsolation").value(false));

        // 3. PUT with the toggle = true
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test Cabinet",
                                 "address":"Boulevard Mohamed V",
                                 "city":"Casablanca",
                                 "phone":"+212522000000",
                                 "agendaStrictIsolation":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agendaStrictIsolation").value(true));

        // 4. GET reflects the change
        mockMvc.perform(get("/api/settings/clinic")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agendaStrictIsolation").value(true));

        // 5. PUT again without the field → preserves true.
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test Cabinet 2",
                                 "address":"Avenue Hassan II",
                                 "city":"Rabat",
                                 "phone":"+212537000000"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agendaStrictIsolation").value(true));
    }
}
