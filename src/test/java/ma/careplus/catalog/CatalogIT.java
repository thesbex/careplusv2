package ma.careplus.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
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
 * Integration tests for J6 catalog module:
 * acts, tariffs, medication search, prescriptions, allergy check, PDF generation.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class CatalogIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Catalog-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    UUID medId;
    UUID patientId;
    UUID patientPenicillinId;
    UUID consultationId;
    UUID amoxicillineId;
    UUID paracetamolId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up in correct order
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM catalog_tariff");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Medecin user
        medId = UUID.randomUUID();
        medEmail = "med-cat-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Test', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        // Normal patient (no allergy)
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'Benjelloun', 'Samir', 'M', '1985-06-15', 'S-TEST-001',
                        0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Patient with penicillin allergy
        patientPenicillinId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'Alami', 'Karim', 'M', '1970-01-15', 'S-ALLERGY-001',
                        0, 0, 'ACTIF', now(), now())
                """, patientPenicillinId);
        jdbc.update("""
                INSERT INTO patient_allergy (id, patient_id, substance, atc_tag, severity, created_at, updated_at)
                VALUES (gen_random_uuid(), ?, 'Pénicilline', 'penicillines', 'SEVERE', now(), now())
                """, patientPenicillinId);

        // Consultation in BROUILLON for normal patient
        consultationId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId);

        // Seed medications needed for tests
        amoxicillineId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags, favorite, active,
                    created_at, updated_at)
                VALUES (?, 'Amoxicilline 500', 'Amoxicilline', 'gélule', '500mg', 'penicillines',
                        TRUE, TRUE, now(), now())
                """, amoxicillineId);

        paracetamolId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags, favorite, active,
                    created_at, updated_at)
                VALUES (?, 'Doliprane 1g', 'Paracétamol', 'comprimé', '1g', 'antalgique',
                        TRUE, TRUE, now(), now())
                """, paracetamolId);
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ── Act tests ─────────────────────────────────────────────────────────────

    @Test
    void createAct_appearsInList() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(post("/api/catalog/acts")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"CONSULT-TEST","name":"Consultation test","type":"CONSULTATION"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Consultation test"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();

        String actId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/api/catalog/acts").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + actId + "')]").exists());
    }

    @Test
    void deactivateAct_removesFromActiveList() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(post("/api/catalog/acts")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"ACT-DEL-001\",\"name\":\"To deactivate\",\"type\":\"CONSULTATION\"}"))
                .andExpect(status().isCreated()).andReturn();

        String actId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(delete("/api/catalog/acts/" + actId).header("Authorization", token))
                .andExpect(status().isNoContent());

        String body = mockMvc.perform(get("/api/catalog/acts").header("Authorization", token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(actId);
    }

    // ── Tariff tests ──────────────────────────────────────────────────────────

    @Test
    void addTariff_resolvedCorrectly() throws Exception {
        String token = bearer(medEmail);

        // Create act
        MvcResult ar = mockMvc.perform(post("/api/catalog/acts")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"ACT-TARIFF-001\",\"name\":\"Act with tariff\",\"type\":\"CONSULTATION\"}"))
                .andExpect(status().isCreated()).andReturn();
        String actId = objectMapper.readTree(ar.getResponse().getContentAsString()).get("id").asText();

        // Add NORMAL tariff
        String today = LocalDate.now().toString();
        mockMvc.perform(post("/api/catalog/acts/" + actId + "/tariffs")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tier\":\"NORMAL\",\"amount\":300.00,\"effectiveFrom\":\"" + today + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount").value(300.00))
                .andExpect(jsonPath("$.tier").value("NORMAL"))
                .andExpect(jsonPath("$.effectiveTo").doesNotExist());

        // GET tariffs for act
        mockMvc.perform(get("/api/catalog/acts/" + actId + "/tariffs").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].amount").value(300.0));
    }

    @Test
    void addNewTariff_closesOldOne() throws Exception {
        String token = bearer(medEmail);

        MvcResult ar = mockMvc.perform(post("/api/catalog/acts")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"ACT-TARIFF-002\",\"name\":\"Tariff history act\",\"type\":\"CONSULTATION\"}"))
                .andExpect(status().isCreated()).andReturn();
        String actId = objectMapper.readTree(ar.getResponse().getContentAsString()).get("id").asText();

        // First tariff — effective from past
        String pastDate = LocalDate.now().minusMonths(1).toString();
        mockMvc.perform(post("/api/catalog/acts/" + actId + "/tariffs")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tier\":\"NORMAL\",\"amount\":250.00,\"effectiveFrom\":\"" + pastDate + "\"}"))
                .andExpect(status().isCreated());

        // New tariff — closes the old one
        String today = LocalDate.now().toString();
        mockMvc.perform(post("/api/catalog/acts/" + actId + "/tariffs")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tier\":\"NORMAL\",\"amount\":350.00,\"effectiveFrom\":\"" + today + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount").value(350.00));

        // Both tariffs exist; old one has effectiveTo set
        mockMvc.perform(get("/api/catalog/acts/" + actId + "/tariffs").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // Old tariff must have effectiveTo = today - 1 day
        String expectedClosedDate = LocalDate.now().minusDays(1).toString();
        String listBody = mockMvc.perform(get("/api/catalog/acts/" + actId + "/tariffs")
                        .header("Authorization", token))
                .andReturn().getResponse().getContentAsString();
        assertThat(listBody).contains(expectedClosedDate);
    }

    // ── Medication search tests ────────────────────────────────────────────────

    @Test
    void searchMedications_amox_returnsAmoxicilline() throws Exception {
        mockMvc.perform(get("/api/catalog/medications?q=amox")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$[0].molecule").value("Amoxicilline"));
    }

    // ── Prescription tests ────────────────────────────────────────────────────

    @Test
    void createDrugPrescription_savedWithLines() throws Exception {
        String token = bearer(medEmail);
        String body = String.format("""
                {
                  "type": "DRUG",
                  "allergyOverride": false,
                  "lines": [
                    {
                      "medicationId": "%s",
                      "dosage": "1 comprimé matin et soir",
                      "frequency": "2x/jour",
                      "duration": "7 jours",
                      "quantity": 1
                    }
                  ]
                }
                """, paracetamolId);

        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("DRUG"))
                .andExpect(jsonPath("$.lines.length()").value(1))
                .andExpect(jsonPath("$.lines[0].dosage").value("1 comprimé matin et soir"))
                .andReturn();

        String rxId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        // GET by ID
        mockMvc.perform(get("/api/prescriptions/" + rxId).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(rxId));

        // GET by consultation
        mockMvc.perform(get("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void createDrugPrescription_allergyConflict_returns422() throws Exception {
        String token = bearer(medEmail);

        // Create consultation for penicillin-allergic patient
        UUID allergyConsultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, allergyConsultationId, patientPenicillinId, medId);

        String body = String.format("""
                {
                  "type": "DRUG",
                  "allergyOverride": false,
                  "lines": [
                    {
                      "medicationId": "%s",
                      "dosage": "1 gélule 3x/jour",
                      "duration": "7 jours"
                    }
                  ]
                }
                """, amoxicillineId);

        mockMvc.perform(post("/api/consultations/" + allergyConsultationId + "/prescriptions")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value("allergy-conflict"))
                .andExpect(jsonPath("$.medication").value("Amoxicilline 500"))
                .andExpect(jsonPath("$.status").value(422));
    }

    @Test
    void createDrugPrescription_allergyOverride_savedSuccessfully() throws Exception {
        String token = bearer(medEmail);

        UUID allergyConsultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, allergyConsultationId, patientPenicillinId, medId);

        String body = String.format("""
                {
                  "type": "DRUG",
                  "allergyOverride": true,
                  "allergyOverrideReason": "Seul antibiotique disponible, risque bénéfice évalué",
                  "lines": [
                    {
                      "medicationId": "%s",
                      "dosage": "1 gélule 3x/jour",
                      "duration": "5 jours"
                    }
                  ]
                }
                """, amoxicillineId);

        mockMvc.perform(post("/api/consultations/" + allergyConsultationId + "/prescriptions")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.allergyOverride").value(true));
    }

    @Test
    void getPrescriptionPdf_returns200WithPdfBody() throws Exception {
        String token = bearer(medEmail);

        // Create a prescription first
        String body = String.format("""
                {
                  "type": "DRUG",
                  "allergyOverride": false,
                  "lines": [
                    {
                      "medicationId": "%s",
                      "dosage": "500mg",
                      "frequency": "3x/jour",
                      "duration": "7 jours"
                    }
                  ]
                }
                """, paracetamolId);

        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated()).andReturn();

        String rxId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        byte[] pdfBytes = mockMvc.perform(get("/api/prescriptions/" + rxId + "/pdf")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(pdfBytes).hasSizeGreaterThan(0);
        // PDF magic bytes: %PDF
        assertThat(new String(pdfBytes, 0, 4)).isEqualTo("%PDF");
    }

    // ── Certificat médical (type=CERT) ────────────────────────────────────────
    //
    // Verrouille le branchement template `certificat.html` pour CERT et le
    // PDF de sortie. La consultation doit toujours être en BROUILLON pour
    // accepter une prescription, mais le certificat lui-même n'a pas
    // d'autre champ qu'un freeText (corps libre).
    @Test
    void createCertificat_then_pdf_returnsValidPdf() throws Exception {
        String token = bearer(medEmail);

        String body = """
                {
                  "type": "CERT",
                  "allergyOverride": false,
                  "lines": [
                    { "freeText": "Le patient est apte à reprendre toutes ses activités sportives sans contre-indication médicale." }
                  ]
                }
                """;

        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("CERT"))
                .andExpect(jsonPath("$.lines[0].freeText").exists())
                .andReturn();

        String rxId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        byte[] pdfBytes = mockMvc.perform(get("/api/prescriptions/" + rxId + "/pdf")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(pdfBytes).hasSizeGreaterThan(0);
        assertThat(new String(pdfBytes, 0, 4)).isEqualTo("%PDF");
    }
}
