package ma.careplus.hospitalization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
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
 * QA10-4 — La facture de séjour englobe TOUTES les prestations fournies pendant le
 * séjour : nuits, prestations de séjour ET les consultations effectuées pendant le
 * séjour (actes + labo/imagerie/médicaments internes facturés sur leur propre
 * brouillon de consultation).
 *
 * Mécanisme : à la génération de la facture de séjour, on absorbe les factures
 * BROUILLON de consultation du patient dont la consultation tombe dans la fenêtre
 * [admittedAt, dischargedAt|now] : leurs lignes sont fusionnées dans la facture de
 * séjour et le brouillon de consultation est supprimé (pas de double comptage). Les
 * factures de consultation déjà ÉMISES (immuables) sont laissées intactes.
 *
 * Scénarios :
 *   A1  admit → consultation BROUILLON (300) dans la fenêtre → prestation séjour (240)
 *       → discharge → invoice : total = nuit(400) + prestation(240) + consultation(300)
 *       = 940 ; le brouillon de consultation a disparu.
 *   A2  Idempotence : un second appel n'absorbe rien (déjà absorbé) — pas de double.
 *   A3  Une facture de consultation déjà ÉMISE dans la fenêtre n'est PAS absorbée
 *       (reste EMISE, exclue de la facture de séjour).
 *   A4  Une consultation HORS fenêtre (avant l'admission) n'est PAS absorbée.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class StayInvoiceAggregationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_stayaggit_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "StayAggIT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medecinEmail;
    UUID medId;
    UUID patientId;
    UUID bedA;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM hospitalization_stay_prestation");
        jdbc.update("DELETE FROM hospitalization_bed_assignment");
        jdbc.update("DELETE FROM hospitalization_stay");
        jdbc.update("DELETE FROM hospitalization_bed");
        jdbc.update("DELETE FROM hospitalization_room");
        jdbc.update("DELETE FROM hospitalization_ward");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        medId = UUID.randomUUID();
        medecinEmail = "agg-med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Med', 'Agg', TRUE, 0, 0, now(), now())
                """, medId, medecinEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Alaoui', 'Sara', 'F', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        UUID wardId = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_ward (id, code, label_fr) VALUES (?, 'CHIR', 'Chirurgie')", wardId);
        UUID roomId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO hospitalization_room (id, ward_id, code, label_fr, room_class, daily_rate)
                VALUES (?, ?, '201', 'Chambre 201', 'INDIVIDUELLE', 400)
                """, roomId, wardId);
        bedA = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_bed (id, room_id, code, status) VALUES (?, ?, 'Lit 1', 'LIBRE')",
                bedA, roomId);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private String bearer() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + medecinEmail + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String admit(String token) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", patientId, "bedId", bedA, "admissionReason", "Post-op"))))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private void discharge(String token, String stayId) throws Exception {
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE"))))
                .andExpect(status().isOk());
    }

    private void addPrestation(String token, String stayId, String label, double price, double qty)
            throws Exception {
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/prestations")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"" + label + "\",\"unitPrice\":" + price
                                + ",\"quantity\":" + qty + "}"))
                .andExpect(status().isCreated());
    }

    /**
     * Crée une consultation + sa facture BROUILLON de consultation (telle que la
     * produirait {@code onConsultationSigned}) à une date donnée, avec une ligne unique.
     * @return l'id de la facture de consultation créée.
     */
    private UUID seedConsultationInvoice(OffsetDateTime startedAt, String status,
                                         String lineDesc, BigDecimal amount) {
        UUID consultationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clinical_consultation (id, patient_id, practitioner_id, status,
                    started_at, version_number, version, created_at, updated_at)
                VALUES (?, ?, ?, 'SIGNEE', ?, 1, 0, now(), now())
                """, consultationId, patientId, medId, java.sql.Timestamp.from(startedAt.toInstant()));

        UUID invoiceId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing_invoice (id, patient_id, consultation_id, status,
                    subtotal, vat_total, total, discount_amount, net_amount, paid_total,
                    created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, 0, ?, 0, ?, 0, ?, ?)
                """, invoiceId, patientId, consultationId, status, amount, amount,
                java.sql.Timestamp.from(startedAt.toInstant()),
                java.sql.Timestamp.from(startedAt.toInstant()));

        jdbc.update("""
                INSERT INTO billing_invoice_line (id, invoice_id, position, description,
                    unit_price, quantity, vat_rate, line_total, created_at)
                VALUES (?, ?, 0, ?, ?, 1, 0, ?, now())
                """, UUID.randomUUID(), invoiceId, lineDesc, amount, amount);
        return invoiceId;
    }

    private BigDecimal net(String invoiceId) {
        return jdbc.queryForObject(
                "SELECT net_amount FROM billing_invoice WHERE id = ?::uuid", BigDecimal.class, invoiceId);
    }

    private int countActiveInvoices() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM billing_invoice", Integer.class);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("A1. invoice englobe nuit + prestation séjour + consultation du séjour ; "
            + "le brouillon de consultation est absorbé puis supprimé")
    void a1_absorbsConsultationDuringStay() throws Exception {
        String token = bearer();
        String stayId = admit(token);

        // Consultation BROUILLON pendant le séjour (admis à l'instant → fenêtre couvre now).
        UUID consultInvId = seedConsultationInvoice(
                OffsetDateTime.now(), "BROUILLON", "Consultation cardiologue", new BigDecimal("300"));
        assertThat(net(consultInvId.toString())).isEqualByComparingTo("300");

        // Prestation de séjour (Oxygène 120 × 2 = 240).
        addPrestation(token, stayId, "Oxygène", 120, 2);

        discharge(token, stayId);

        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").isNotEmpty())
                .andReturn();
        String stayInvId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("invoiceId").asText();

        // total facture séjour = nuit(400) + Oxygène(240) + consultation(300) = 940
        assertThat(net(stayInvId)).isEqualByComparingTo("940");

        // Le brouillon de consultation a été supprimé (plus en base).
        Integer consultStillThere = jdbc.queryForObject(
                "SELECT COUNT(*) FROM billing_invoice WHERE id = ?::uuid",
                Integer.class, consultInvId);
        assertThat(consultStillThere).isZero();

        // Il ne reste qu'UNE facture en base : la facture de séjour.
        assertThat(countActiveInvoices()).isEqualTo(1);

        // La ligne consultation a bien été reportée, préfixée par la date.
        Integer mergedLine = jdbc.queryForObject(
                "SELECT COUNT(*) FROM billing_invoice_line WHERE invoice_id = ?::uuid "
                        + "AND description LIKE 'Consultation %— Consultation cardiologue'",
                Integer.class, stayInvId);
        assertThat(mergedLine).isEqualTo(1);

        // 3 lignes : hébergement + Oxygène + consultation absorbée.
        Integer lineCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM billing_invoice_line WHERE invoice_id = ?::uuid",
                Integer.class, stayInvId);
        assertThat(lineCount).isEqualTo(3);
    }

    @Test
    @DisplayName("A2. idempotence : un séjour déjà FACTURE ne peut pas être refacturé (409) ; "
            + "pas de double absorption")
    void a2_idempotent() throws Exception {
        String token = bearer();
        String stayId = admit(token);
        seedConsultationInvoice(OffsetDateTime.now(), "BROUILLON", "Consultation", new BigDecimal("300"));
        discharge(token, stayId);

        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // Second appel : séjour FACTURE → 409, aucune nouvelle absorption.
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", token))
                .andExpect(status().isConflict());

        // Toujours une seule facture (la facture de séjour).
        assertThat(countActiveInvoices()).isEqualTo(1);
    }

    @Test
    @DisplayName("A3. une facture de consultation déjà ÉMISE dans la fenêtre n'est PAS absorbée")
    void a3_issuedConsultationNotAbsorbed() throws Exception {
        String token = bearer();
        String stayId = admit(token);

        UUID issuedInv = seedConsultationInvoice(
                OffsetDateTime.now(), "EMISE", "Consultation émise", new BigDecimal("300"));
        // Numéro requis pour une facture émise (contrainte unique tolère NULL ; on met un numéro).
        jdbc.update("UPDATE billing_invoice SET number = '2026-099999', issued_at = now() WHERE id = ?", issuedInv);

        addPrestation(token, stayId, "Oxygène", 120, 2);
        discharge(token, stayId);

        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", token))
                .andExpect(status().isOk()).andReturn();
        String stayInvId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("invoiceId").asText();

        // La facture émise est intacte (toujours EMISE).
        String issuedStatus = jdbc.queryForObject(
                "SELECT status FROM billing_invoice WHERE id = ?::uuid", String.class, issuedInv);
        assertThat(issuedStatus).isEqualTo("EMISE");

        // Facture de séjour = nuit(400) + Oxygène(240) = 640 (consultation émise NON incluse).
        assertThat(net(stayInvId)).isEqualByComparingTo("640");

        // 2 factures en base : la facture émise (préservée) + la facture de séjour.
        assertThat(countActiveInvoices()).isEqualTo(2);
    }

    @Test
    @DisplayName("A4. une consultation HORS fenêtre (avant l'admission) n'est PAS absorbée")
    void a4_consultationBeforeStayNotAbsorbed() throws Exception {
        String token = bearer();
        String stayId = admit(token);

        // Consultation BROUILLON datée 10 jours avant l'admission → hors fenêtre.
        UUID oldInv = seedConsultationInvoice(
                OffsetDateTime.now().minusDays(10), "BROUILLON", "Vieille consultation", new BigDecimal("300"));

        discharge(token, stayId);

        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", token))
                .andExpect(status().isOk()).andReturn();
        String stayInvId = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("invoiceId").asText();

        // La consultation hors fenêtre n'a pas été absorbée (toujours là, intacte).
        Integer oldStillThere = jdbc.queryForObject(
                "SELECT COUNT(*) FROM billing_invoice WHERE id = ?::uuid", Integer.class, oldInv);
        assertThat(oldStillThere).isEqualTo(1);

        // Facture de séjour = nuit(400) seulement.
        assertThat(net(stayInvId)).isEqualByComparingTo("400");
    }
}
