package ma.careplus.shared.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
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
 * GlobalExceptionHandler — branches qui transformaient des erreurs client
 * en faux 500 (audit 2026-05-01).
 *
 * SCÉNARIOS COUVERTS (chaque @Test = un cas qu'un QA manuel ferait avec curl) :
 *  1. Route inconnue authentifiée → 404 ROUTE_NOT_FOUND (pas 500).
 *  2. Route inconnue non authentifiée → 401 (Security tranche avant le dispatcher).
 *  3. @RequestParam obligatoire absent → 400 PARAM_MISSING avec le nom du
 *     paramètre dans la réponse.
 *  4. @RequestParam mal typé (UUID malformé) → 400 PARAM_INVALID.
 *  5. Verbe HTTP non supporté sur une route existante → 405 METHOD_NOT_ALLOWED.
 *  6. La 405 inclut bien la liste des verbes supportés dans le body
 *     (utile pour le client).
 *
 * REGRESSION GUARD : le 2026-05-01 le manual-qa a constaté que les 5
 * endpoints suivants retournaient 500 alors qu'ils auraient dû renvoyer
 * 404 ou 400 :
 *    GET /api/auth/me                     (route inexistante)
 *    GET /api/practitioners               (route inexistante)
 *    GET /api/catalog/tariffs             (route inexistante)
 *    GET /api/settings/tariffs            (route inexistante)
 *    GET /api/appointments                (practitionerId manquant)
 *    GET /api/availability                (practitionerId / from manquants)
 * Toute regression rendrait l'un ou l'autre de ces tests rouge.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class GlobalExceptionHandlerIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Care-Plus-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String token;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("UPDATE patient_patient SET photo_document_id = NULL");
        jdbc.update("DELETE FROM patient_document");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID id = UUID.randomUUID();
        String email = "med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(PWD), "Med", "Test",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, ROLE_MEDECIN);

        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        token = "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    @Test
    @DisplayName("1. Route inconnue authentifiée → 404 ROUTE_NOT_FOUND, pas 500")
    void unknownRouteAuthenticated_returns404() throws Exception {
        mockMvc.perform(get("/api/this-endpoint-does-not-exist").header("Authorization", token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROUTE_NOT_FOUND"))
                .andExpect(jsonPath("$.method").value("GET"));
    }

    @Test
    @DisplayName("2. Route inconnue non authentifiée → 401 (Security a la priorité)")
    void unknownRouteAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/this-endpoint-does-not-exist"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("3. @RequestParam obligatoire absent → 400 PARAM_MISSING avec nom du param")
    void missingRequiredParam_returns400() throws Exception {
        // /api/appointments exige practitionerId, from, to.
        mockMvc.perform(get("/api/appointments").header("Authorization", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_MISSING"))
                .andExpect(jsonPath("$.parameter").exists());
    }

    @Test
    @DisplayName("4. @RequestParam mal typé (UUID malformé) → 400 PARAM_INVALID")
    void typeMismatchParam_returns400() throws Exception {
        mockMvc.perform(get("/api/appointments")
                        .param("practitionerId", "not-a-uuid")
                        .param("from", "2026-05-01T00:00:00Z")
                        .param("to", "2026-05-08T00:00:00Z")
                        .header("Authorization", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_INVALID"))
                .andExpect(jsonPath("$.parameter").value("practitionerId"))
                .andExpect(jsonPath("$.expectedType").value("UUID"));
    }

    @Test
    @DisplayName("5. Verbe HTTP non supporté → 405 METHOD_NOT_ALLOWED")
    void wrongHttpMethod_returns405() throws Exception {
        // /api/patients accepte GET et POST, pas DELETE en racine.
        mockMvc.perform(delete("/api/patients").header("Authorization", token))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    @DisplayName("6. 405 retourne la liste des verbes supportés (utile pour le client)")
    void methodNotAllowed_includesSupportedVerbs() throws Exception {
        mockMvc.perform(delete("/api/patients").header("Authorization", token))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.supported").isArray());
    }
}
