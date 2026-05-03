package ma.careplus.patient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
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
 * Integration tests for the patient module:
 *   POST /api/patients
 *   GET  /api/patients/{id}
 *   GET  /api/patients?q=...
 *   PUT  /api/patients/{id}
 *   DELETE /api/patients/{id}  (soft delete)
 *   POST /api/patients/{id}/allergies
 *   POST /api/patients/{id}/antecedents  (with category)
 *   POST /api/patients/{id}/notes        (MEDECIN only)
 *   GET  /api/patients/{id}/notes
 *   PUT  /api/patients/{id}/tier
 *   PUT  /api/patients/{id}/mutuelle
 *
 * Seeds a MEDECIN and a SECRETAIRE to exercise the role matrix, plus an
 * ASSISTANT to verify read-only access.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PatientIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");

    private static final String PWD = "Care-Plus-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail;
    String medEmail;
    String asstEmail;
    /** Token cache: reuse JWT within a single test to stay within the 5-login rate limit. */
    final Map<String, String> tokenCache = new HashMap<>();

    @BeforeEach
    void seed() {
        tokenCache.clear();
        rateLimitFilter.clearBucketsForTests();
        // wipe patient data
        jdbc.update("DELETE FROM patient_note");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM patient_antecedent");
        jdbc.update("DELETE FROM patient_patient");
        // wipe user data
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        medEmail  = seedUser("med",  ROLE_MEDECIN);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

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

    private String tokenFor(String email) throws Exception {
        if (tokenCache.containsKey(email)) {
            return tokenCache.get(email);
        }
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String token = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
        tokenCache.put(email, token);
        return token;
    }

    private String bearer(String email) throws Exception {
        return "Bearer " + tokenFor(email);
    }

    // ── Existing tests (unchanged) ─────────────────────────────────

    @Test
    void secretaire_canCreateAndFetchPatient() throws Exception {
        String body = """
                {"firstName":"Fatima Zahra","lastName":"Lahlou",
                 "gender":"F","birthDate":"1994-03-15",
                 "cin":"BE123456","phone":"+212600111222","city":"Casablanca"}
                """;
        MvcResult created = mockMvc.perform(post("/api/patients")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.firstName").value("Fatima Zahra"))
                .andExpect(jsonPath("$.lastName").value("Lahlou"))
                .andExpect(jsonPath("$.status").value("ACTIF"))
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cin").value("BE123456"))
                .andExpect(jsonPath("$.allergies").isArray())
                .andExpect(jsonPath("$.antecedents").isArray());
    }

    @Test
    void duplicateCin_returns409() throws Exception {
        String body = """
                {"firstName":"Omar","lastName":"Idrissi","cin":"CIN-DUP"}
                """;
        mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PATIENT_CIN_DUPLICATE"));
    }

    @Test
    void assistant_hasFullAccess() throws Exception {
        // Per V010 the ASSISTANT role has parity with MEDECIN — can create + read.
        mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(asstEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Xavier\",\"lastName\":\"Yassine\"}"))
                .andExpect(status().isCreated());

        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Ahmed\",\"lastName\":\"Cherkaoui\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(asstEmail)))
                .andExpect(status().isOk());
    }

    @Test
    void unauthenticated_isRejected() throws Exception {
        mockMvc.perform(get("/api/patients"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void search_findsByFirstNameLastNameCinPhone() throws Exception {
        // Seed 3 patients
        for (String body : new String[] {
                "{\"firstName\":\"Fatima\",\"lastName\":\"Lahlou\",\"cin\":\"CIN001\",\"phone\":\"0611111111\"}",
                "{\"firstName\":\"Omar\",\"lastName\":\"Idrissi\",\"cin\":\"CIN002\",\"phone\":\"0622222222\"}",
                "{\"firstName\":\"Walid\",\"lastName\":\"Kadiri\",\"cin\":\"CIN003\",\"phone\":\"0633333333\"}",
        }) {
            mockMvc.perform(post("/api/patients")
                    .header("Authorization", bearer(secEmail))
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isCreated());
        }

        // Search by last name fragment
        mockMvc.perform(get("/api/patients?q=Lahlou").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].lastName").value("Lahlou"))
                .andExpect(jsonPath("$.content.length()").value(1));

        // Search by CIN
        mockMvc.perform(get("/api/patients?q=CIN002").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].firstName").value("Omar"));

        // Search by phone fragment
        mockMvc.perform(get("/api/patients?q=0633").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].firstName").value("Walid"));

        // No filter returns all
        mockMvc.perform(get("/api/patients").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(3));
    }

    @Test
    void update_changesFields() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Pre\",\"lastName\":\"Update\",\"phone\":\"0600000000\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(put("/api/patients/" + id)
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"0611223344\",\"profession\":\"Médecin\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("0611223344"))
                .andExpect(jsonPath("$.profession").value("Médecin"))
                .andExpect(jsonPath("$.firstName").value("Pre"));  // unchanged
    }

    @Test
    void softDelete_hidesFromSearch_andOnlyMedecinOrAdminCanDo() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Soft\",\"lastName\":\"Delete\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // SECRETAIRE cannot delete
        mockMvc.perform(delete("/api/patients/" + id).header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());

        // MEDECIN can
        mockMvc.perform(delete("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(status().isNoContent());

        // Soft-deleted patient invisible to GET
        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound());

        // and absent from search listing
        mockMvc.perform(get("/api/patients").header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));

        // deleted_at set in the DB
        Integer deletedCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_patient WHERE id = ?::uuid AND deleted_at IS NOT NULL",
                Integer.class, id);
        assertThat(deletedCount).isEqualTo(1);
    }

    @Test
    void addAllergy_thenReturnedInView() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Ahmed\",\"lastName\":\"Cherkaoui\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/patients/" + id + "/allergies")
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"substance\":\"Pénicilline\",\"severity\":\"SEVERE\",\"atcTag\":\"J01CA\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.substance").value("Pénicilline"))
                .andExpect(jsonPath("$.severity").value("SEVERE"));

        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(jsonPath("$.allergies[0].substance").value("Pénicilline"));
    }

    @Test
    void addAntecedent_thenReturnedInView() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Mohamed\",\"lastName\":\"Alami\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/patients/" + id + "/antecedents")
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type":"MEDICAL",
                         "description":"Hypertension artérielle depuis 2020",
                         "occurredOn":"2020-05-12"}
                        """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(jsonPath("$.antecedents[0].type").value("MEDICAL"))
                .andExpect(jsonPath("$.antecedents[0].description")
                        .value("Hypertension artérielle depuis 2020"));
    }

    @Test
    void getNonexistentPatient_returns404() throws Exception {
        mockMvc.perform(get("/api/patients/" + UUID.randomUUID())
                .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PATIENT_NOT_FOUND"));
    }

    // ── New tests (ADR-023) ────────────────────────────────────────

    @Test
    void addAntecedent_withCategory_categoryReturnedInResponse() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Khalid\",\"lastName\":\"Benali\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/patients/" + id + "/antecedents")
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type":"MEDICAL",
                         "description":"Diabète type 2",
                         "category":"PERSONNEL_MALADIES_CHRONIQUES"}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("PERSONNEL_MALADIES_CHRONIQUES"));

        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(jsonPath("$.antecedents[0].category").value("PERSONNEL_MALADIES_CHRONIQUES"));
    }

    @Test
    void createNote_asMedecin_thenListedInGetNotes() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Sara\",\"lastName\":\"Haddad\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/patients/" + id + "/notes")
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Patient à surveiller — tension élevée\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("Patient à surveiller — tension élevée"))
                .andExpect(jsonPath("$.createdByName").isNotEmpty());

        mockMvc.perform(get("/api/patients/" + id + "/notes")
                .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].content").value("Patient à surveiller — tension élevée"));
    }

    @Test
    void createNote_asSecretaire_returns403() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Nadia\",\"lastName\":\"Tazi\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // SECRETAIRE cannot create notes — clinical content stays MEDECIN/ASSISTANT.
        mockMvc.perform(post("/api/patients/" + id + "/notes")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Tentative non autorisée\"}"))
                .andExpect(status().isForbidden());

        // ASSISTANT now has parity with MEDECIN (V010) — can create notes.
        mockMvc.perform(post("/api/patients/" + id + "/notes")
                .header("Authorization", bearer(asstEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Note prise par l'assistante\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void updateTier_toPremium_confirmedViaGet() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Amine\",\"lastName\":\"Berrada\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // Default tier is NORMAL
        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(jsonPath("$.tier").value("NORMAL"));

        // Update to PREMIUM
        mockMvc.perform(put("/api/patients/" + id + "/tier")
                .header("Authorization", bearer(medEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tier\":\"PREMIUM\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tier").value("PREMIUM"));

        // Confirm via GET
        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(jsonPath("$.tier").value("PREMIUM"));
    }

    @Test
    void updateMutuelle_reflectsInPatientView() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Youssef\",\"lastName\":\"Ouali\"}"))
                .andReturn();
        String id = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();

        // Fetch a known insurance from the seed data
        UUID insuranceId = jdbc.queryForObject(
                "SELECT id FROM catalog_insurance LIMIT 1",
                UUID.class);
        assertThat(insuranceId).isNotNull();

        String body = String.format(
                "{\"insuranceId\":\"%s\",\"policyNumber\":\"POLICY-2026-001\"}", insuranceId);

        mockMvc.perform(put("/api/patients/" + id + "/mutuelle")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mutuelleInsuranceId").value(insuranceId.toString()))
                .andExpect(jsonPath("$.mutuellePoliceNumber").value("POLICY-2026-001"));

        // Confirm via GET
        mockMvc.perform(get("/api/patients/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(jsonPath("$.mutuelleInsuranceId").value(insuranceId.toString()))
                .andExpect(jsonPath("$.mutuellePoliceNumber").value("POLICY-2026-001"));
    }
}
