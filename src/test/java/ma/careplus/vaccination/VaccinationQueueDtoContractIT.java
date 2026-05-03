package ma.careplus.vaccination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
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
 * Regression IT — contrat JSON du DTO VaccinationQueueEntry vs attentes du frontend TypeScript.
 *
 * Scénarios :
 * 1. Champs patientFirstName + patientLastName présents et distincts (backend exposait
 *    patientFullName = prénom+nom concaténé — frontend lit firstName/lastName séparément).
 * 2. Champ patientBirthDate présent (backend exposait birthDate — casse le calcul d'âge mobile).
 * 3. Champ vaccineId présent — requis par RecordDoseDrawer pour le pré-remplissage du select.
 * 4. Champ scheduleDoseId présent (nullable) — requis pour lier la dose au calendrier PNI.
 * 5. Pagination : champs totalPages + number présents (backend exposait pageNumber/pageSize —
 *    le hook useVaccinationsQueue lit totalPages et number ; la navigation de pages était cassée).
 *
 * REGRESSION GUARD :
 *   Bug détecté le 2026-05-03 lors du QA Étape 5.
 *   Cause : VaccinationQueueEntry.java record (ligne 18) exposait patientFullName (String)
 *   au lieu de patientFirstName + patientLastName séparément. Il manquait aussi vaccineId
 *   et scheduleDoseId. PageView exposait pageNumber/pageSize au lieu de number/totalPages.
 *   Conséquences observées :
 *   - Desktop : table worklist vide (crash silencieux sur entry.patientFirstName[0]).
 *   - Mobile : crash TypeError « Cannot read properties of undefined (reading '0') »
 *     dans VaccinationsQueuePage.mobile.tsx:116.
 *   - Bouton « Saisir dose » inopérant (vaccineId undefined → select vide → validation fail).
 *   - Pagination toujours page 0 (totalPages toujours 0 → boutons désactivés).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class VaccinationQueueDtoContractIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "DtoContract-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String medEmail;

    @BeforeEach
    void setup() {
        rateLimitFilter.clearBucketsForTests();

        // Clean test data
        jdbc.update("DELETE FROM vaccination_dose WHERE patient_id IN "
                + "(SELECT id FROM patient_patient WHERE last_name LIKE 'DtoContract-%')");
        jdbc.update("DELETE FROM patient_patient WHERE last_name LIKE 'DtoContract-%'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'dtocontract-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'dtocontract-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'dtocontract-%'");

        medEmail = seedUser("med", ROLE_MEDECIN);

        // Create one pediatric patient (8 months old → OVERDUE doses)
        UUID childId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, birth_date, status,
                     tier, number_children, version, created_at, updated_at)
                VALUES (?, 'DtoContract-enfant', 'Prenom', 'M', ?, 'ACTIF', 'NORMAL', 0, 0, now(), now())
                """, childId, java.sql.Date.valueOf(LocalDate.now().minusMonths(8)));
    }

    private String seedUser(String prefix, UUID roleId) {
        UUID userId = UUID.randomUUID();
        String email = "dtocontract-" + prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Test', 'DtoContract', TRUE, 0, 0, now(), now())
                """, userId, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", userId, roleId);
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

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 1: patientFirstName et patientLastName présents et distincts
    // Régresse : backend exposait patientFullName (prénom+nom concaténé)
    // Conséquence : table worklist vide (crash sur patientFirstName[0])
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S1 — queue entry contient patientFirstName et patientLastName distincts (pas patientFullName)")
    void s1_queueEntry_hasFirstAndLastNameSeparately() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode content = body.get("content");
        assertThat(content).isNotNull().isNotEmpty();

        // Find our test patient
        JsonNode entry = null;
        for (JsonNode e : content) {
            String lastName = e.has("patientLastName") ? e.get("patientLastName").asText() : null;
            if ("DtoContract-enfant".equals(lastName)) {
                entry = e;
                break;
            }
        }
        assertThat(entry).as("Test patient entry not found in queue").isNotNull();

        // MUST have patientFirstName and patientLastName as separate fields
        assertThat(entry.has("patientFirstName"))
                .as("patientFirstName doit être présent dans la réponse JSON")
                .isTrue();
        assertThat(entry.has("patientLastName"))
                .as("patientLastName doit être présent dans la réponse JSON")
                .isTrue();
        assertThat(entry.get("patientFirstName").asText())
                .as("patientFirstName doit valoir 'Prenom'")
                .isEqualTo("Prenom");
        assertThat(entry.get("patientLastName").asText())
                .as("patientLastName doit valoir 'DtoContract-enfant'")
                .isEqualTo("DtoContract-enfant");

        // Must NOT have patientFullName (frontend doesn't use it; its presence alongside
        // missing firstName/lastName was the root cause of the regression)
        assertThat(entry.has("patientFullName"))
                .as("patientFullName ne doit PAS exister — frontend lit firstName/lastName séparément")
                .isFalse();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 2: patientBirthDate présent (pas birthDate)
    // Régresse : formatAge(entry.patientBirthDate) → crash si champ absent
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S2 — queue entry contient patientBirthDate (pas birthDate) — requis par formatAge()")
    void s2_queueEntry_hasPatientBirthDateField() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode entry = findTestPatientEntry(body.get("content"));
        assertThat(entry).isNotNull();

        assertThat(entry.has("patientBirthDate"))
                .as("patientBirthDate doit être présent dans la réponse JSON")
                .isTrue();
        assertThat(entry.get("patientBirthDate").asText())
                .as("patientBirthDate doit être une date ISO non nulle")
                .isNotBlank()
                .matches("\\d{4}-\\d{2}-\\d{2}");

        // Must NOT have birthDate (old name that broke the frontend)
        assertThat(entry.has("birthDate"))
                .as("birthDate ne doit PAS exister — frontend lit patientBirthDate")
                .isFalse();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 3: vaccineId présent
    // Régresse : RecordDoseDrawer pré-remplit select vaccineId → undefined → validate fail
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S3 — queue entry contient vaccineId UUID — requis pour pré-remplir le drawer")
    void s3_queueEntry_hasVaccineId() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode entry = findTestPatientEntry(body.get("content"));
        assertThat(entry).isNotNull();

        assertThat(entry.has("vaccineId"))
                .as("vaccineId doit être présent dans la réponse JSON")
                .isTrue();
        assertThat(entry.get("vaccineId").asText())
                .as("vaccineId doit être un UUID valide")
                .isNotBlank()
                .matches("[0-9a-f-]{36}");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 4: scheduleDoseId présent (peut être null pour hors-calendrier)
    // Régresse : queueEntryToCalendarEntry(e) → e.scheduleDoseId undefined
    //            → scheduleDoseId absent du body de POST → dose liée sans schedule
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S4 — queue entry contient scheduleDoseId (UUID ou null) — requis pour lier au calendrier PNI")
    void s4_queueEntry_hasScheduleDoseId() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        JsonNode entry = findTestPatientEntry(body.get("content"));
        assertThat(entry).isNotNull();

        // scheduleDoseId must be present as a key (value may be null for off-schedule)
        assertThat(entry.has("scheduleDoseId"))
                .as("scheduleDoseId doit être présent dans la réponse JSON (peut être null)")
                .isTrue();

        // For schedule-linked PNI doses, it should be a valid UUID
        if (!entry.get("scheduleDoseId").isNull()) {
            assertThat(entry.get("scheduleDoseId").asText())
                    .matches("[0-9a-f-]{36}");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 5: Pagination — totalPages et number présents (pas pageNumber/pageSize)
    // Régresse : useVaccinationsQueue lit data.totalPages + data.number
    //            → undefined → 0 → les boutons Précédent/Suivant sont toujours grisés
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("S5 — PageView contient totalPages + number (pas pageNumber/pageSize) — requis pour pagination")
    void s5_pageView_hasTotalPagesAndNumber() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(get("/api/vaccinations/queue")
                        .header("Authorization", token)
                        .param("status", "OVERDUE")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());

        // Frontend reads: data.totalPages, data.number, data.totalElements, data.content
        assertThat(body.has("totalPages"))
                .as("totalPages doit être présent — hook lit data.totalPages")
                .isTrue();
        assertThat(body.has("number"))
                .as("number doit être présent — hook lit data.number pour currentPage")
                .isTrue();
        assertThat(body.get("number").asInt())
                .as("number doit être 0 pour la première page")
                .isEqualTo(0);

        // Must NOT expose pageNumber or pageSize as the sole pagination fields
        // (if present alongside number/totalPages, that's acceptable; but number and totalPages are mandatory)
        assertThat(body.has("totalElements"))
                .as("totalElements doit être présent")
                .isTrue();

        // totalPages must be computable: ceil(totalElements / size)
        long total = body.get("totalElements").asLong();
        int totalPages = body.get("totalPages").asInt();
        long expectedPages = (long) Math.ceil((double) total / 10);
        assertThat((long) totalPages)
                .as("totalPages doit valoir ceil(totalElements/size)")
                .isEqualTo(expectedPages);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Finds the test patient entry (last_name = DtoContract-enfant) in the content array. */
    private JsonNode findTestPatientEntry(JsonNode content) {
        if (content == null || !content.isArray()) return null;
        for (JsonNode e : content) {
            // Try patientLastName first (expected after fix)
            if (e.has("patientLastName") && "DtoContract-enfant".equals(e.get("patientLastName").asText())) {
                return e;
            }
            // Try patientFullName (present before fix — also returns the entry so the test
            // can assert field presence and fail with a clear message)
            if (e.has("patientFullName") && e.get("patientFullName").asText().contains("DtoContract-enfant")) {
                return e;
            }
        }
        return null;
    }
}
