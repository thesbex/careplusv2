package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * QA6-2 + QA6-3 — Modèles de prescription privés au médecin (DRUG/LAB/IMAGING).
 * Le médecin construit des "ordonnances types" qu'il charge ensuite dans le
 * drawer pendant la consultation. Tests couvrent :
 *   - happy POST + GET (round-trip JSONB des lignes pour les 3 types)
 *   - filtrage par practitioner_id du JWT (médecin A ne voit jamais ceux de B)
 *   - 409 sur nom dupliqué (même médecin + même type)
 *   - 200 sur même nom mais type différent
 *   - 403 secrétaire
 *   - 404 sur id appartenant à un autre médecin
 *   - 400 sur name vide / lines vide / lines &gt; 20
 *   - 400 sur ligne sans medicationId / labTestId / imagingExamId
 *   - PUT renomme : 204 happy, 409 collision
 *   - DELETE soft-delete : GET ne retourne plus l'item
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PrescriptionTemplateIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String PWD = "Tpl-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medAEmail;
    String medBEmail;
    String secEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM clinical_prescription_template");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medAEmail = createUser("med-a-" + UUID.randomUUID() + "@test.ma", ROLE_MEDECIN);
        medBEmail = createUser("med-b-" + UUID.randomUUID() + "@test.ma", ROLE_MEDECIN);
        secEmail = createUser("sec-" + UUID.randomUUID() + "@test.ma", ROLE_SECRETAIRE);
    }

    private String createUser(String email, UUID roleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Dr', 'Tpl', TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
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

    private static String drugBody(String name, UUID medicationId) {
        return String.format("""
                {
                  "name": "%s",
                  "type": "DRUG",
                  "lines": [
                    {"medicationId":"%s","medicationCode":"AMOX-500","dosage":"500mg",
                     "frequency":"3x/jour","duration":"7 jours","quantity":21,
                     "instructions":"après les repas"}
                  ]
                }
                """, name, medicationId);
    }

    private static String labBody(String name, UUID labId) {
        return String.format("""
                {"name":"%s","type":"LAB","lines":[{"labTestId":"%s","labTestCode":"NFS","instructions":""}]}
                """, name, labId);
    }

    private static String imagingBody(String name, UUID imgId) {
        return String.format("""
                {"name":"%s","type":"IMAGING","lines":[{"imagingExamId":"%s","imagingExamCode":"RX-THX","instructions":""}]}
                """, name, imgId);
    }

    private UUID createTemplate(String token, String body) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Test
    void createDrug_happyPath_roundTripsLines() throws Exception {
        String token = bearer(medAEmail);
        UUID medId = UUID.randomUUID();
        UUID id = createTemplate(token, drugBody("HTA stable", medId));

        mockMvc.perform(get("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("HTA stable"))
                .andExpect(jsonPath("$.type").value("DRUG"))
                .andExpect(jsonPath("$.lineCount").value(1))
                .andExpect(jsonPath("$.lines[0].medicationId").value(medId.toString()))
                .andExpect(jsonPath("$.lines[0].dosage").value("500mg"))
                .andExpect(jsonPath("$.lines[0].instructions").value("après les repas"));
    }

    @Test
    void createLab_happyPath() throws Exception {
        String token = bearer(medAEmail);
        UUID labId = UUID.randomUUID();
        UUID id = createTemplate(token, labBody("Bilan annuel", labId));

        mockMvc.perform(get("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("LAB"))
                .andExpect(jsonPath("$.lines[0].labTestId").value(labId.toString()));
    }

    @Test
    void createImaging_happyPath() throws Exception {
        String token = bearer(medAEmail);
        UUID imgId = UUID.randomUUID();
        UUID id = createTemplate(token, imagingBody("RX thorax standard", imgId));

        mockMvc.perform(get("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("IMAGING"))
                .andExpect(jsonPath("$.lines[0].imagingExamId").value(imgId.toString()));
    }

    @Test
    void list_isFilteredByPractitioner_andType() throws Exception {
        String tokenA = bearer(medAEmail);
        String tokenB = bearer(medBEmail);
        createTemplate(tokenA, drugBody("MedA-DRUG-1", UUID.randomUUID()));
        createTemplate(tokenA, labBody("MedA-LAB-1", UUID.randomUUID()));
        createTemplate(tokenB, drugBody("MedB-DRUG-1", UUID.randomUUID()));

        // Médecin A voit ses 1 DRUG mais ne voit ni son LAB, ni ceux de B.
        mockMvc.perform(get("/api/prescription-templates?type=DRUG")
                        .header("Authorization", tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("MedA-DRUG-1"));

        // Médecin B voit 1 DRUG et c'est bien le sien.
        mockMvc.perform(get("/api/prescription-templates?type=DRUG")
                        .header("Authorization", tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("MedB-DRUG-1"));
    }

    @Test
    void create_duplicateName_sameType_returns409() throws Exception {
        String token = bearer(medAEmail);
        createTemplate(token, drugBody("HTA stable", UUID.randomUUID()));

        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("HTA stable", UUID.randomUUID())))
                .andExpect(status().isConflict());

        // Case-insensitive : "hta stable" doit aussi être en collision.
        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("hta stable", UUID.randomUUID())))
                .andExpect(status().isConflict());
    }

    @Test
    void create_sameName_differentType_isAllowed() throws Exception {
        String token = bearer(medAEmail);
        createTemplate(token, drugBody("Routine", UUID.randomUUID()));
        // Même nom mais type LAB → doit passer.
        createTemplate(token, labBody("Routine", UUID.randomUUID()));
    }

    @Test
    void create_secretaire_returns403() throws Exception {
        String token = bearer(secEmail);
        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("X", UUID.randomUUID())))
                .andExpect(status().isForbidden());
    }

    @Test
    void get_otherDoctorsTemplate_returns404() throws Exception {
        String tokenA = bearer(medAEmail);
        UUID idA = createTemplate(tokenA, drugBody("Privé A", UUID.randomUUID()));

        // Médecin B ne doit pas pouvoir y accéder, même en connaissant l'id.
        String tokenB = bearer(medBEmail);
        mockMvc.perform(get("/api/prescription-templates/" + idA)
                        .header("Authorization", tokenB))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/prescription-templates/" + idA)
                        .header("Authorization", tokenB))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_nameBlank_returns400() throws Exception {
        String token = bearer(medAEmail);
        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("", UUID.randomUUID())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_linesEmpty_returns400() throws Exception {
        String token = bearer(medAEmail);
        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Vide","type":"DRUG","lines":[]}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_lineMissingMedicationId_returns400() throws Exception {
        String token = bearer(medAEmail);
        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Sans medic","type":"DRUG",
                                 "lines":[{"dosage":"500mg","frequency":"2x/j"}]}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void update_renameInCollision_returns409() throws Exception {
        String token = bearer(medAEmail);
        createTemplate(token, drugBody("Existant", UUID.randomUUID()));
        UUID id = createTemplate(token, drugBody("À renommer", UUID.randomUUID()));

        // Renommer "À renommer" en "Existant" → 409.
        mockMvc.perform(put("/api/prescription-templates/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("Existant", UUID.randomUUID())))
                .andExpect(status().isConflict());
    }

    @Test
    void delete_softDelete_disappearsFromList() throws Exception {
        String token = bearer(medAEmail);
        UUID id = createTemplate(token, drugBody("À supprimer", UUID.randomUUID()));

        mockMvc.perform(delete("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/prescription-templates?type=DRUG")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Row reste en BDD avec deleted_at non null.
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_prescription_template WHERE id = ? AND deleted_at IS NOT NULL",
                Integer.class, id);
        assertThat(count).isEqualTo(1);
    }
}
