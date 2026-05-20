package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * V046 — carnet personnel de confrères par médecin.
 *
 * <p>Verrouille les contrats clés du flow CRUD + l'isolation per-owner :
 * un médecin ne peut ni voir ni éditer le carnet d'un confrère.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ReferralContactIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Referral-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String medAEmail;
    private String medBEmail;
    private String secEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM identity_referral_contact");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medAEmail = seedUser("med-a", ROLE_MEDECIN);
        medBEmail = seedUser("med-b", ROLE_MEDECIN);
        secEmail = seedUser("sec", ROLE_SECRETAIRE);
    }

    @Test
    @DisplayName("Happy path CRUD : POST → 201, GET → l'expose, PUT → modifie, DELETE → 204 + retiré")
    void crud_happyPath() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Dr Hassan Cherkaoui",
                                 "specialty":"Cardiologie",
                                 "phone":"+212 5 22 47 85 20",
                                 "city":"Casablanca",
                                 "notes":"Pratique au Maarif"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fullName").value("Dr Hassan Cherkaoui"))
                .andExpect(jsonPath("$.specialty").value("Cardiologie"))
                .andReturn();
        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // List → 1
        mockMvc.perform(get("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fullName").value("Dr Hassan Cherkaoui"));

        // Update
        mockMvc.perform(put("/api/me/referrals/" + id)
                        .header("Authorization", bearer(medAEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Dr Hassan Cherkaoui",
                                 "specialty":"Cardiologie interventionnelle",
                                 "phone":"+212 5 22 47 85 20",
                                 "city":"Casablanca",
                                 "notes":"Pratique au Maarif, accepte CNOPS"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.specialty").value("Cardiologie interventionnelle"));

        // Delete
        mockMvc.perform(delete("/api/me/referrals/" + id)
                        .header("Authorization", bearer(medAEmail)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("Isolation per-owner : MedA ne voit pas le carnet de MedB et ne peut pas l'éditer")
    void perOwnerIsolation() throws Exception {
        // MedA crée un contact
        MvcResult created = mockMvc.perform(post("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Dr Owned by A","specialty":"Cardiologie"}
                                """))
                .andExpect(status().isCreated()).andReturn();
        String aContactId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // MedB liste son propre carnet → vide
        mockMvc.perform(get("/api/me/referrals")
                        .header("Authorization", bearer(medBEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // MedB tente d'éditer le contact de MedA → 404 (REFERRAL_NOT_FOUND,
        // pas 403 — on n'expose pas l'existence).
        mockMvc.perform(put("/api/me/referrals/" + aContactId)
                        .header("Authorization", bearer(medBEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"hack","specialty":"hack"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERRAL_NOT_FOUND"));

        // MedB tente de supprimer → idem 404.
        mockMvc.perform(delete("/api/me/referrals/" + aContactId)
                        .header("Authorization", bearer(medBEmail)))
                .andExpect(status().isNotFound());

        // Le contact de MedA n'a pas bougé.
        mockMvc.perform(get("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fullName").value("Dr Owned by A"));
    }

    @Test
    @DisplayName("Validation : nom et spécialité obligatoires (400 BAD_REQUEST)")
    void validationErrors() throws Exception {
        mockMvc.perform(post("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"","specialty":"Cardiologie"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Dr X","specialty":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("RBAC : Secrétaire est interdite (403)")
    void rbac_secretaireForbidden() throws Exception {
        mockMvc.perform(get("/api/me/referrals")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/me/referrals")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Dr X","specialty":"Cardiologie"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Tri serveur : alphabétique sur (spécialité, nom) — l'UI rend tel quel")
    void list_orderedBySpecialtyThenName() throws Exception {
        for (String[] c : new String[][] {
                { "Dr Zaki", "Cardiologie" },
                { "Dr Adil", "Cardiologie" },
                { "Dr Brahim", "Pneumologie" },
        }) {
            mockMvc.perform(post("/api/me/referrals")
                            .header("Authorization", bearer(medAEmail))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"fullName":"%s","specialty":"%s"}
                                    """.formatted(c[0], c[1])))
                    .andExpect(status().isCreated());
        }

        MvcResult r = mockMvc.perform(get("/api/me/referrals")
                        .header("Authorization", bearer(medAEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andReturn();

        var arr = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(arr.get(0).get("fullName").asText()).isEqualTo("Dr Adil");
        assertThat(arr.get(0).get("specialty").asText()).isEqualTo("Cardiologie");
        assertThat(arr.get(1).get("fullName").asText()).isEqualTo("Dr Zaki");
        assertThat(arr.get(2).get("fullName").asText()).isEqualTo("Dr Brahim");
        assertThat(arr.get(2).get("specialty").asText()).isEqualTo("Pneumologie");
    }

    // ---------- helpers ----------

    private String seedUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(PWD), prefix, "Test",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }
}
