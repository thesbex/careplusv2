package ma.careplus.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V038 — workflow demandes internes LAB / RADIO.
 *
 * <p>Construit comme un walk QA manuel : chaque scénario reflète l'action
 * qu'un testeur ferait pas-à-pas dans l'IHM. La walk Playwright correspondante
 * a été exécutée le 2026-05-09 (Lila Labo : login → /queue/lab → claim → upload
 * → DONE).
 *
 * <p>SCÉNARIOS COUVERTS :
 * <ul>
 *  <li>1. Création ligne LAB internal=true (lab_internal actif) → status
 *        PENDING + internal_assigned_at horodaté.</li>
 *  <li>2. Création ligne IMAGING internal=true (imaging_internal actif) →
 *        status PENDING.</li>
 *  <li>3. Flag établissement éteint → internal=true est ignoré silencieusement,
 *        status reste NULL (aucune demande dans la queue).</li>
 *  <li>4. Queue filtrée par service : LAB voit la ligne LAB, pas la IMAGING,
 *        et inversement.</li>
 *  <li>5. Claim par LAB technicien : PENDING → IN_PROGRESS, internal_claimed_by
 *        pointe sur le user.</li>
 *  <li>6. <b>Regression guard 2026-05-09</b> : RADIO essaie de claim une ligne
 *        LAB → 403, status DB reste PENDING (la transaction du service ne doit
 *        pas commit avant le contrôle de rôle — cf. fix de8c7a4).</li>
 *  <li>7. Re-claim d'une ligne déjà IN_PROGRESS → 409 INT-INVALID-STATE.</li>
 *  <li>8. Upload résultat sur ligne IN_PROGRESS → 200, et auto-transition vers
 *        DONE + result_document_id renseigné (V015 + V038 integration).</li>
 *  <li>9. Cancel par MEDECIN sur ligne PENDING → CANCELLED. LAB ne peut pas
 *        cancel (403).</li>
 *  <li>10. Cancel après DONE → 409 INT-ALREADY-DONE (pas de rétroaction).</li>
 *  <li>11. Service param invalide → 400 INT-INVALID-SERVICE.</li>
 *  <li>12. RBAC list : SECRETAIRE 403, LAB 200.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class InternalRequestIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID ROLE_RADIO      = UUID.fromString("00000000-0000-0000-0000-000000000005");
    private static final UUID ROLE_LAB        = UUID.fromString("00000000-0000-0000-0000-000000000006");
    private static final String PWD = "Internal-Test-2026!";
    private static final byte[] TINY_PDF = "%PDF-1.4 fake bytes".getBytes();

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail, medEmail, adminEmail, labEmail, radioEmail;
    UUID medId, labUserId, radioUserId;
    UUID patientId, consultationId, labTestId, imagingExamId;
    final Map<String, String> tokenCache = new HashMap<>();

    @BeforeEach
    void seed() {
        tokenCache.clear();
        rateLimitFilter.clearBucketsForTests();

        // Ordre FK-safe.
        jdbc.update("UPDATE clinical_prescription_line SET result_document_id = NULL");
        jdbc.update("UPDATE clinical_prescription_line SET internal_claimed_by = NULL");
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
        jdbc.update("DELETE FROM catalog_imaging_exam WHERE name LIKE 'IT-%'");

        // V038 — par défaut les deux services internes sont actifs pour le
        // happy path (les tests qui veulent les éteindre le feront en local).
        jdbc.update("UPDATE configuration_clinic_settings SET lab_internal = TRUE, imaging_internal = TRUE");

        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        medEmail   = seedUser("med",   ROLE_MEDECIN);
        adminEmail = seedUser("admin", ROLE_ADMIN);
        labEmail   = seedUser("lab",   ROLE_LAB);
        radioEmail = seedUser("radio", ROLE_RADIO);

        medId       = jdbc.queryForObject("SELECT id FROM identity_user WHERE email = ?", UUID.class, medEmail);
        labUserId   = jdbc.queryForObject("SELECT id FROM identity_user WHERE email = ?", UUID.class, labEmail);
        radioUserId = jdbc.queryForObject("SELECT id FROM identity_user WHERE email = ?", UUID.class, radioEmail);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'Internal', 'Test', 'M', '1990-01-01', 'IT-INT-001',
                        0, 0, 'ACTIF', now(), now())
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
                VALUES (?, 'IT-NFS', 'IT-Numération Formule Sanguine', 'HEMATOLOGY', TRUE, now(), now())
                """, labTestId);

        imagingExamId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_imaging_exam (id, code, name, modality, active, created_at, updated_at)
                VALUES (?, 'IT-RX-THX', 'IT-Radio thorax', 'RADIO', TRUE, now(), now())
                """, imagingExamId);
    }

    @Test
    @DisplayName("1. Création ligne LAB internal=true → status PENDING + internal_assigned_at horodaté")
    void labLineWithInternalFlag_persistsAsPending() throws Exception {
        UUID lineId = createInternalLine("LAB");

        // Status PENDING en base, et le timestamp est posé à l'instant.
        String status = jdbc.queryForObject(
                "SELECT internal_status FROM clinical_prescription_line WHERE id = ?",
                String.class, lineId);
        assertThat(status).isEqualTo("PENDING");

        OffsetDateTime assignedAt = jdbc.queryForObject(
                "SELECT internal_assigned_at FROM clinical_prescription_line WHERE id = ?",
                OffsetDateTime.class, lineId);
        assertThat(assignedAt).isNotNull();
        assertThat(assignedAt).isAfter(OffsetDateTime.now().minusMinutes(1));
    }

    @Test
    @DisplayName("2. Création ligne IMAGING internal=true → status PENDING (queue RADIO)")
    void imagingLineWithInternalFlag_persistsAsPending() throws Exception {
        UUID lineId = createInternalLine("IMAGING");

        String status = jdbc.queryForObject(
                "SELECT internal_status FROM clinical_prescription_line WHERE id = ?",
                String.class, lineId);
        assertThat(status).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("3. lab_internal=false → internal=true est ignoré, status reste NULL")
    void disabledFlag_silentlyIgnoresInternalRequest() throws Exception {
        jdbc.update("UPDATE configuration_clinic_settings SET lab_internal = FALSE");

        UUID lineId = createInternalLine("LAB");

        String status = jdbc.queryForObject(
                "SELECT internal_status FROM clinical_prescription_line WHERE id = ?",
                String.class, lineId);
        assertThat(status).isNull();
    }

    @Test
    @DisplayName("4. Queue LAB filtre les lignes IMAGING (et inversement)")
    void queueIsFilteredByService() throws Exception {
        UUID labLineId = createInternalLine("LAB");
        UUID imagingLineId = createInternalLine("IMAGING");

        // LAB ne voit que la ligne LAB.
        MvcResult labQ = mockMvc.perform(get("/api/internal-requests")
                        .param("service", "LAB")
                        .param("status", "PENDING")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode labRows = objectMapper.readTree(labQ.getResponse().getContentAsString());
        assertThat(labRows).hasSize(1);
        assertThat(labRows.get(0).get("lineId").asText()).isEqualTo(labLineId.toString());

        // RADIO ne voit que la ligne IMAGING.
        MvcResult radioQ = mockMvc.perform(get("/api/internal-requests")
                        .param("service", "RADIO")
                        .param("status", "PENDING")
                        .header("Authorization", bearer(radioEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode radioRows = objectMapper.readTree(radioQ.getResponse().getContentAsString());
        assertThat(radioRows).hasSize(1);
        assertThat(radioRows.get(0).get("lineId").asText()).isEqualTo(imagingLineId.toString());
    }

    @Test
    @DisplayName("5. Claim LAB → PENDING → IN_PROGRESS, internal_claimed_by renseigné")
    void labClaim_transitionsToInProgress() throws Exception {
        UUID lineId = createInternalLine("LAB");

        mockMvc.perform(post("/api/internal-requests/" + lineId + "/claim")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        String status = jdbc.queryForObject(
                "SELECT internal_status FROM clinical_prescription_line WHERE id = ?",
                String.class, lineId);
        assertThat(status).isEqualTo("IN_PROGRESS");

        UUID claimedBy = jdbc.queryForObject(
                "SELECT internal_claimed_by FROM clinical_prescription_line WHERE id = ?",
                UUID.class, lineId);
        assertThat(claimedBy).isEqualTo(labUserId);
    }

    @Test
    @DisplayName("6. Regression 2026-05-09 — RADIO claim sur ligne LAB → 403 + DB intacte")
    void crossServiceClaim_returns403AndDoesNotMutate() throws Exception {
        UUID lineId = createInternalLine("LAB");

        mockMvc.perform(post("/api/internal-requests/" + lineId + "/claim")
                        .header("Authorization", bearer(radioEmail)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INT-WRONG-SERVICE"));

        // Critique : le bug initial était que la transaction du service commit
        // la transition AVANT que le 403 du controller ne soit levé. La ligne
        // doit donc rester PENDING + claimed_by NULL.
        String status = jdbc.queryForObject(
                "SELECT internal_status FROM clinical_prescription_line WHERE id = ?",
                String.class, lineId);
        assertThat(status).isEqualTo("PENDING");

        UUID claimedBy = jdbc.queryForObject(
                "SELECT internal_claimed_by FROM clinical_prescription_line WHERE id = ?",
                UUID.class, lineId);
        assertThat(claimedBy).isNull();
    }

    @Test
    @DisplayName("7. Re-claim d'une ligne IN_PROGRESS → 409 INT-INVALID-STATE")
    void claimAlreadyInProgress_returns409() throws Exception {
        UUID lineId = createInternalLine("LAB");
        // Premier claim OK
        mockMvc.perform(post("/api/internal-requests/" + lineId + "/claim")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk());

        // Second claim doit échouer.
        mockMvc.perform(post("/api/internal-requests/" + lineId + "/claim")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INT-INVALID-STATE"));
    }

    @Test
    @DisplayName("8. Upload résultat sur ligne IN_PROGRESS → DONE + result_document_id renseigné")
    void uploadResult_autoTransitionsToDone() throws Exception {
        UUID lineId = createInternalLine("LAB");

        // Claim d'abord pour passer en IN_PROGRESS.
        mockMvc.perform(post("/api/internal-requests/" + lineId + "/claim")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk());

        // Upload.
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "result.pdf", "application/pdf", TINY_PDF);
        MvcResult r = mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                        .file(pdf)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk())
                .andReturn();
        UUID docId = UUID.fromString(
                objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());

        // V038 : transition automatique IN_PROGRESS → DONE déclenchée par
        // DocumentService.attachResult.
        String status = jdbc.queryForObject(
                "SELECT internal_status FROM clinical_prescription_line WHERE id = ?",
                String.class, lineId);
        assertThat(status).isEqualTo("DONE");

        // V015 : result_document_id pointe sur le PDF uploadé.
        UUID resultId = jdbc.queryForObject(
                "SELECT result_document_id FROM clinical_prescription_line WHERE id = ?",
                UUID.class, lineId);
        assertThat(resultId).isEqualTo(docId);
    }

    @Test
    @DisplayName("9. Cancel par MEDECIN → CANCELLED ; LAB ne peut pas cancel (403)")
    void cancelByMedecin_andLabForbidden() throws Exception {
        UUID lineId = createInternalLine("LAB");

        // LAB tente cancel → 403 (Spring @PreAuthorize).
        mockMvc.perform(post("/api/internal-requests/" + lineId + "/cancel")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isForbidden());

        // MEDECIN cancel → CANCELLED.
        mockMvc.perform(post("/api/internal-requests/" + lineId + "/cancel")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        String status = jdbc.queryForObject(
                "SELECT internal_status FROM clinical_prescription_line WHERE id = ?",
                String.class, lineId);
        assertThat(status).isEqualTo("CANCELLED");
    }

    @Test
    @DisplayName("10. Cancel après DONE → 409 INT-ALREADY-DONE")
    void cancelAfterDone_returns409() throws Exception {
        UUID lineId = createInternalLine("LAB");
        mockMvc.perform(post("/api/internal-requests/" + lineId + "/claim")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk());
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "result.pdf", "application/pdf", TINY_PDF);
        mockMvc.perform(multipart("/api/prescriptions/lines/" + lineId + "/result")
                        .file(pdf)
                        .with(req -> { req.setMethod("PUT"); return req; })
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk());

        // Cancel sur DONE → refusé.
        mockMvc.perform(post("/api/internal-requests/" + lineId + "/cancel")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INT-ALREADY-DONE"));
    }

    @Test
    @DisplayName("11. Service param invalide → 400 INT-INVALID-SERVICE")
    void invalidServiceParam_returns400() throws Exception {
        mockMvc.perform(get("/api/internal-requests")
                        .param("service", "OPHTALMO")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INT-INVALID-SERVICE"));
    }

    @Test
    @DisplayName("12. RBAC list — SECRETAIRE 403, LAB 200")
    void listRbac() throws Exception {
        mockMvc.perform(get("/api/internal-requests")
                        .param("service", "LAB")
                        .header("Authorization", bearer(secEmail)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/internal-requests")
                        .param("service", "LAB")
                        .header("Authorization", bearer(labEmail)))
                .andExpect(status().isOk());
    }

    // ---------- helpers ----------

    /**
     * Crée une prescription via l'API avec une ligne LAB ou IMAGING marquée
     * internal=true. Retourne l'id de la ligne. Suit le contrat HTTP réel.
     */
    private UUID createInternalLine(String type) throws Exception {
        String body = switch (type) {
            case "LAB" -> """
                    {"type":"LAB","lines":[{"labTestId":"%s","instructions":"À jeun","internal":true}]}
                    """.formatted(labTestId);
            case "IMAGING" -> """
                    {"type":"IMAGING","lines":[{"imagingExamId":"%s","instructions":"Profil","internal":true}]}
                    """.formatted(imagingExamId);
            default -> throw new IllegalArgumentException(type);
        };
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prescriptions")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode root = objectMapper.readTree(r.getResponse().getContentAsString());
        return UUID.fromString(root.get("lines").get(0).get("id").asText());
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
        if (tokenCache.containsKey(email)) return tokenCache.get(email);
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
}
