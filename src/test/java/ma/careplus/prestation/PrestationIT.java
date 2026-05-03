package ma.careplus.prestation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V016 — Module Prestations (catalogue + lien consultation).
 *
 * SCÉNARIOS COUVERTS :
 *  1. Catalogue seedé : 6 prestations livrées (PIQURE, ECG, …) sont
 *     listées sur GET /api/catalog/prestations.
 *  2. CRUD catalogue (admin) : POST → 201 + apparait dans la liste,
 *     PUT → label/prix mis à jour, DELETE → désactive (active=FALSE).
 *  3. Code dupliqué → 409 PRESTATION_CODE_DUPLICATE.
 *  4. Validation : code vide → 400 VALIDATION ; prix négatif → 400.
 *  5. Ajout à une consultation BROUILLON : prend le defaultPrice si
 *     unitPrice null (snapshot), retourne lineTotal calculé (price × qty).
 *  6. Override de prix : on fournit unitPrice explicite, c'est lui qui
 *     est figé (et pas le defaultPrice).
 *  7. Modification du defaultPrice catalogue APRÈS ajout : la
 *     consultation_prestation existante garde son ancien tarif (snapshot
 *     immutable).
 *  8. Total prestations : la somme renvoyée par /prestations correspond
 *     à la somme des lineTotal.
 *  9. Refus sur consultation SIGNEE → 409 CONSULT_LOCKED (immutabilité).
 * 10. Prestation inactive → 400 PRESTATION_INACTIVE à l'ajout.
 * 11. Prestation inconnue à l'ajout → 404 PRESTATION_NOT_FOUND.
 * 12. RBAC catalogue : SECRETAIRE peut LIRE (GET 200) mais pas créer
 *     (POST 403).
 * 13. RBAC consultation : ASSISTANT peut ajouter (parité MEDECIN, V010).
 * 14. DELETE link : retire la prestation de la consultation.
 * 15. Le lien apparaît bien dans /api/consultations/{id}/prestations.
 *
 * REGRESSION GUARD : le snapshot du tarif (scénario 7) protège contre
 * le bug classique où on stockerait juste un prestationId et joinerait
 * à la lecture, faisant changer rétroactivement les anciennes factures
 * dès qu'un admin met à jour un tarif.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PrestationIT {

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
    private static final String PWD = "Prest-Test-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String secEmail, asstEmail, medEmail, adminEmail;
    UUID medId;
    UUID patientId;
    UUID consultationId;
    final Map<String, String> tokenCache = new HashMap<>();

    @BeforeEach
    void seed() {
        tokenCache.clear();
        rateLimitFilter.clearBucketsForTests();

        jdbc.update("DELETE FROM clinical_consultation_prestation");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");
        // On garde le seed V016 (6 prestations livrées avec la migration),
        // mais on RESET les valeurs car les tests peuvent muter (scénario 7
        // change le defaultPrice ECG, scénario 10 désactive ECG…).
        jdbc.update("DELETE FROM catalog_prestation WHERE code NOT IN ('PIQURE','ECG','ECHOGRAPHIE','ACUPUNCTURE','PANSEMENT','SUTURE')");
        jdbc.update("UPDATE catalog_prestation SET active=TRUE, default_price=50  WHERE code='PIQURE'");
        jdbc.update("UPDATE catalog_prestation SET active=TRUE, default_price=200 WHERE code='ECG'");
        jdbc.update("UPDATE catalog_prestation SET active=TRUE, default_price=350 WHERE code='ECHOGRAPHIE'");
        jdbc.update("UPDATE catalog_prestation SET active=TRUE, default_price=300 WHERE code='ACUPUNCTURE'");
        jdbc.update("UPDATE catalog_prestation SET active=TRUE, default_price=80  WHERE code='PANSEMENT'");
        jdbc.update("UPDATE catalog_prestation SET active=TRUE, default_price=150 WHERE code='SUTURE'");

        secEmail   = seedUser("sec",   ROLE_SECRETAIRE);
        asstEmail  = seedUser("asst",  ROLE_ASSISTANT);
        medEmail   = seedUser("med",   ROLE_MEDECIN);
        adminEmail = seedUser("admin", ROLE_ADMIN);
        medId = jdbc.queryForObject("SELECT id FROM identity_user WHERE email = ?", UUID.class, medEmail);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date,
                    cin, version, number_children, status, created_at, updated_at)
                VALUES (?, 'Test', 'Patient', 'M', '1990-01-01', 'IT-PRES-001',
                        0, 0, 'ACTIF', now(), now())
                """, patientId);

        consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    version_number, version, created_at, updated_at, started_at)
                VALUES (?, ?, ?, 'BROUILLON', 1, 0, now(), now(), now())
                """, consultationId, patientId, medId);
    }

    @Test
    @DisplayName("1. Catalogue seedé V016 — 6 prestations livrées")
    void seedCatalogVisible() throws Exception {
        mockMvc.perform(get("/api/catalog/prestations").header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'PIQURE')]").exists())
                .andExpect(jsonPath("$[?(@.code == 'ECG')]").exists())
                .andExpect(jsonPath("$[?(@.code == 'ECHOGRAPHIE')]").exists())
                .andExpect(jsonPath("$[?(@.code == 'ACUPUNCTURE')]").exists());
    }

    @Test
    @DisplayName("2. CRUD admin — POST/PUT/DELETE catalogue")
    void crudCatalog() throws Exception {
        // POST
        MvcResult r = mockMvc.perform(post("/api/catalog/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"INFILTRATION","label":"Infiltration","defaultPrice":250}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("INFILTRATION"))
                .andReturn();
        UUID id = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());

        // PUT
        mockMvc.perform(put("/api/catalog/prestations/" + id)
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"INFILTRATION","label":"Infiltration épidurale","defaultPrice":300}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Infiltration épidurale"))
                .andExpect(jsonPath("$.defaultPrice").value(300));

        // DELETE → soft (active=false)
        mockMvc.perform(delete("/api/catalog/prestations/" + id).header("Authorization", bearer(medEmail)))
                .andExpect(status().isNoContent());
        Boolean active = jdbc.queryForObject("SELECT active FROM catalog_prestation WHERE id = ?",
                Boolean.class, id);
        assertThat(active).isFalse();
    }

    @Test
    @DisplayName("3. Code dupliqué → 409 PRESTATION_CODE_DUPLICATE")
    void duplicateCodeRejected() throws Exception {
        mockMvc.perform(post("/api/catalog/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"PIQURE\",\"label\":\"Doublon\",\"defaultPrice\":50}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PRESTATION_CODE_DUPLICATE"));
    }

    @Test
    @DisplayName("4. Validation — code vide → 400 ; prix négatif → 400")
    void validation() throws Exception {
        mockMvc.perform(post("/api/catalog/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"\",\"label\":\"X\",\"defaultPrice\":10}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/catalog/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"NEG\",\"label\":\"Test\",\"defaultPrice\":-10}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("5. Ajout consultation — defaultPrice du catalogue est snappé")
    void addToConsultation_snapsDefaultPrice() throws Exception {
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + ecgId + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.unitPrice").value(200))
                .andExpect(jsonPath("$.quantity").value(1))
                .andExpect(jsonPath("$.lineTotal").value(200))
                .andExpect(jsonPath("$.prestationCode").value("ECG"));
    }

    @Test
    @DisplayName("6. Override de prix — la valeur fournie est figée, pas le defaultPrice")
    void overridesUnitPrice() throws Exception {
        UUID piqureId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='PIQURE'", UUID.class);
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + piqureId + "\",\"unitPrice\":75,\"quantity\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.unitPrice").value(75))
                .andExpect(jsonPath("$.quantity").value(2))
                .andExpect(jsonPath("$.lineTotal").value(150));
    }

    @Test
    @DisplayName("7. Snapshot immutable — modifier le defaultPrice ne réécrit PAS l'historique")
    void snapshotImmutableAfterCatalogPriceChange() throws Exception {
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        // Ajout au prix d'origine (200).
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + ecgId + "\"}"))
                .andExpect(status().isCreated()).andReturn();
        UUID linkId = UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());

        // Admin change le tarif catalogue à 250.
        mockMvc.perform(put("/api/catalog/prestations/" + ecgId)
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"ECG\",\"label\":\"Électrocardiogramme (ECG)\",\"defaultPrice\":250}"))
                .andExpect(status().isOk());

        // Le lien existant doit garder 200.
        BigDecimal stored = jdbc.queryForObject(
                "SELECT unit_price FROM clinical_consultation_prestation WHERE id = ?",
                BigDecimal.class, linkId);
        assertThat(stored).isEqualByComparingTo(new BigDecimal("200"));
    }

    @Test
    @DisplayName("8. Total prestations — somme correcte des lineTotal")
    void totalForConsultation() throws Exception {
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        UUID piqureId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='PIQURE'", UUID.class);
        addToConsultation(ecgId, null, 1);            // 200
        addToConsultation(piqureId, null, 3);         // 50 × 3 = 150

        // jsonPath filter ne compare pas bien int vs BigDecimal scaled —
        // on lit le JSON et on compare en numeric.
        String body = mockMvc.perform(get("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        com.fasterxml.jackson.databind.JsonNode arr = objectMapper.readTree(body);
        assertThat(arr).hasSize(2);

        BigDecimal sum = BigDecimal.ZERO;
        for (com.fasterxml.jackson.databind.JsonNode n : arr) {
            BigDecimal lineTotal = n.get("lineTotal").decimalValue();
            if ("ECG".equals(n.get("prestationCode").asText())) {
                assertThat(lineTotal).isEqualByComparingTo(new BigDecimal("200"));
            }
            if ("PIQURE".equals(n.get("prestationCode").asText())) {
                assertThat(lineTotal).isEqualByComparingTo(new BigDecimal("150"));
            }
            sum = sum.add(lineTotal);
        }
        assertThat(sum).isEqualByComparingTo(new BigDecimal("350"));
    }

    @Test
    @DisplayName("9. Consultation SIGNEE → 409 CONSULT_LOCKED")
    void cannotAddToSignedConsultation() throws Exception {
        jdbc.update("UPDATE clinical_consultation SET status='SIGNEE', signed_at=now() WHERE id=?", consultationId);
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + ecgId + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSULT_LOCKED"));
    }

    @Test
    @DisplayName("10. Prestation désactivée → 400 PRESTATION_INACTIVE")
    void inactivePrestationRejected() throws Exception {
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        jdbc.update("UPDATE catalog_prestation SET active=FALSE WHERE id=?", ecgId);
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + ecgId + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PRESTATION_INACTIVE"));
    }

    @Test
    @DisplayName("11. Prestation inconnue → 404 PRESTATION_NOT_FOUND")
    void unknownPrestation() throws Exception {
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PRESTATION_NOT_FOUND"));
    }

    @Test
    @DisplayName("12. RBAC — Secrétaire LIT mais ne CRÉE pas de prestation au catalogue")
    void secretaireCannotCreateCatalog() throws Exception {
        mockMvc.perform(get("/api/catalog/prestations").header("Authorization", bearer(secEmail)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/catalog/prestations")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"X\",\"label\":\"x\",\"defaultPrice\":10}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("13. RBAC — Assistant peut ajouter une prestation à une consultation (parité V010)")
    void assistantCanAddToConsultation() throws Exception {
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(asstEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prestationId\":\"" + ecgId + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("14. DELETE link — retire la prestation de la consultation")
    void removeFromConsultation() throws Exception {
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        UUID linkId = addToConsultation(ecgId, null, 1);

        mockMvc.perform(delete("/api/consultations/" + consultationId + "/prestations/" + linkId)
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isNoContent());

        Integer remaining = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinical_consultation_prestation WHERE consultation_id = ?",
                Integer.class, consultationId);
        assertThat(remaining).isZero();
    }

    @Test
    @DisplayName("15. La liste GET /consultations/{id}/prestations expose le code + label + lineTotal")
    void listExposesEnrichedFields() throws Exception {
        UUID ecgId = jdbc.queryForObject("SELECT id FROM catalog_prestation WHERE code='ECG'", UUID.class);
        addToConsultation(ecgId, new BigDecimal("180"), 2);

        mockMvc.perform(get("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].prestationCode").value("ECG"))
                .andExpect(jsonPath("$[0].prestationLabel").value("Électrocardiogramme (ECG)"))
                .andExpect(jsonPath("$[0].unitPrice").value(180))
                .andExpect(jsonPath("$[0].quantity").value(2))
                .andExpect(jsonPath("$[0].lineTotal").value(360));
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private UUID addToConsultation(UUID prestationId, BigDecimal unitPrice, int qty) throws Exception {
        String body = unitPrice == null
                ? "{\"prestationId\":\"" + prestationId + "\",\"quantity\":" + qty + "}"
                : "{\"prestationId\":\"" + prestationId + "\",\"unitPrice\":" + unitPrice + ",\"quantity\":" + qty + "}";
        MvcResult r = mockMvc.perform(post("/api/consultations/" + consultationId + "/prestations")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated()).andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
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
