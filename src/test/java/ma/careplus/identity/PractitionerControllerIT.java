package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
 * V032 — verifies the read-only practitioner directory endpoint.
 *
 * <p>Order matters in two scenarios so we control test data via JDBC seed
 * (one disabled MEDECIN, one SECRETAIRE, multiple active MEDECIN with
 * deterministic last names).
 *
 * <p>Note: specialty literals use {@code \\u00e9} escape sequences instead of
 * direct accented characters so the assertion holds regardless of the source
 * file encoding the maven-compiler-plugin picks up on Windows hosts.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PractitionerControllerIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String URL = "/api/practitioners";
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Pract-Pwd-2026!";

    /** "Pédiatre" — written with unicode escape so the bytecode literal is unambiguous
     *  even if maven-compiler-plugin reads the source as Latin-1 instead of UTF-8 on Windows. */
    private static final String SPECIALTY_PEDIATRE = "Pédiatre";
    private static final String SPECIALTY_CARDIO = "Cardiologue";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String secEmail;

    @BeforeEach
    void wipe() {
        rateLimitFilter.clearBucketsForTests();
        // Strict tear-down: PractitionerControllerIT seeds only what it needs and asserts
        // exact list shape, so any leftover MEDECIN from another test would corrupt asserts.
        jdbc.update("DELETE FROM identity_user_assignment");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Seed a SECRETAIRE used to authenticate read calls (any auth role works)
        secEmail = "pract-sec-" + UUID.randomUUID() + "@test.ma";
        UUID secId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Secret', 'Aire', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", secId, ROLE_SECRETAIRE);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private UUID seedMedecin(String firstName, String lastName, String specialty, boolean enabled) {
        UUID id = UUID.randomUUID();
        String email = "doc-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name, specialty,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD), firstName, lastName, specialty, enabled);
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", id, ROLE_MEDECIN);
        return id;
    }

    @Test
    void emptyCase_returnsEmptyArray() throws Exception {
        // No MEDECIN exists — only the seeded SECRETAIRE
        String token = bearer(secEmail);
        mockMvc.perform(get(URL).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void returnsActiveMedecinsOrderedByLastNameThenFirstName() throws Exception {
        // Seed: 2 active MEDECIN + 1 SECRETAIRE (already done) + 1 inactive MEDECIN
        UUID karim = seedMedecin("Karim", "Zahidi", SPECIALTY_PEDIATRE, true);
        UUID amina = seedMedecin("Amina", "Bennani", SPECIALTY_CARDIO, true);
        seedMedecin("Hicham", "Doukkali", "Inactif", false); // disabled — must NOT appear

        String token = bearer(secEmail);
        MvcResult r = mockMvc.perform(get(URL).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andReturn();

        // Force UTF-8 read so we don't depend on the response charset header,
        // which Spring may omit for application/json on certain configurations.
        String responseBody = new String(r.getResponse().getContentAsByteArray(),
                java.nio.charset.StandardCharsets.UTF_8);
        JsonNode arr = objectMapper.readTree(responseBody);
        // Bennani < Zahidi alphabetically — Amina first
        assertThat(arr.get(0).get("id").asText()).isEqualTo(amina.toString());
        assertThat(arr.get(0).get("firstName").asText()).isEqualTo("Amina");
        assertThat(arr.get(0).get("lastName").asText()).isEqualTo("Bennani");
        assertThat(arr.get(0).get("specialty").asText()).isEqualTo(SPECIALTY_CARDIO);
        assertThat(arr.get(0).get("active").asBoolean()).isTrue();
        assertThat(arr.get(1).get("id").asText()).isEqualTo(karim.toString());
        assertThat(arr.get(1).get("specialty").asText()).isEqualTo(SPECIALTY_PEDIATRE);
    }

    @Test
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }
}
