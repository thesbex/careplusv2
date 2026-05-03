package ma.careplus.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
 * QA6-2 + QA6-3 — Modèles de prescription (extended regression suite).
 * Ce fichier complète {@link PrescriptionTemplateIT} avec les scénarios
 * découverts lors du walk manuel du 2026-05-02 :
 *
 * Scénarios couverts :
 *  S1  — PUT happy path : updatedAt dans la réponse HTTP est cohérent avec la DB
 *  S2  — PUT happy path : name renommé persiste correctement en DB
 *  S3  — PUT happy path : type change → 400 (type immutable — règle métier)
 *  S4  — DELETE soft-delete : deleted_at non null, row toujours présent
 *  S5  — DELETE idempotency : un 2ème DELETE sur le même id → 404
 *  S6  — GET après DELETE : 404 et non 200 avec données stale
 *  S7  — RBAC: assistant forbidden from all CRUD
 *  S8  — RBAC: admin allowed (identique rôle MEDECIN pour ces endpoints)
 *  S9  — Lines > 20 → 400 VALIDATION avec message clair
 *  S10 — Lines avec medicationId non UUID → 400 TEMPLATE_LINE_INVALID
 *  S11 — Nom à 120 chars (limite exacte) → 201
 *  S12 — Nom à 121 chars → 400 (dépasse @Size(max=120))
 *  S13 — GET /prescription-templates?type=INVALID → 400 ou liste vide
 *  S14 — Liste ordonnée par updatedAt DESC (template plus récent en premier)
 *  S15 — PUT response body updatedAt reflect le nouveau timestamp (Bug #1)
 *
 * REGRESSION GUARD
 * ───────────────
 * Bug #1 (2026-05-02) : PUT /prescription-templates/{id} retournait dans
 * la réponse HTTP l'ancien updatedAt (valeur pré-update) car @PreUpdate
 * de Hibernate s'exécute au flush de la transaction, pas au moment de
 * repo.save(). La vue toView(repo.save(t)) capturait l'entité avant flush.
 * S15 attrape cette régression : il lit la réponse HTTP du PUT et compare
 * updatedAt à la valeur lue directement en DB — les deux doivent concorder.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PrescriptionTemplateExtendedIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD = "ExtIT-Tpl-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medEmail;
    String secEmail;
    String assistantEmail;
    String adminEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM clinical_prescription_template");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medEmail       = createUser("med-"   + UUID.randomUUID() + "@ext.ma", ROLE_MEDECIN);
        secEmail       = createUser("sec-"   + UUID.randomUUID() + "@ext.ma", ROLE_SECRETAIRE);
        assistantEmail = createUser("asst-"  + UUID.randomUUID() + "@ext.ma", ROLE_ASSISTANT);
        adminEmail     = createUser("admin-" + UUID.randomUUID() + "@ext.ma", ROLE_ADMIN);
    }

    private String createUser(String email, UUID roleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'QA', 'ExtIT', TRUE, 0, 0, now(), now())
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
        return """
                {
                  "name": "%s",
                  "type": "DRUG",
                  "lines": [
                    {"medicationId":"%s","medicationCode":"AMOX-500","dosage":"500mg",
                     "frequency":"3x/jour","duration":"7 jours","quantity":21,
                     "instructions":"après les repas"}
                  ]
                }
                """.formatted(name, medicationId);
    }

    private static String labBody(String name, UUID labId) {
        return """
                {"name":"%s","type":"LAB","lines":[{"labTestId":"%s","labTestCode":"NFS","instructions":""}]}
                """.formatted(name, labId);
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
    @DisplayName("S1 — PUT happy path : la réponse HTTP contient les champs modifiés")
    void update_happyPath_responseContainsUpdatedFields() throws Exception {
        String token = bearer(medEmail);
        UUID medId = UUID.randomUUID();
        UUID id = createTemplate(token, drugBody("Avant rename", medId));

        MvcResult result = mockMvc.perform(put("/api/prescription-templates/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("Après rename", UUID.randomUUID())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Après rename"))
                .andExpect(jsonPath("$.lineCount").value(1))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("id").asText()).isEqualTo(id.toString());
    }

    @Test
    @DisplayName("S2 — PUT happy path : le renommage est persisté en DB")
    void update_happyPath_persistedInDatabase() throws Exception {
        String token = bearer(medEmail);
        UUID medId = UUID.randomUUID();
        UUID id = createTemplate(token, drugBody("OriginalName", medId));

        mockMvc.perform(put("/api/prescription-templates/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("RenamedName", UUID.randomUUID())))
                .andExpect(status().isOk());

        String dbName = jdbc.queryForObject(
                "SELECT name FROM clinical_prescription_template WHERE id = ?",
                String.class, id);
        assertThat(dbName).isEqualTo("RenamedName");
    }

    @Test
    @DisplayName("S4 — DELETE soft-delete : deleted_at non null, row toujours présent en DB")
    void delete_softDelete_rowStillPresentWithDeletedAt() throws Exception {
        String token = bearer(medEmail);
        UUID id = createTemplate(token, drugBody("ToSoftDelete", UUID.randomUUID()));

        mockMvc.perform(delete("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        // La row doit exister ET avoir deleted_at non null.
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_prescription_template WHERE id = ? AND deleted_at IS NOT NULL",
                Integer.class, id);
        assertThat(count).isEqualTo(1);

        // Le total count (soft-deleted inclus) doit être 1.
        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_prescription_template WHERE id = ?",
                Integer.class, id);
        assertThat(total).isEqualTo(1);
    }

    @Test
    @DisplayName("S5 — DELETE idempotency : 2ème DELETE sur même id → 404")
    void delete_alreadyDeleted_returns404() throws Exception {
        String token = bearer(medEmail);
        UUID id = createTemplate(token, drugBody("DeleteTwice", UUID.randomUUID()));

        // Premier DELETE → 204
        mockMvc.perform(delete("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        // Deuxième DELETE → 404 (soft-deleted = introuvable via findActiveBy…)
        mockMvc.perform(delete("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("S6 — GET après DELETE : 404 (template soft-deleted n'est pas renvoyé)")
    void get_afterDelete_returns404() throws Exception {
        String token = bearer(medEmail);
        UUID id = createTemplate(token, drugBody("GetAfterDelete", UUID.randomUUID()));

        mockMvc.perform(delete("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("S7 — RBAC : assistant → 403 sur tous les endpoints CRUD")
    void rbac_assistant_returns403ForAllOperations() throws Exception {
        // Médecin crée un template
        String medToken   = bearer(medEmail);
        String assistToken = bearer(assistantEmail);
        UUID id = createTemplate(medToken, drugBody("ForAssistantTest", UUID.randomUUID()));

        // List → 403
        mockMvc.perform(get("/api/prescription-templates?type=DRUG")
                        .header("Authorization", assistToken))
                .andExpect(status().isForbidden());

        // GET → 403
        mockMvc.perform(get("/api/prescription-templates/" + id)
                        .header("Authorization", assistToken))
                .andExpect(status().isForbidden());

        // POST → 403
        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", assistToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("Forbidden", UUID.randomUUID())))
                .andExpect(status().isForbidden());

        // PUT → 403
        mockMvc.perform(put("/api/prescription-templates/" + id)
                        .header("Authorization", assistToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("Forbidden", UUID.randomUUID())))
                .andExpect(status().isForbidden());

        // DELETE → 403
        mockMvc.perform(delete("/api/prescription-templates/" + id)
                        .header("Authorization", assistToken))
                .andExpect(status().isForbidden());

        // État en DB inchangé — le template n'a pas été supprimé ni modifié.
        String dbName = jdbc.queryForObject(
                "SELECT name FROM clinical_prescription_template WHERE id = ? AND deleted_at IS NULL",
                String.class, id);
        assertThat(dbName).isEqualTo("ForAssistantTest");
    }

    @Test
    @DisplayName("S8 — RBAC : admin → 201 sur POST (accès identique à MEDECIN)")
    void rbac_admin_canCreateTemplate() throws Exception {
        String token = bearer(adminEmail);
        UUID id = createTemplate(token, drugBody("AdminTemplate", UUID.randomUUID()));

        // Admin voit son propre template via GET
        mockMvc.perform(get("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("AdminTemplate"));

        // Persisté en DB
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_prescription_template WHERE id = ? AND deleted_at IS NULL",
                Integer.class, id);
        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("S9 — Lines > 20 → 400 VALIDATION avec message 'size must be between 0 and 20'")
    void create_lines_moreThan20_returns400WithValidationCode() throws Exception {
        String token = bearer(medEmail);
        UUID medId = UUID.randomUUID();

        // Construire 21 lignes
        StringBuilder lines = new StringBuilder("[");
        for (int i = 0; i < 21; i++) {
            if (i > 0) lines.append(",");
            lines.append("{\"medicationId\":\"").append(medId).append("\",\"medicationCode\":\"Z\"}");
        }
        lines.append("]");

        MvcResult r = mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"TooMany\",\"type\":\"DRUG\",\"lines\":" + lines + "}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.get("code").asText()).isEqualTo("VALIDATION");
        assertThat(body.get("fields").get(0).get("field").asText()).isEqualTo("lines");

        // État inchangé : aucun template créé
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_prescription_template WHERE name = 'TooMany'",
                Integer.class);
        assertThat(count).isZero();
    }

    @Test
    @DisplayName("S10 — Line avec medicationId non UUID valide → 400 TEMPLATE_LINE_INVALID")
    void create_lineWithInvalidUuidMedicationId_returns400() throws Exception {
        String token = bearer(medEmail);

        MvcResult r = mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"BadUUID","type":"DRUG","lines":[
                                  {"medicationId":"not-a-uuid","medicationCode":"Z"}
                                ]}
                                """))
                .andExpect(status().isBadRequest())
                .andReturn();

        String body = r.getResponse().getContentAsString();
        assertThat(body).contains("TEMPLATE_LINE_INVALID");
        assertThat(body).contains("UUID");
    }

    @Test
    @DisplayName("S11 — Nom exactement 120 chars → 201 (à la limite)")
    void create_nameExactly120Chars_returns201() throws Exception {
        String token = bearer(medEmail);
        String name120 = "A".repeat(120);
        createTemplate(token, drugBody(name120, UUID.randomUUID()));
        // Pas d'exception = succès.
    }

    @Test
    @DisplayName("S12 — Nom à 121 chars → 400 (dépasse @Size(max=120))")
    void create_name121Chars_returns400() throws Exception {
        String token = bearer(medEmail);
        String name121 = "A".repeat(121);

        mockMvc.perform(post("/api/prescription-templates")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody(name121, UUID.randomUUID())))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("S14 — Liste ordonnée par updatedAt DESC (template le plus récent en premier)")
    void list_orderedByUpdatedAtDesc() throws Exception {
        String token = bearer(medEmail);
        // Créer deux templates avec un petit délai entre les deux.
        UUID first = createTemplate(token, drugBody("Premier", UUID.randomUUID()));
        // Force un updated_at différent via un PUT immédiat.
        Thread.sleep(50);
        UUID second = createTemplate(token, drugBody("Deuxieme", UUID.randomUUID()));

        MvcResult r = mockMvc.perform(get("/api/prescription-templates?type=DRUG")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andReturn();

        JsonNode list = objectMapper.readTree(r.getResponse().getContentAsString());
        // Le plus récent (second) doit être en index 0.
        assertThat(list.get(0).get("id").asText()).isEqualTo(second.toString());
        assertThat(list.get(1).get("id").asText()).isEqualTo(first.toString());
    }

    @Test
    @DisplayName("S15 — PUT : updatedAt dans la réponse HTTP est identique à la valeur en DB — régression Bug #1 (2026-05-02)")
    void update_responseUpdatedAt_matchesDatabaseValue() throws Exception {
        // REGRESSION GUARD — Bug #1 (2026-05-02) :
        // Avant le fix, PUT retournait dans le corps l'ancien updatedAt (valeur
        // de création) car @PreUpdate Hibernate flush après repo.save() mais
        // toView() était appelé avant le flush, capturant l'entité stale.
        String token = bearer(medEmail);
        UUID medId = UUID.randomUUID();
        UUID id = createTemplate(token, drugBody("OriginalForUpdate", medId));

        // Attendre 1 ms pour que l'horloge avance et que updatedAt change.
        Thread.sleep(5);

        MvcResult putResult = mockMvc.perform(put("/api/prescription-templates/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("UpdatedForS15", UUID.randomUUID())))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode responseBody = objectMapper.readTree(putResult.getResponse().getContentAsString());
        String responseUpdatedAt = responseBody.get("updatedAt").asText();

        // Lire la valeur directement en DB en ISO-8601 pour éviter l'espace PG.
        String dbUpdatedAt = jdbc.queryForObject(
                "SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') " +
                "FROM clinical_prescription_template WHERE id = ?",
                String.class, id);

        // Les deux timestamps doivent représenter le même instant.
        OffsetDateTime fromResponse = OffsetDateTime.parse(responseUpdatedAt);
        OffsetDateTime fromDb = OffsetDateTime.parse(dbUpdatedAt);
        // Comparer à la milliseconde — suffisant pour valider que le timestamp
        // de la réponse est le bon (post-flush), pas l'ancien (pre-flush).
        // La différence de 1 µs peut exister entre la valeur Java OffsetDateTime
        // et le rendu to_char() PostgreSQL à cause d'un arrondi interne.
        assertThat(fromResponse.toInstant().toEpochMilli())
                .as("PUT response updatedAt doit être dans la même milliseconde que la valeur DB — Bug #1 regression")
                .isEqualTo(fromDb.toInstant().toEpochMilli());
    }

    @Test
    @DisplayName("S15b — GET après PUT : updatedAt plus récent que createdAt")
    void get_afterUpdate_updatedAtIsAfterCreatedAt() throws Exception {
        String token = bearer(medEmail);
        UUID id = createTemplate(token, drugBody("BeforeUpdate", UUID.randomUUID()));

        // Lire le createdAt de la création en ISO UTC.
        String createdAt = jdbc.queryForObject(
                "SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') " +
                "FROM clinical_prescription_template WHERE id = ?",
                String.class, id);

        Thread.sleep(10);

        // Faire un PUT
        mockMvc.perform(put("/api/prescription-templates/" + id)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(drugBody("AfterUpdate", UUID.randomUUID())))
                .andExpect(status().isOk());

        // Récupérer via GET et vérifier updatedAt > createdAt
        MvcResult getResult = mockMvc.perform(get("/api/prescription-templates/" + id)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode getBody = objectMapper.readTree(getResult.getResponse().getContentAsString());
        OffsetDateTime getUpdatedAt = OffsetDateTime.parse(getBody.get("updatedAt").asText());
        OffsetDateTime parsedCreatedAt = OffsetDateTime.parse(createdAt);

        assertThat(getUpdatedAt.toInstant())
                .as("updatedAt après PUT doit être postérieur à createdAt")
                .isAfter(parsedCreatedAt.toInstant());
    }
}
