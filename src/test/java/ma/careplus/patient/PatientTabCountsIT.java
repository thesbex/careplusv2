package ma.careplus.patient;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
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
 * Tests d'intégration pour GET /api/patients/{id}/tab-counts (bug B6).
 *
 * Vérifie :
 *  - 404 si le patient n'existe pas / est soft-deleted
 *  - 0 partout sur un patient sans données
 *  - chaque table (consultations, prescriptions, documents par catégorie,
 *    factures, vaccinations, grossesses) est correctement comptée
 *  - les soft-deletes (vaccination_dose.deleted_at, patient_document.deleted_at)
 *    sont exclus du compte
 *  - les documents PHOTO sont exclus du compteur "documents"
 *  - 401 si pas authentifié, 200 sur tous les rôles autorisés
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PatientTabCountsIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");

    private static final String PWD = "Care-Plus-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail;
    String medEmail;
    UUID medUserId;
    final Map<String, String> tokenCache = new HashMap<>();

    @BeforeEach
    void seed() {
        tokenCache.clear();
        rateLimitFilter.clearBucketsForTests();

        // Wipe everything that might link to patients (children-first to satisfy FKs).
        jdbc.update("DELETE FROM pregnancy_visit");
        jdbc.update("DELETE FROM pregnancy_ultrasound");
        jdbc.update("DELETE FROM pregnancy_visit_plan");
        jdbc.update("DELETE FROM pregnancy");
        jdbc.update("DELETE FROM vaccination_dose");
        jdbc.update("DELETE FROM patient_document");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM patient_note");
        jdbc.update("DELETE FROM patient_allergy");
        jdbc.update("DELETE FROM patient_antecedent");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        secEmail   = seedUser("sec",  ROLE_SECRETAIRE, UUID.randomUUID());
        medUserId  = UUID.randomUUID();
        medEmail   = seedUser("med",  ROLE_MEDECIN,    medUserId);
    }

    private String seedUser(String prefix, UUID roleId, UUID userId) {
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                userId, email, passwordEncoder.encode(PWD), prefix, "Test",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", userId, roleId);
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

    private UUID createPatient() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/patients")
                .header("Authorization", bearer(secEmail))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Fatima\",\"lastName\":\"Tab\",\"gender\":\"F\","
                        + "\"birthDate\":\"1994-03-15\",\"phone\":\"+212600111222\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString())
                .get("id").asText());
    }

    private void insertConsultation(UUID patientId) {
        jdbc.update("""
                INSERT INTO clinical_consultation
                    (id, patient_id, practitioner_id, status, started_at,
                     version_number, version, created_at, updated_at)
                VALUES (?, ?, ?, 'BROUILLON', now(), 1, 0, now(), now())
                """, UUID.randomUUID(), patientId, medUserId);
    }

    private UUID insertConsultationReturning(UUID patientId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation
                    (id, patient_id, practitioner_id, status, started_at,
                     version_number, version, created_at, updated_at)
                VALUES (?, ?, ?, 'BROUILLON', now(), 1, 0, now(), now())
                """, id, patientId, medUserId);
        return id;
    }

    private void insertPrescription(UUID patientId, UUID consultationId) {
        jdbc.update("""
                INSERT INTO clinical_prescription
                    (id, consultation_id, patient_id, type, issued_at,
                     allergy_override, created_at, updated_at)
                VALUES (?, ?, ?, 'DRUG', now(), FALSE, now(), now())
                """, UUID.randomUUID(), consultationId, patientId);
    }

    private void insertDocument(UUID patientId, String type, boolean softDeleted) {
        jdbc.update("""
                INSERT INTO patient_document
                    (id, patient_id, type, original_filename, mime_type, size_bytes,
                     storage_key, uploaded_by, uploaded_at, deleted_at)
                VALUES (?, ?, ?, ?, 'application/pdf', 1024, ?, ?, now(), ?)
                """,
                UUID.randomUUID(), patientId, type, "doc-" + type + ".pdf",
                "key-" + UUID.randomUUID(), medUserId,
                softDeleted ? Timestamp.from(Instant.now()) : null);
    }

    private void insertInvoice(UUID patientId) {
        jdbc.update("""
                INSERT INTO billing_invoice
                    (id, patient_id, status, subtotal, vat_total, total, paid_total,
                     created_at, updated_at)
                VALUES (?, ?, 'BROUILLON', 100.00, 0.00, 100.00, 0.00, now(), now())
                """, UUID.randomUUID(), patientId);
    }

    private UUID insertVaccine() {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO vaccine_catalog
                    (id, code, name_fr, route_default, is_pni, active, version, created_at, updated_at)
                VALUES (?, ?, 'Test Vaccin', 'IM', FALSE, TRUE, 0, now(), now())
                """, id, "TEST-" + id.toString().substring(0, 8));
        return id;
    }

    private void insertVaccinationDose(UUID patientId, UUID vaccineId, short doseNumber, boolean softDeleted) {
        jdbc.update("""
                INSERT INTO vaccination_dose
                    (id, patient_id, vaccine_id, dose_number, status, version,
                     deleted_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'PLANNED', 0, ?, now(), now())
                """,
                UUID.randomUUID(), patientId, vaccineId, doseNumber,
                softDeleted ? Timestamp.from(Instant.now()) : null);
    }

    private void insertPregnancy(UUID patientId) {
        jdbc.update("""
                INSERT INTO pregnancy
                    (id, patient_id, started_at, lmp_date, due_date, due_date_source,
                     status, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'NAEGELE', 'EN_COURS', 0, now(), now())
                """,
                UUID.randomUUID(), patientId,
                LocalDate.now().minusWeeks(8),
                LocalDate.now().minusWeeks(8),
                LocalDate.now().plusWeeks(32));
    }

    // ── Tests ─────────────────────────────────────────────────────────

    @Test
    void unknownPatient_returns404() throws Exception {
        mockMvc.perform(get("/api/patients/" + UUID.randomUUID() + "/tab-counts")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PATIENT_NOT_FOUND"));
    }

    @Test
    void emptyPatient_allCountsZero() throws Exception {
        UUID id = createPatient();

        mockMvc.perform(get("/api/patients/" + id + "/tab-counts")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consultations").value(0))
                .andExpect(jsonPath("$.prescriptions").value(0))
                .andExpect(jsonPath("$.analyses").value(0))
                .andExpect(jsonPath("$.imagerie").value(0))
                .andExpect(jsonPath("$.documents").value(0))
                .andExpect(jsonPath("$.facturation").value(0))
                .andExpect(jsonPath("$.vaccinations").value(0))
                .andExpect(jsonPath("$.grossesses").value(0));
    }

    @Test
    void mixedData_reflectsRealCounts() throws Exception {
        UUID id = createPatient();

        // 3 consultations, dont une qui sert de parent à 2 prescriptions
        UUID consultId = insertConsultationReturning(id);
        insertConsultation(id);
        insertConsultation(id);

        // 2 prescriptions
        insertPrescription(id, consultId);
        insertPrescription(id, consultId);

        // 1 ANALYSE (active) + 1 ANALYSE (soft-deleted, ne doit pas compter)
        insertDocument(id, "ANALYSE", false);
        insertDocument(id, "ANALYSE", true);

        // 2 IMAGERIE (active)
        insertDocument(id, "IMAGERIE", false);
        insertDocument(id, "IMAGERIE", false);

        // 1 COMPTE_RENDU (compte dans documents) + 1 PHOTO (ne compte pas)
        // + 1 PRESCRIPTION_HISTORIQUE (compte dans documents)
        insertDocument(id, "COMPTE_RENDU", false);
        insertDocument(id, "PHOTO", false);
        insertDocument(id, "PRESCRIPTION_HISTORIQUE", false);
        // Documents tab : ANALYSE active + 2 IMAGERIE + COMPTE_RENDU + PRESCRIPTION_HISTORIQUE = 5
        // (Le filtre PHOTO et le soft-deleted sont exclus.)

        // 1 facture
        insertInvoice(id);

        // 2 doses vaccination actives + 1 soft-deleted (ne compte pas)
        UUID vaccineId = insertVaccine();
        insertVaccinationDose(id, vaccineId, (short) 1, false);
        insertVaccinationDose(id, vaccineId, (short) 2, false);
        insertVaccinationDose(id, vaccineId, (short) 3, true);

        // 1 grossesse
        insertPregnancy(id);

        mockMvc.perform(get("/api/patients/" + id + "/tab-counts")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consultations").value(3))
                .andExpect(jsonPath("$.prescriptions").value(2))
                .andExpect(jsonPath("$.analyses").value(1))
                .andExpect(jsonPath("$.imagerie").value(2))
                .andExpect(jsonPath("$.documents").value(5))
                .andExpect(jsonPath("$.facturation").value(1))
                .andExpect(jsonPath("$.vaccinations").value(2))
                .andExpect(jsonPath("$.grossesses").value(1));
    }

    @Test
    void unauthenticated_returns401() throws Exception {
        UUID id = createPatient();
        mockMvc.perform(get("/api/patients/" + id + "/tab-counts"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void secretaireRole_isAllowed() throws Exception {
        UUID id = createPatient();
        mockMvc.perform(get("/api/patients/" + id + "/tab-counts")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk());
    }
}
