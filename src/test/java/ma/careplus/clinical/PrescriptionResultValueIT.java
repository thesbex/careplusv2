package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
 * V047 — saisie structurée des résultats LAB / IMAGING + graphe d'évolution
 * dans le dossier patient.
 *
 * Scénarios :
 *   1. Bulk replace (PUT) sur une ligne LAB → 200, GET expose les 3
 *      analytes triés par sortOrder.
 *   2. Patient avec 2 prescriptions LAB séparées du même analyte Hb →
 *      GET /result-trends renvoie une série Hb à 2 points (chronologiques).
 *   3. Casing/whitespace : "Hb" et "  hb " sont groupés sur la même série.
 *   4. Ligne médicament rejetée → 400 RESULT_NOT_APPLICABLE.
 *   5. Bulk replace avec liste vide → efface toutes les valeurs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PrescriptionResultValueIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Result-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String medEmail;
    private UUID medId;
    private UUID patientId;
    private UUID consultationId;
    private UUID labTestId;
    private UUID medicationId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM clinical_prescription_result_value");
        jdbc.update("UPDATE clinical_prescription_line SET result_document_id = NULL");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM patient_document");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");
        jdbc.update("DELETE FROM catalog_lab_test WHERE name LIKE 'IT-%'");
        jdbc.update("DELETE FROM catalog_medication WHERE commercial_name LIKE 'IT-%'");

        medId = UUID.randomUUID();
        medEmail = "med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Med', 'Test', TRUE, 0, 0, ?, ?)
                """, medId, medEmail, passwordEncoder.encode(PWD),
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children,
                    status, created_at, updated_at)
                VALUES (?, 'Alami', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId);

        labTestId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_lab_test (id, code, name, category, active, created_at, updated_at)
                VALUES (?, 'IT-NFS', 'IT-NFS', 'BIOCHEMISTRY', TRUE, now(), now())
                """, labTestId);

        medicationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags,
                    favorite, active, created_at, updated_at)
                VALUES (?, 'IT-Doliprane', 'Paracétamol', 'comprimé', '1g', 'antalgique',
                        TRUE, TRUE, now(), now())
                """, medicationId);
    }

    @Test
    @DisplayName("1. Bulk replace : 3 analytes sauvés et relus dans l'ordre")
    void bulkReplace_persistsAndOrders() throws Exception {
        UUID lineId = createLabLine();
        mockMvc.perform(put("/api/prescriptions/lines/" + lineId + "/result-values")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"values":[
                                  {"analyte":"Hb","value":14.2,"unit":"g/dL"},
                                  {"analyte":"Plaquettes","value":245,"unit":"G/L"},
                                  {"analyte":"GB","value":7.1,"unit":"G/L"}
                                ]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));

        mockMvc.perform(get("/api/prescriptions/lines/" + lineId + "/result-values")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].analyte").value("Hb"))
                .andExpect(jsonPath("$[0].value").value(14.2))
                .andExpect(jsonPath("$[1].analyte").value("Plaquettes"))
                .andExpect(jsonPath("$[2].analyte").value("GB"));
    }

    @Test
    @DisplayName("2. Trend : 2 prescriptions LAB du même Hb → série à 2 points chronologiques")
    void trend_groupsAcrossPrescriptions() throws Exception {
        UUID line1 = createLabLine();
        mockMvc.perform(put("/api/prescriptions/lines/" + line1 + "/result-values")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"values":[{"analyte":"Hb","value":13.5,"unit":"g/dL"}]}
                                """))
                .andExpect(status().isOk());
        // Rollback la date de recorded_at de la 1ère mesure pour simuler "il y a 1 mois"
        // — sinon les deux points auraient la même date (now()).
        jdbc.update("UPDATE clinical_prescription_result_value SET recorded_at = now() - interval '1 month'");

        UUID line2 = createLabLine();
        mockMvc.perform(put("/api/prescriptions/lines/" + line2 + "/result-values")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"values":[{"analyte":"Hb","value":14.2,"unit":"g/dL"}]}
                                """))
                .andExpect(status().isOk());

        MvcResult r = mockMvc.perform(get("/api/patients/" + patientId + "/result-trends")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].analyte").value("Hb"))
                .andExpect(jsonPath("$[0].points.length()").value(2))
                .andReturn();
        JsonNode arr = objectMapper.readTree(r.getResponse().getContentAsString());
        // Premier point antérieur au second (tri chronologique).
        String t0 = arr.get(0).get("points").get(0).get("recordedAt").asText();
        String t1 = arr.get(0).get("points").get(1).get("recordedAt").asText();
        assertThat(t0.compareTo(t1)).isLessThan(0);
        assertThat(arr.get(0).get("points").get(0).get("value").decimalValue().toPlainString())
                .isEqualTo("13.5000");
        assertThat(arr.get(0).get("points").get(1).get("value").decimalValue().toPlainString())
                .isEqualTo("14.2000");
    }

    @Test
    @DisplayName("3. Casing/whitespace : 'Hb' et '  hb ' groupés sur la même série")
    void trend_normalizesCasingAndWhitespace() throws Exception {
        UUID line = createLabLine();
        mockMvc.perform(put("/api/prescriptions/lines/" + line + "/result-values")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"values":[
                                  {"analyte":"Hb","value":14.2,"unit":"g/dL"},
                                  {"analyte":"  hb ","value":13.9,"unit":"g/dL"}
                                ]}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/patients/" + patientId + "/result-trends")
                        .header("Authorization", bearer()))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].points.length()").value(2));
    }

    @Test
    @DisplayName("4. Ligne médicament → 400 RESULT_NOT_APPLICABLE")
    void medicationLineRejected() throws Exception {
        UUID drugLine = createDrugLine();
        mockMvc.perform(put("/api/prescriptions/lines/" + drugLine + "/result-values")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"values":[{"analyte":"Hb","value":14.2,"unit":"g/dL"}]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("RESULT_NOT_APPLICABLE"));
    }

    @Test
    @DisplayName("5. Liste vide → efface toutes les valeurs existantes")
    void emptyList_clearsAll() throws Exception {
        UUID line = createLabLine();
        mockMvc.perform(put("/api/prescriptions/lines/" + line + "/result-values")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"values":[{"analyte":"Hb","value":14.2,"unit":"g/dL"}]}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/prescriptions/lines/" + line + "/result-values")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"values\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/prescriptions/lines/" + line + "/result-values")
                        .header("Authorization", bearer()))
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ── helpers ──────────────────────────────────────────────────────

    private UUID createLabLine() throws Exception {
        String body = """
                {"type":"LAB","lines":[{"labTestId":"%s"}]}
                """.formatted(labTestId);
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("lines").get(0).get("id").asText());
    }

    private UUID createDrugLine() throws Exception {
        String body = """
                {"type":"DRUG","lines":[{"medicationId":"%s","dosage":"1 cp","frequency":"3x/j","duration":"5j","quantity":15}]}
                """.formatted(medicationId);
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("lines").get(0).get("id").asText());
    }

    private String bearer() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + medEmail + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }
}
