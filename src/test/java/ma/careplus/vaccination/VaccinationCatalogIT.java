package ma.careplus.vaccination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * Integration tests for Vaccination module — Étape 1: schema + referential.
 *
 * Scenarios:
 * 1. Migration applied — tables exist
 * 2. Seed PNI applied — ≥12 vaccines + ≥25 schedule rows
 * 3. patient_patient.vaccination_started_at column exists
 * 4. CRUD catalog happy path — POST/GET/PUT/DELETE custom vaccine
 * 5. PNI read-only — DELETE on is_pni=TRUE → 422
 * 6. CRUD schedule happy path — POST/PUT/DELETE
 * 7. UNIQUE(vaccine_id, dose_number) — POST 2x same → 409
 * 8. RBAC — SECRETAIRE → 403 on mutations, 200 on GET
 * 9. RBAC — ASSISTANT → 403 on mutations
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class VaccinationCatalogIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "VaccTest-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    String asstEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up test users only (keep PNI seed rows)
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'vacc-test-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'vacc-test-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'vacc-test-%'");

        // Clean up test vaccine catalog rows (keep PNI seed rows with fixed UUIDs starting a0000001)
        // Cast UUID to text for LIKE comparison
        jdbc.update("DELETE FROM vaccine_schedule_dose WHERE id::text NOT LIKE 'b0000001-%'");
        jdbc.update("DELETE FROM vaccine_catalog WHERE id::text NOT LIKE 'a0000001-%'");

        medEmail  = seedUser("med",  ROLE_MEDECIN);
        secEmail  = seedUser("sec",  ROLE_SECRETAIRE);
        asstEmail = seedUser("asst", ROLE_ASSISTANT);
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "vacc-test-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'User', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                userId, roleId);
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

    // ── Scenario 1: Migration applied — tables exist ─────────────────────────

    @Test
    void migration_tablesExist() {
        // vaccine_catalog
        Integer catalogCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema='public' AND table_name='vaccine_catalog'",
                Integer.class);
        assertThat(catalogCount).isEqualTo(1);

        // vaccine_schedule_dose
        Integer scheduleCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema='public' AND table_name='vaccine_schedule_dose'",
                Integer.class);
        assertThat(scheduleCount).isEqualTo(1);

        // vaccination_dose
        Integer doseCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema='public' AND table_name='vaccination_dose'",
                Integer.class);
        assertThat(doseCount).isEqualTo(1);
    }

    // ── Scenario 2: Seed PNI applied ─────────────────────────────────────────

    @Test
    void seed_pniVaccinesAndScheduleRows() {
        // We seed 12 PNI vaccines
        Integer pniCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM vaccine_catalog WHERE is_pni = TRUE",
                Integer.class);
        assertThat(pniCount).isGreaterThanOrEqualTo(12);

        Integer scheduleCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM vaccine_schedule_dose",
                Integer.class);
        assertThat(scheduleCount).isGreaterThanOrEqualTo(25);
    }

    // ── Scenario 3: patient_patient.vaccination_started_at column ────────────

    @Test
    void migration_patientColumnAdded() {
        Integer colCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                + "WHERE table_schema='public' "
                + "AND table_name='patient_patient' "
                + "AND column_name='vaccination_started_at'",
                Integer.class);
        assertThat(colCount).isEqualTo(1);
    }

    // ── Scenario 4: CRUD catalog happy path ──────────────────────────────────

    @Test
    void catalog_crudHappyPath() throws Exception {
        String token = bearer(medEmail);

        // POST — create Méningo ACWY (custom, not PNI)
        String body = """
                {
                  "code": "MENING",
                  "nameFr": "Méningocoque ACWY",
                  "manufacturerDefault": "GSK",
                  "routeDefault": "IM",
                  "isPni": false
                }
                """;

        MvcResult createResult = mockMvc.perform(post("/api/vaccinations/catalog")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("MENING"))
                .andExpect(jsonPath("$.nameFr").value("Méningocoque ACWY"))
                .andExpect(jsonPath("$.isPni").value(false))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();

        String id = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        // GET — list includes the new vaccine
        mockMvc.perform(get("/api/vaccinations/catalog")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code=='MENING')]").exists());

        // PUT — update name
        String updateBody = """
                {
                  "code": "MENING",
                  "nameFr": "Méningocoque ACWY (Menveo)",
                  "manufacturerDefault": "GSK",
                  "routeDefault": "IM",
                  "isPni": false
                }
                """;
        mockMvc.perform(put("/api/vaccinations/catalog/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nameFr").value("Méningocoque ACWY (Menveo)"));

        // DELETE (soft deactivate) — 204, then active=FALSE in DB
        mockMvc.perform(delete("/api/vaccinations/catalog/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        Integer active = jdbc.queryForObject(
                "SELECT active::int FROM vaccine_catalog WHERE id = ?::uuid",
                Integer.class, id);
        assertThat(active).isEqualTo(0);
        // Row still exists (soft delete)
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM vaccine_catalog WHERE id = ?::uuid",
                Integer.class, id);
        assertThat(count).isEqualTo(1);
    }

    // ── Scenario 5: PNI read-only — DELETE → 422 ─────────────────────────────

    @Test
    void catalog_pniDeleteReturns422() throws Exception {
        String token = bearer(medEmail);

        // Find BCG (the first seeded PNI vaccine)
        String bcgId = jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'BCG'",
                String.class);
        assertThat(bcgId).isNotNull();

        mockMvc.perform(delete("/api/vaccinations/catalog/" + bcgId)
                        .header("Authorization", token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PNI_PROTECTED"));

        // Row must still be active
        Integer active = jdbc.queryForObject(
                "SELECT active::int FROM vaccine_catalog WHERE id = ?::uuid",
                Integer.class, bcgId);
        assertThat(active).isEqualTo(1);
    }

    // ── Scenario 6: CRUD schedule happy path ─────────────────────────────────

    @Test
    void schedule_crudHappyPath() throws Exception {
        String token = bearer(medEmail);

        // Get an existing non-PNI vaccine or create one for schedule tests
        // Use HEPA (HepA, is_pni=FALSE, seeded with fixed UUID)
        String hepaId = jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'HEPA'",
                String.class);
        assertThat(hepaId).isNotNull();

        // POST — create a new schedule dose
        String body = String.format("""
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "targetAgeDays": 365,
                  "toleranceDays": 30,
                  "labelFr": "HepA D1 — 12 mois"
                }
                """, hepaId);

        MvcResult createResult = mockMvc.perform(post("/api/vaccinations/schedule")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.vaccineId").value(hepaId))
                .andExpect(jsonPath("$.doseNumber").value(1))
                .andExpect(jsonPath("$.targetAgeDays").value(365))
                .andReturn();

        String schedId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        // PUT — update target_age_days
        String updateBody = String.format("""
                {
                  "vaccineId": "%s",
                  "doseNumber": 1,
                  "targetAgeDays": 395,
                  "toleranceDays": 30,
                  "labelFr": "HepA D1 — 13 mois (mis à jour)"
                }
                """, hepaId);
        mockMvc.perform(put("/api/vaccinations/schedule/" + schedId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetAgeDays").value(395));

        // DELETE — 204, row gone
        mockMvc.perform(delete("/api/vaccinations/schedule/" + schedId)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM vaccine_schedule_dose WHERE id = ?::uuid",
                Integer.class, schedId);
        assertThat(count).isEqualTo(0);
    }

    // ── Scenario 7: UNIQUE(vaccine_id, dose_number) → 409 ───────────────────

    @Test
    void schedule_duplicateVaccineAndDose_returns409() throws Exception {
        String token = bearer(medEmail);

        // Use HEPA vaccine for duplicate test
        String hepaId = jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'HEPA'",
                String.class);
        assertThat(hepaId).isNotNull();

        String body = String.format("""
                {
                  "vaccineId": "%s",
                  "doseNumber": 2,
                  "targetAgeDays": 540,
                  "toleranceDays": 30,
                  "labelFr": "HepA D2 — 18 mois"
                }
                """, hepaId);

        // First insert — should succeed
        mockMvc.perform(post("/api/vaccinations/schedule")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        // Second insert — same vaccine + dose_number → 409
        mockMvc.perform(post("/api/vaccinations/schedule")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    // ── Scenario 8: RBAC — SECRETAIRE mutations → 403, GET → 200 ────────────

    @Test
    void rbac_secretaire_mutationsBlocked_getAllowed() throws Exception {
        String secToken = bearer(secEmail);

        // GET catalog — 200
        mockMvc.perform(get("/api/vaccinations/catalog")
                        .header("Authorization", secToken))
                .andExpect(status().isOk());

        // GET schedule — 200
        mockMvc.perform(get("/api/vaccinations/schedule")
                        .header("Authorization", secToken))
                .andExpect(status().isOk());

        String postBody = """
                {
                  "code": "SEC_TEST",
                  "nameFr": "Test secrétaire",
                  "routeDefault": "IM",
                  "isPni": false
                }
                """;

        // POST catalog — 403
        mockMvc.perform(post("/api/vaccinations/catalog")
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(postBody))
                .andExpect(status().isForbidden());

        // PUT catalog — 403 (use BCG id which exists)
        String bcgId = jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'BCG'",
                String.class);
        mockMvc.perform(put("/api/vaccinations/catalog/" + bcgId)
                        .header("Authorization", secToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(postBody))
                .andExpect(status().isForbidden());

        // DELETE catalog — 403
        mockMvc.perform(delete("/api/vaccinations/catalog/" + bcgId)
                        .header("Authorization", secToken))
                .andExpect(status().isForbidden());
    }

    // ── Scenario 9: RBAC — ASSISTANT mutations → 403 ─────────────────────────

    @Test
    void rbac_assistant_catalogMutationsBlocked() throws Exception {
        String asstToken = bearer(asstEmail);

        // GET schedule — 200 (read allowed)
        mockMvc.perform(get("/api/vaccinations/schedule")
                        .header("Authorization", asstToken))
                .andExpect(status().isOk());

        String postBody = """
                {
                  "code": "ASST_TEST",
                  "nameFr": "Test assistant",
                  "routeDefault": "IM",
                  "isPni": false
                }
                """;

        // POST catalog — 403 (only MEDECIN/ADMIN can edit referential)
        mockMvc.perform(post("/api/vaccinations/catalog")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(postBody))
                .andExpect(status().isForbidden());

        // POST schedule — 403
        String bcgId = jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'BCG'",
                String.class);
        String schedBody = String.format("""
                {
                  "vaccineId": "%s",
                  "doseNumber": 99,
                  "targetAgeDays": 9999,
                  "toleranceDays": 30,
                  "labelFr": "Test"
                }
                """, bcgId);

        mockMvc.perform(post("/api/vaccinations/schedule")
                        .header("Authorization", asstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(schedBody))
                .andExpect(status().isForbidden());
    }
}
