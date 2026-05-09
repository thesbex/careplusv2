package ma.careplus.vaccination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
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
 * Integration tests — V036 cloisonnement de la queue Vaccination.
 *
 * Sibling de la walk Playwright manuelle 2026-05-09 (filtre médecin sur la
 * queue Vaccination quand le toggle V032 est activé). Pour chaque scénario,
 * on flippe directement {@code configuration_clinic_settings} via JDBC car
 * il n'existe pas (encore) d'endpoint qui touche uniquement
 * {@code vaccinationOrphanVisibleRoles}.
 *
 * <p>Scénarios :
 * <ol>
 *   <li>Cloisonnement OFF → MEDECIN voit tous les patients pédiatriques (orphelins inclus).</li>
 *   <li>Cloisonnement ON, MEDECIN ∈ orphan_visible_roles → MEDECIN voit les orphelins.</li>
 *   <li>Cloisonnement ON, MEDECIN ∉ orphan_visible_roles → MEDECIN ne voit aucun orphelin.</li>
 *   <li>Cloisonnement ON, patient rattaché à Dr A via {@code administered_by} → Dr A le voit.</li>
 *   <li>Cloisonnement ON, patient rattaché à Dr A → Dr B (autre MEDECIN) ne le voit PAS.</li>
 *   <li>Cloisonnement ON, ADMIN bypass scope → voit tout.</li>
 *   <li>Cloisonnement ON, rattachement via {@code created_by} (pas administered) suffit.</li>
 *   <li>Cloisonnement ON + un seul MEDECIN actif → bypass (pas de scope).</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class VaccinationQueueIsolationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "IsoIT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medAId;     // Dr A (MEDECIN)
    UUID medBId;     // Dr B (MEDECIN)
    UUID adminId;    // ADMIN
    String medAEmail;
    String medBEmail;
    String adminEmail;

    @BeforeEach
    void setup() {
        rateLimitFilter.clearBucketsForTests();

        // Clean slate per test : isoit-* users + IsoIT-* patients + their doses.
        jdbc.update("DELETE FROM vaccination_dose WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'IsoIT-%')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name LIKE 'IsoIT-%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'isoit-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'isoit-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'isoit-%'");

        // Reset settings to default OFF + tous rôles → comportement historique.
        // chaque @Test appellera enableIsolation() / setOrphanRoles(...) si besoin.
        jdbc.update(
                "UPDATE configuration_clinic_settings SET agenda_strict_isolation = FALSE, "
                        + "vaccination_orphan_visible_roles = ARRAY['MEDECIN','ADMIN','SECRETAIRE','ASSISTANT']::VARCHAR[]");

        medAId = UUID.randomUUID();
        medBId = UUID.randomUUID();
        adminId = UUID.randomUUID();
        medAEmail = seedUser(medAId, "isoit-meda", ROLE_MEDECIN);
        medBEmail = seedUser(medBId, "isoit-medb", ROLE_MEDECIN);
        adminEmail = seedUser(adminId, "isoit-admin", ROLE_ADMIN);
    }

    private String seedUser(UUID userId, String prefix, UUID roleId) {
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'IsoIT', TRUE, 0, 0, now(), now())
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

    private UUID createChild(LocalDate birthDate) {
        UUID id = UUID.randomUUID();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        java.sql.Date sqlDate = java.sql.Date.valueOf(birthDate);
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, birth_date, status,
                     tier, number_children, version, created_at, updated_at)
                VALUES (?, ?, ?, 'M', ?, 'ACTIF', 'NORMAL', 0, 0, now(), now())
                """, id, "IsoIT-" + suffix, "Bébé", sqlDate);
        return id;
    }

    private void enableIsolation() {
        jdbc.update("UPDATE configuration_clinic_settings SET agenda_strict_isolation = TRUE");
    }

    private void setOrphanRoles(String... roles) {
        jdbc.update("UPDATE configuration_clinic_settings SET vaccination_orphan_visible_roles = ?",
                (Object) roles);
    }

    /**
     * Inserts a vaccination_dose row tying a patient to a practitioner via
     * administered_by (or created_by if {@code administered = false}).
     * BCG dose 1 by convention — the catalog row exists post-V022 reference seeds.
     */
    private void attachPatientToDoctor(UUID patientId, UUID doctorId, boolean administered) {
        UUID bcgId = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM vaccine_catalog WHERE code = 'BCG'", String.class));
        UUID schedId = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM vaccine_schedule_dose WHERE vaccine_id = ? AND dose_number = 1",
                String.class, bcgId));
        UUID doseId = UUID.randomUUID();
        if (administered) {
            jdbc.update("""
                    INSERT INTO vaccination_dose
                        (id, patient_id, schedule_dose_id, vaccine_id, dose_number, status,
                         administered_at, administered_by, version, created_at, updated_at, created_by)
                    VALUES (?, ?, ?, ?, 1, 'ADMINISTERED', ?, ?, 0, now(), now(), ?)
                    """, doseId, patientId, schedId, bcgId,
                    OffsetDateTime.now().minusHours(1), doctorId, doctorId);
        } else {
            // PLANNED dose : créée par le doctor mais jamais administrée.
            jdbc.update("""
                    INSERT INTO vaccination_dose
                        (id, patient_id, schedule_dose_id, vaccine_id, dose_number, status,
                         version, created_at, updated_at, created_by)
                    VALUES (?, ?, ?, ?, 2, 'PLANNED', 0, now(), now(), ?)
                    """, doseId, patientId, schedId, bcgId, doctorId);
        }
    }

    private List<String> queuePatientIds(String token) throws Exception {
        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode content = objectMapper.readTree(r.getResponse().getContentAsString()).get("content");
        List<String> ids = new ArrayList<>();
        for (JsonNode e : content) ids.add(e.get("patientId").asText());
        return ids;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s1 — Cloisonnement OFF : MEDECIN voit les 3 patients (comportement historique)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s1_isolationOff_medecinSeesAllOrphans() throws Exception {
        UUID p1 = createChild(LocalDate.now().minusMonths(8));
        UUID p2 = createChild(LocalDate.now().minusMonths(8));
        UUID p3 = createChild(LocalDate.now().minusMonths(8));

        List<String> ids = queuePatientIds(bearer(medAEmail));
        assertThat(ids).contains(p1.toString(), p2.toString(), p3.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s2 — Cloisonnement ON, MEDECIN ∈ orphan_visible_roles → voit les orphelins
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s2_isolationOn_medecinInOrphanRoles_seesOrphans() throws Exception {
        UUID p1 = createChild(LocalDate.now().minusMonths(8));
        UUID p2 = createChild(LocalDate.now().minusMonths(8));
        enableIsolation();
        setOrphanRoles("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT");

        List<String> ids = queuePatientIds(bearer(medAEmail));
        assertThat(ids).contains(p1.toString(), p2.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s3 — Cloisonnement ON, MEDECIN ∉ orphan_visible_roles → ne voit aucun orphelin
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s3_isolationOn_medecinNotInOrphanRoles_seesNothing() throws Exception {
        UUID p1 = createChild(LocalDate.now().minusMonths(8));
        UUID p2 = createChild(LocalDate.now().minusMonths(8));
        enableIsolation();
        setOrphanRoles("ADMIN", "SECRETAIRE", "ASSISTANT"); // pas MEDECIN

        List<String> ids = queuePatientIds(bearer(medAEmail));
        assertThat(ids).doesNotContain(p1.toString(), p2.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s4 — Patient rattaché à Dr A → Dr A le voit même si MEDECIN ∉ orphan_roles
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s4_isolationOn_attachedToDrA_drASeesPatient() throws Exception {
        UUID pAttached = createChild(LocalDate.now().minusMonths(8));
        attachPatientToDoctor(pAttached, medAId, true);
        enableIsolation();
        setOrphanRoles("ADMIN"); // MEDECIN exclu — preuve qu'on passe par le rattachement et pas par l'orphan-fallback

        List<String> ids = queuePatientIds(bearer(medAEmail));
        assertThat(ids).contains(pAttached.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s5 — Patient rattaché à Dr A → Dr B ne le voit PAS
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s5_isolationOn_attachedToDrA_drBDoesNotSeePatient() throws Exception {
        UUID pAttached = createChild(LocalDate.now().minusMonths(8));
        attachPatientToDoctor(pAttached, medAId, true);
        enableIsolation();
        setOrphanRoles("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT"); // libéral sur orphelins

        List<String> ids = queuePatientIds(bearer(medBEmail));
        assertThat(ids).doesNotContain(pAttached.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s6 — ADMIN bypass scope (V032 design) → voit tout, peu importe les flags
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s6_isolationOn_adminBypassesScope() throws Exception {
        UUID pOrphan = createChild(LocalDate.now().minusMonths(8));
        UUID pAttached = createChild(LocalDate.now().minusMonths(8));
        attachPatientToDoctor(pAttached, medAId, true);
        enableIsolation();
        setOrphanRoles(); // tableau vide : aucun rôle ne voit les orphelins

        List<String> ids = queuePatientIds(bearer(adminEmail));
        assertThat(ids).contains(pOrphan.toString(), pAttached.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s7 — Rattachement via created_by (PLANNED, pas administered) suffit
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s7_isolationOn_plannedDoseCreatedByDrA_attachesPatient() throws Exception {
        UUID pPlanned = createChild(LocalDate.now().minusMonths(8));
        attachPatientToDoctor(pPlanned, medAId, false); // PLANNED, created_by = Dr A
        enableIsolation();
        setOrphanRoles("ADMIN"); // MEDECIN exclu

        List<String> idsA = queuePatientIds(bearer(medAEmail));
        List<String> idsB = queuePatientIds(bearer(medBEmail));
        assertThat(idsA).contains(pPlanned.toString());
        assertThat(idsB).doesNotContain(pPlanned.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s8 — Cloisonnement ON mais 1 seul MEDECIN actif → bypass (pas de scope)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s8_isolationOn_singleActiveMedecin_bypassesScope() throws Exception {
        // Désactive Dr B + désactive tous les autres médecins seedés (Youssef, Sara, Sofia, etc.)
        // afin que seul Dr A reste actif. AccessScopeService bypasse la règle quand
        // countActivePractitioners() < 2.
        jdbc.update(
                "UPDATE identity_user u SET enabled = FALSE "
                        + "WHERE u.id IN (SELECT user_id FROM identity_user_role WHERE role_id = ?) "
                        + "  AND u.id <> ?",
                ROLE_MEDECIN, medAId);

        UUID pOrphan = createChild(LocalDate.now().minusMonths(8));
        enableIsolation();
        setOrphanRoles("ADMIN"); // MEDECIN exclu — pourtant Dr A doit voir car bypass

        try {
            List<String> ids = queuePatientIds(bearer(medAEmail));
            assertThat(ids).contains(pOrphan.toString());
        } finally {
            // Restaure les autres médecins pour les autres tests.
            jdbc.update("UPDATE identity_user SET enabled = TRUE "
                    + "WHERE id IN (SELECT user_id FROM identity_user_role WHERE role_id = ?)",
                    ROLE_MEDECIN);
        }
    }
}
