package ma.careplus.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
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
 * V034 — EstablishmentTypeIT
 *
 * <p>Scénarios couverts :
 * <ol>
 *   <li>A1 : Flyway V034 a appliqué les 3 colonnes (establishment_type, lab_internal,
 *             imaging_internal) — vérifiable via JdbcTemplate SELECT direct.</li>
 *   <li>B-ADMIN : Admin PUT /api/settings/clinic → 200.</li>
 *   <li>B-SECRETAIRE : SECRETAIRE PUT → 403 Forbidden.</li>
 *   <li>B-ASSISTANT : ASSISTANT PUT → 403 Forbidden.</li>
 *   <li>B-MEDECIN : MEDECIN (sans ADMIN) PUT → 403 Forbidden.</li>
 *   <li>C1/C2 : Admin PUT avec CLINIQUE + imagingInternal=true + labInternal=true →
 *               GET retourne ces valeurs, DB confirme la persistance.</li>
 *   <li>E3 : PUT ultérieur sans le champ establishmentType conserve la valeur courante
 *            (pas de reset silencieux au défaut 'CABINET').</li>
 *   <li>E2 : PUT avec establishmentType="INVALID" → 400 (validation @Pattern).</li>
 *   <li>D1 : PDF ordonnance (DRUG) après PUT CLINIQUE → texte extrait par PDFBox
 *            commence par "Clinique " suivi du nom (pas "Cabinet ").</li>
 *   <li>D3 : PDF carnet de vaccination après PUT CLINIQUE → même assertion.</li>
 * </ol>
 *
 * <h2>REGRESSION GUARD</h2>
 * <ul>
 *   <li><b>2026-05-08 — PDF header figé "Cabinet"</b> : avant V034, le type d'établissement
 *       n'était pas stocké et les templates PDF rendaient toujours "Cabinet &lt;nom&gt;".
 *       Les tests D1/D3 auraient détecté l'absence du préfixe dynamique.</li>
 *   <li><b>2026-05-08 — Champ optionnel resetté au défaut</b> : si la logique de lecture-
 *       courante-avant-update avait manqué la branche {@code req.establishmentType() == null},
 *       un PUT sans le champ aurait silencieusement reset à "CABINET". Le test E3 l'aurait
 *       attrapé via assertion DB.</li>
 *   <li><b>RBAC downgrade</b> : avant ce commit, /api/settings/clinic était accessible à
 *       tout rôle authentifié. Les tests B-SECRETAIRE/ASSISTANT/MEDECIN auraient détecté
 *       tout retour en arrière du {@code @PreAuthorize("hasRole('ADMIN')")}.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class EstablishmentTypeIT {

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

    private static final String PWD = "EstTypeIT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    // One token per role, cached per test via @BeforeEach re-seed
    private String adminToken;
    private String secretaireToken;
    private String assistantToken;
    private String medecinOnlyToken;

    // IDs needed for PDF scenario
    private UUID medecinAdminId;
    private UUID patientId;
    private UUID consultationId;
    private UUID medicationId;

    @BeforeEach
    void seed() throws Exception {
        rateLimitFilter.clearBucketsForTests();

        // ── Wipe domain data in FK-safe order ──────────────────────────────────
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM vaccination_dose WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'EstTypeIT%')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name LIKE 'EstTypeIT%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE '%esttypeit%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE '%esttypeit%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE '%esttypeit%'");

        // Reset clinic settings to a clean baseline for every test
        jdbc.update("DELETE FROM configuration_clinic_settings");

        // ── Seed users ─────────────────────────────────────────────────────────
        // Admin + Medecin on the same user (needed to create prescriptions as ADMIN)
        medecinAdminId = UUID.randomUUID();
        String adminEmail = "esttypeit-admin-" + UUID.randomUUID() + "@test.ma";
        insertUser(medecinAdminId, adminEmail);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medecinAdminId, ROLE_ADMIN);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medecinAdminId, ROLE_MEDECIN);

        // Pure MEDECIN (no ADMIN) — for RBAC negative
        UUID medecinOnlyId = UUID.randomUUID();
        String medecinOnlyEmail = "esttypeit-med-" + UUID.randomUUID() + "@test.ma";
        insertUser(medecinOnlyId, medecinOnlyEmail);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                medecinOnlyId, ROLE_MEDECIN);

        // SECRETAIRE
        UUID secId = UUID.randomUUID();
        String secEmail = "esttypeit-sec-" + UUID.randomUUID() + "@test.ma";
        insertUser(secId, secEmail);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                secId, ROLE_SECRETAIRE);

        // ASSISTANT
        UUID asstId = UUID.randomUUID();
        String asstEmail = "esttypeit-asst-" + UUID.randomUUID() + "@test.ma";
        insertUser(asstId, asstEmail);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                asstId, ROLE_ASSISTANT);

        adminToken      = login(adminEmail);
        medecinOnlyToken = login(medecinOnlyEmail);
        secretaireToken = login(secEmail);
        assistantToken  = login(asstEmail);

        // ── Domain data for PDF tests ─────────────────────────────────────────
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'EstTypeIT-Patient', 'Test', 'M', '1985-07-20', 'ESTTYPE001',
                        0, 0, 'ACTIF', now(), now())
                """, patientId);

        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medecinAdminId);

        medicationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags,
                    favorite, active, created_at, updated_at)
                VALUES (?, 'Doliprane 1g', 'Paracetamol', 'comprime', '1g', 'antalgique',
                        TRUE, TRUE, now(), now())
                """, medicationId);
    }

    // ── A1: Flyway V034 applied ────────────────────────────────────────────────

    @Test
    @DisplayName("A1 — Flyway V034 a créé les 3 colonnes (establishment_type, lab_internal, imaging_internal) sur configuration_clinic_settings")
    void a1_flyway_v034_columns_exist() {
        // Verify we can SELECT the three new columns without error.
        // Testcontainers applies ALL migrations fresh, so this verifies the migration is valid.
        Integer rowCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'configuration_clinic_settings' "
                        + "AND column_name IN ('establishment_type','lab_internal','imaging_internal')",
                Integer.class);
        assertThat(rowCount).as("V034 doit avoir créé 3 colonnes").isEqualTo(3);

        // Also verify we can INSERT a row with the new columns
        UUID testId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO configuration_clinic_settings "
                        + "(id, name, address, city, phone, establishment_type, lab_internal, imaging_internal) "
                        + "VALUES (?, 'Test', 'Addr', 'City', '0600', 'CABINET', FALSE, FALSE)",
                testId);
        String type = jdbc.queryForObject(
                "SELECT establishment_type FROM configuration_clinic_settings WHERE id = ?",
                String.class, testId);
        assertThat(type).isEqualTo("CABINET");
    }

    // ── B: RBAC ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("B-ADMIN — Admin peut PUT /api/settings/clinic → 200 et les champs V034 sont retournés")
    void b_admin_can_put_clinic_settings() throws Exception {
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Clinique Test",
                                 "address":"Rue Test",
                                 "city":"Casablanca",
                                 "phone":"+212522000000",
                                 "establishmentType":"CLINIQUE",
                                 "imagingInternal":true,
                                 "labInternal":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.establishmentType").value("CLINIQUE"))
                .andExpect(jsonPath("$.imagingInternal").value(true))
                .andExpect(jsonPath("$.labInternal").value(true));
    }

    @Test
    @DisplayName("B-SECRETAIRE — Secrétaire ne peut pas PUT /api/settings/clinic → 403 Forbidden")
    void b_secretaire_cannot_put_clinic_settings() throws Exception {
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", secretaireToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Hack","address":"Addr","city":"Casa","phone":"0600"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("B-ASSISTANT — Assistant ne peut pas PUT /api/settings/clinic → 403 Forbidden")
    void b_assistant_cannot_put_clinic_settings() throws Exception {
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", assistantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Hack","address":"Addr","city":"Casa","phone":"0600"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("B-MEDECIN (sans ADMIN) — Médecin seul ne peut pas PUT /api/settings/clinic → 403 Forbidden")
    void b_medecin_without_admin_cannot_put_clinic_settings() throws Exception {
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", medecinOnlyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Hack","address":"Addr","city":"Casa","phone":"0600"}
                                """))
                .andExpect(status().isForbidden());
    }

    // ── C1/C2: Persistance type + booléens ────────────────────────────────────

    @Test
    @DisplayName("C1/C2 — PUT CLINIQUE + imagingInternal=true + labInternal=true → GET retourne les mêmes valeurs et la DB confirme")
    void c1_c2_put_clinique_persisted_in_db_and_get() throws Exception {
        // PUT
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Clinique El Amrani",
                                 "address":"24 Rue Sebti",
                                 "city":"Casablanca",
                                 "phone":"+212522000000",
                                 "establishmentType":"CLINIQUE",
                                 "imagingInternal":true,
                                 "labInternal":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.establishmentType").value("CLINIQUE"))
                .andExpect(jsonPath("$.imagingInternal").value(true))
                .andExpect(jsonPath("$.labInternal").value(true));

        // GET reflects
        mockMvc.perform(get("/api/settings/clinic")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.establishmentType").value("CLINIQUE"))
                .andExpect(jsonPath("$.imagingInternal").value(true))
                .andExpect(jsonPath("$.labInternal").value(true));

        // DB assertion
        String dbType = jdbc.queryForObject(
                "SELECT establishment_type FROM configuration_clinic_settings LIMIT 1",
                String.class);
        Boolean dbLab = jdbc.queryForObject(
                "SELECT lab_internal FROM configuration_clinic_settings LIMIT 1",
                Boolean.class);
        Boolean dbImaging = jdbc.queryForObject(
                "SELECT imaging_internal FROM configuration_clinic_settings LIMIT 1",
                Boolean.class);

        assertThat(dbType).isEqualTo("CLINIQUE");
        assertThat(dbLab).isTrue();
        assertThat(dbImaging).isTrue();
    }

    // ── E3: Champ optionnel = pas de reset ────────────────────────────────────

    @Test
    @DisplayName("E3 — PUT sans establishmentType dans le payload conserve la valeur courante (pas de reset silencieux à CABINET)")
    void e3_put_without_establishment_type_preserves_existing() throws Exception {
        // Step 1: Set CLINIQUE
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test Clinique",
                                 "address":"Rue Test",
                                 "city":"Rabat",
                                 "phone":"+212537000000",
                                 "establishmentType":"CLINIQUE",
                                 "labInternal":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.establishmentType").value("CLINIQUE"));

        // Step 2: PUT without the establishmentType field
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test Clinique Updated",
                                 "address":"Rue Test",
                                 "city":"Rabat",
                                 "phone":"+212537000000"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.establishmentType").value("CLINIQUE"))
                .andExpect(jsonPath("$.labInternal").value(true));

        // DB confirms no reset
        String dbType = jdbc.queryForObject(
                "SELECT establishment_type FROM configuration_clinic_settings LIMIT 1",
                String.class);
        assertThat(dbType)
                .as("establishmentType ne doit pas avoir été resetté à CABINET par un PUT sans le champ")
                .isEqualTo("CLINIQUE");
    }

    // ── E2: Validation @Pattern ────────────────────────────────────────────────

    @Test
    @DisplayName("E2 — PUT avec establishmentType=INVALID → 400 (validation @Pattern) et la DB reste inchangée")
    void e2_invalid_establishment_type_returns_400_and_db_unchanged() throws Exception {
        // Seed a baseline row with CLINIQUE so we can verify it doesn't change
        jdbc.update(
                "INSERT INTO configuration_clinic_settings "
                        + "(id, name, address, city, phone, establishment_type, lab_internal, imaging_internal) "
                        + "VALUES (?, 'Test', 'Addr', 'City', '0600', 'CLINIQUE', FALSE, FALSE)",
                UUID.randomUUID());

        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test","address":"Addr","city":"Casa","phone":"0600",
                                 "establishmentType":"INVALID"}
                                """))
                .andExpect(status().isBadRequest());

        // DB must remain unchanged (CLINIQUE, not reset by the failed write)
        String dbType = jdbc.queryForObject(
                "SELECT establishment_type FROM configuration_clinic_settings LIMIT 1",
                String.class);
        assertThat(dbType)
                .as("Un PUT 400 ne doit pas avoir modifié la valeur en base")
                .isEqualTo("CLINIQUE");
    }

    // ── D1: PDF ordonnance avec préfixe établissement ─────────────────────────

    @Test
    @DisplayName("D1 — PDF ordonnance (DRUG) après PUT CLINIQUE contient 'Clinique <nom>' dans l'en-tête et non 'Cabinet '")
    void d1_ordonnance_pdf_header_contains_clinique_prefix() throws Exception {
        // Set CLINIQUE in settings
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"El Amrani PDF",
                                 "address":"Rue Sebti",
                                 "city":"Casablanca",
                                 "phone":"+212522000000",
                                 "establishmentType":"CLINIQUE"}
                                """))
                .andExpect(status().isOk());

        // Create a DRUG prescription then download the PDF
        byte[] pdfBytes = generateDrugPrescriptionPdf(adminToken);

        assertThat(pdfBytes).isNotEmpty();
        assertThat(pdfBytes[0]).isEqualTo((byte) '%');
        assertThat(pdfBytes[1]).isEqualTo((byte) 'P');
        assertThat(pdfBytes[2]).isEqualTo((byte) 'D');
        assertThat(pdfBytes[3]).isEqualTo((byte) 'F');

        String text = extractPdfText(pdfBytes);
        assertThat(text)
                .as("L'en-tête PDF doit contenir 'Clinique El Amrani PDF' (préfixe dynamique V034)")
                .contains("Clinique El Amrani PDF");
        assertThat(text)
                .as("L'en-tête PDF ne doit pas commencer par 'Cabinet ' quand le type est CLINIQUE")
                .doesNotContain("Cabinet El Amrani PDF");
    }

    // ── D3: PDF carnet vaccination avec préfixe établissement ─────────────────

    @Test
    @DisplayName("D3 — PDF carnet de vaccination après PUT CLINIQUE contient 'Clinique <nom>' dans l'en-tête")
    void d3_vaccination_booklet_pdf_header_contains_clinique_prefix() throws Exception {
        // Set CLINIQUE in settings
        mockMvc.perform(put("/api/settings/clinic")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"El Amrani Booklet",
                                 "address":"Rue Sebti",
                                 "city":"Casablanca",
                                 "phone":"+212522000000",
                                 "establishmentType":"CLINIQUE"}
                                """))
                .andExpect(status().isOk());

        // Download vaccination booklet (no doses — empty table is fine)
        byte[] pdfBytes = mockMvc.perform(get("/api/patients/" + patientId + "/vaccinations/booklet")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(pdfBytes).isNotEmpty();
        assertThat(pdfBytes[0]).isEqualTo((byte) '%');
        assertThat(pdfBytes[1]).isEqualTo((byte) 'P');

        String text = extractPdfText(pdfBytes);
        assertThat(text)
                .as("Le carnet PDF doit contenir 'Clinique El Amrani Booklet' (préfixe dynamique V034)")
                .contains("Clinique El Amrani Booklet");
        assertThat(text)
                .as("Le carnet PDF ne doit pas afficher 'Cabinet El Amrani Booklet' quand type=CLINIQUE")
                .doesNotContain("Cabinet El Amrani Booklet");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void insertUser(UUID id, String email) {
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'User', TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(PWD),
                OffsetDateTime.now(), OffsetDateTime.now());
    }

    private String login(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    /**
     * Creates a fresh DRUG prescription for the pre-seeded consultation,
     * then downloads its PDF. Returns the raw PDF bytes.
     */
    private byte[] generateDrugPrescriptionPdf(String token) throws Exception {
        String body = String.format("""
                {
                  "type": "DRUG",
                  "allergyOverride": false,
                  "lines": [
                    {
                      "medicationId": "%s",
                      "dosage": "1 cp",
                      "frequency": "3x/jour",
                      "duration": "5 jours"
                    }
                  ]
                }
                """, medicationId);

        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();

        String rxId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText();

        return mockMvc.perform(get("/api/prescriptions/" + rxId + "/pdf")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
    }

    /**
     * Extracts plain text from PDF bytes using Apache PDFBox (available transitively
     * via openhtmltopdf-pdfbox in the project classpath).
     */
    private static String extractPdfText(byte[] pdfBytes) throws Exception {
        try (PDDocument doc = PDDocument.load(pdfBytes)) {
            return new PDFTextStripper().getText(doc);
        }
    }
}
