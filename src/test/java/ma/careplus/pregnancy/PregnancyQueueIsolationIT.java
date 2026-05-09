package ma.careplus.pregnancy;

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
 * Integration tests — V039 cloisonnement de la queue Grossesse.
 *
 * Sœur jumelle de {@code VaccinationQueueIsolationIT} (V036). Pour chaque
 * scénario, on flippe directement {@code configuration_clinic_settings} via
 * JDBC car il n'existe pas (encore) d'endpoint qui touche uniquement
 * {@code pregnancyOrphanVisibleRoles}.
 *
 * <p>Sources de rattachement testées :
 * <ul>
 *   <li>{@code pregnancy.created_by} (déclaration sans visite) — s7</li>
 *   <li>{@code pregnancy_visit.recorded_by} — s4, s5</li>
 * </ul>
 *
 * <p>Les autres sources ({@code pregnancy_ultrasound}, {@code pregnancy_visit_plan})
 * partagent la même requête bulk SQL — couvertes implicitement par s4
 * (la requête UNION ALL chacune d'elles).
 *
 * <p>Scénarios :
 * <ol>
 *   <li>Cloisonnement OFF → MEDECIN voit toutes les grossesses (orphelines incluses).</li>
 *   <li>Cloisonnement ON, MEDECIN ∈ orphan_visible_roles → MEDECIN voit les orphelines.</li>
 *   <li>Cloisonnement ON, MEDECIN ∉ orphan_visible_roles → MEDECIN ne voit aucune orpheline.</li>
 *   <li>Cloisonnement ON, grossesse rattachée à Dr A via visite → Dr A la voit.</li>
 *   <li>Cloisonnement ON, grossesse rattachée à Dr A → Dr B (autre MEDECIN) ne la voit PAS.</li>
 *   <li>Cloisonnement ON, ADMIN bypass scope → voit tout.</li>
 *   <li>Cloisonnement ON, rattachement via {@code pregnancy.created_by} (déclaration sans visite) suffit.</li>
 *   <li>Cloisonnement ON + un seul MEDECIN actif → bypass (pas de scope).</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PregnancyQueueIsolationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private static final String PWD = "PregIsoIT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medAId;
    UUID medBId;
    UUID adminId;
    String medAEmail;
    String medBEmail;
    String adminEmail;

    @BeforeEach
    void setup() {
        rateLimitFilter.clearBucketsForTests();

        // Clean slate per test : preg-iso-* users + PregIsoIT-* patients + their pregnancies/visits.
        jdbc.update("DELETE FROM pregnancy_visit WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'PregIsoIT-%'))");
        jdbc.update("DELETE FROM pregnancy_ultrasound WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'PregIsoIT-%'))");
        jdbc.update("DELETE FROM pregnancy_visit_plan WHERE pregnancy_id IN "
                + "(SELECT id FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'PregIsoIT-%'))");
        jdbc.update("DELETE FROM pregnancy WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'PregIsoIT-%')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name LIKE 'PregIsoIT-%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'preg-iso-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'preg-iso-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'preg-iso-%'");

        // Reset settings to default OFF + tous rôles → comportement historique.
        jdbc.update(
                "UPDATE configuration_clinic_settings SET agenda_strict_isolation = FALSE, "
                        + "pregnancy_orphan_visible_roles = ARRAY['MEDECIN','ADMIN','SECRETAIRE','ASSISTANT']::VARCHAR[]");

        medAId = UUID.randomUUID();
        medBId = UUID.randomUUID();
        adminId = UUID.randomUUID();
        medAEmail = seedUser(medAId, "preg-iso-meda", ROLE_MEDECIN);
        medBEmail = seedUser(medBId, "preg-iso-medb", ROLE_MEDECIN);
        adminEmail = seedUser(adminId, "preg-iso-admin", ROLE_ADMIN);
    }

    private String seedUser(UUID userId, String prefix, UUID roleId) {
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'PregIso', TRUE, 0, 0, now(), now())
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

    /**
     * Crée une patiente F + une grossesse EN_COURS. Si {@code declaringDoctor}
     * non-null, renseigne {@code pregnancy.created_by} → la grossesse est
     * rattachée à ce médecin dès la déclaration. Sinon orpheline.
     */
    private UUID createPregnancy(UUID declaringDoctor) {
        UUID patientId = UUID.randomUUID();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, birth_date, status,
                     tier, number_children, version, created_at, updated_at)
                VALUES (?, ?, 'Salma', 'F', '1995-06-15', 'ACTIF', 'NORMAL', 0, 0, now(), now())
                """, patientId, "PregIsoIT-" + suffix);

        UUID pregnancyId = UUID.randomUUID();
        LocalDate lmp = LocalDate.now().minusWeeks(20);
        LocalDate due = lmp.plusDays(280);
        jdbc.update("""
                INSERT INTO pregnancy
                    (id, patient_id, started_at, lmp_date, due_date, status,
                     fetuses, version, created_at, updated_at, created_by)
                VALUES (?, ?, ?, ?, ?, 'EN_COURS', '[{"label":"Fœtus unique"}]'::jsonb,
                        0, now(), now(), ?)
                """, pregnancyId, patientId, lmp, lmp, due, declaringDoctor);
        return pregnancyId;
    }

    /**
     * Insère une visite obstétricale rattachant la grossesse au médecin via
     * {@code pregnancy_visit.recorded_by}. La grossesse devient ainsi visible
     * à ce médecin sous cloisonnement, indépendamment de qui l'a déclarée.
     */
    private void recordVisit(UUID pregnancyId, UUID doctorId) {
        jdbc.update("""
                INSERT INTO pregnancy_visit
                    (id, pregnancy_id, recorded_at, sa_weeks, sa_days,
                     recorded_by, version, created_at, updated_at)
                VALUES (?, ?, ?, 20, 0, ?, 0, now(), now())
                """, UUID.randomUUID(), pregnancyId, OffsetDateTime.now().minusDays(1), doctorId);
    }

    private void enableIsolation() {
        jdbc.update("UPDATE configuration_clinic_settings SET agenda_strict_isolation = TRUE");
    }

    private void setOrphanRoles(String... roles) {
        jdbc.update("UPDATE configuration_clinic_settings SET pregnancy_orphan_visible_roles = ?",
                (Object) roles);
    }

    private List<String> queuePregnancyIds(String token) throws Exception {
        MvcResult r = mockMvc.perform(get("/api/pregnancies/queue")
                        .header("Authorization", token)
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode content = objectMapper.readTree(r.getResponse().getContentAsString()).get("content");
        List<String> ids = new ArrayList<>();
        for (JsonNode e : content) ids.add(e.get("pregnancyId").asText());
        return ids;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s1 — Cloisonnement OFF : MEDECIN voit les 3 grossesses
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s1_isolationOff_medecinSeesAllOrphans() throws Exception {
        UUID p1 = createPregnancy(null);
        UUID p2 = createPregnancy(null);
        UUID p3 = createPregnancy(null);

        List<String> ids = queuePregnancyIds(bearer(medAEmail));
        assertThat(ids).contains(p1.toString(), p2.toString(), p3.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s2 — Cloisonnement ON, MEDECIN ∈ orphan_visible_roles → voit les orphelines
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s2_isolationOn_medecinInOrphanRoles_seesOrphans() throws Exception {
        UUID p1 = createPregnancy(null);
        UUID p2 = createPregnancy(null);
        enableIsolation();
        setOrphanRoles("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT");

        List<String> ids = queuePregnancyIds(bearer(medAEmail));
        assertThat(ids).contains(p1.toString(), p2.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s3 — Cloisonnement ON, MEDECIN ∉ orphan_visible_roles → ne voit aucune orpheline
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s3_isolationOn_medecinNotInOrphanRoles_seesNothing() throws Exception {
        UUID p1 = createPregnancy(null);
        UUID p2 = createPregnancy(null);
        enableIsolation();
        setOrphanRoles("ADMIN", "SECRETAIRE", "ASSISTANT"); // pas MEDECIN

        List<String> ids = queuePregnancyIds(bearer(medAEmail));
        assertThat(ids).doesNotContain(p1.toString(), p2.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s4 — Grossesse rattachée à Dr A via visite → Dr A la voit même si MEDECIN ∉ orphan
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s4_isolationOn_attachedToDrAByVisit_drASeesPregnancy() throws Exception {
        UUID pAttached = createPregnancy(null); // orpheline à la déclaration
        recordVisit(pAttached, medAId);          // rattachée à Dr A par la visite
        enableIsolation();
        setOrphanRoles("ADMIN"); // MEDECIN exclu — preuve qu'on passe par le rattachement

        List<String> ids = queuePregnancyIds(bearer(medAEmail));
        assertThat(ids).contains(pAttached.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s5 — Grossesse rattachée à Dr A → Dr B ne la voit PAS
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s5_isolationOn_attachedToDrA_drBDoesNotSeePregnancy() throws Exception {
        UUID pAttached = createPregnancy(null);
        recordVisit(pAttached, medAId);
        enableIsolation();
        setOrphanRoles("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT"); // libéral sur orphelins

        List<String> ids = queuePregnancyIds(bearer(medBEmail));
        assertThat(ids).doesNotContain(pAttached.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s6 — ADMIN bypass scope (V032 design) → voit tout
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s6_isolationOn_adminBypassesScope() throws Exception {
        UUID pOrphan = createPregnancy(null);
        UUID pAttached = createPregnancy(null);
        recordVisit(pAttached, medAId);
        enableIsolation();
        setOrphanRoles(); // tableau vide : aucun rôle ne voit les orphelines

        List<String> ids = queuePregnancyIds(bearer(adminEmail));
        assertThat(ids).contains(pOrphan.toString(), pAttached.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s7 — Rattachement via pregnancy.created_by (déclaration sans visite) suffit
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s7_isolationOn_pregnancyDeclaredByDrA_attachesPregnancy() throws Exception {
        UUID pDeclared = createPregnancy(medAId); // créé par Dr A, sans visite
        enableIsolation();
        setOrphanRoles("ADMIN"); // MEDECIN exclu

        List<String> idsA = queuePregnancyIds(bearer(medAEmail));
        List<String> idsB = queuePregnancyIds(bearer(medBEmail));
        assertThat(idsA).contains(pDeclared.toString());
        assertThat(idsB).doesNotContain(pDeclared.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // s8 — Cloisonnement ON mais 1 seul MEDECIN actif → bypass (pas de scope)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void s8_isolationOn_singleActiveMedecin_bypassesScope() throws Exception {
        // Désactive Dr B + tous les autres MEDECIN seedés afin que seul Dr A reste actif.
        // AccessScopeService bypasse la règle quand countActivePractitioners() < 2.
        jdbc.update(
                "UPDATE identity_user u SET enabled = FALSE "
                        + "WHERE u.id IN (SELECT user_id FROM identity_user_role WHERE role_id = ?) "
                        + "  AND u.id <> ?",
                ROLE_MEDECIN, medAId);

        UUID pOrphan = createPregnancy(null);
        enableIsolation();
        setOrphanRoles("ADMIN"); // MEDECIN exclu — pourtant Dr A doit voir car bypass

        try {
            List<String> ids = queuePregnancyIds(bearer(medAEmail));
            assertThat(ids).contains(pOrphan.toString());
        } finally {
            // Restaure les autres médecins pour les autres tests.
            jdbc.update("UPDATE identity_user SET enabled = TRUE "
                    + "WHERE id IN (SELECT user_id FROM identity_user_role WHERE role_id = ?)",
                    ROLE_MEDECIN);
        }
    }
}
