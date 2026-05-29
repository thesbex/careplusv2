package ma.careplus.hospitalization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
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
 * Cycle de vie d'un séjour : admission → transfert → sortie → facturation + gardes.
 *
 * Scenarios:
 *   S1  admit → 201 EN_COURS + 1 affectation + lit occupé.
 *   S2  re-admit même patient → 409 PATIENT_ALREADY_ADMITTED.
 *   S3  admit autre patient sur lit occupé → 409 BED_OCCUPIED.
 *   S4  transfer → 200, 2 affectations, ancien lit libéré.
 *   S5  discharge → 200 SORTI + lit libéré.
 *   S6  invoice → facture brouillon (nuits × prix de journée), séjour FACTURE.
 *   S7  invoice avant sortie → 409 STAY_NOT_DISCHARGED.
 *   S8  queue ne liste que les EN_COURS.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class StayLifecycleIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_stay_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Stay-IT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String medecinEmail;
    UUID patientId;
    UUID patient2Id;
    UUID bedA;
    UUID bedB;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM hospitalization_bed_assignment");
        jdbc.update("DELETE FROM hospitalization_stay");
        jdbc.update("DELETE FROM hospitalization_bed");
        jdbc.update("DELETE FROM hospitalization_room");
        jdbc.update("DELETE FROM hospitalization_ward");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        UUID medId = UUID.randomUUID();
        medecinEmail = "med-stay-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Med', 'Stay', TRUE, 0, 0, now(), now())
                """, medId, medecinEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Cherkaoui', 'Ahmed', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);
        patient2Id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Ziani', 'Youssef', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patient2Id);

        UUID wardId = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_ward (id, code, label_fr) VALUES (?, 'MAT', 'Maternité')", wardId);
        UUID roomId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO hospitalization_room (id, ward_id, code, label_fr, room_class, daily_rate)
                VALUES (?, ?, '102', 'Chambre 102', 'INDIVIDUELLE', 400)
                """, roomId, wardId);
        bedA = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_bed (id, room_id, code, status) VALUES (?, ?, 'Lit A', 'LIBRE')", bedA, roomId);
        bedB = UUID.randomUUID();
        jdbc.update("INSERT INTO hospitalization_bed (id, room_id, code, status) VALUES (?, ?, 'Lit B', 'LIBRE')", bedB, roomId);
    }

    private String bearer() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + medecinEmail + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String admit(UUID patient, UUID bed) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", patient, "bedId", bed, "admissionReason", "Surveillance"))))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    @Test
    @DisplayName("S1. admit → 201 EN_COURS + 1 affectation courante")
    void s1_admit() throws Exception {
        mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", patientId, "bedId", bedA, "admissionReason", "Post-op"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("EN_COURS"))
                .andExpect(jsonPath("$.patientLastName").value("Cherkaoui"))
                .andExpect(jsonPath("$.assignments.length()").value(1));
    }

    @Test
    @DisplayName("S2. re-admit même patient → 409 PATIENT_ALREADY_ADMITTED")
    void s2_doubleAdmit() throws Exception {
        admit(patientId, bedA);
        mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("patientId", patientId, "bedId", bedB))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PATIENT_ALREADY_ADMITTED"));
    }

    @Test
    @DisplayName("S3. admit autre patient sur lit occupé → 409 BED_OCCUPIED")
    void s3_bedOccupied() throws Exception {
        admit(patientId, bedA);
        mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("patientId", patient2Id, "bedId", bedA))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BED_OCCUPIED"));
    }

    @Test
    @DisplayName("S4. transfer → 200, 2 affectations")
    void s4_transfer() throws Exception {
        String stayId = admit(patientId, bedA);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/transfer")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("bedId", bedB))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignments.length()").value(2));
        // L'ancien lit A est libéré (plus d'affectation courante).
        Integer currentOnA = jdbc.queryForObject(
                "SELECT COUNT(*) FROM hospitalization_bed_assignment WHERE bed_id = ?::uuid AND to_at IS NULL",
                Integer.class, bedA.toString());
        assertThat(currentOnA).isZero();
    }

    @Test
    @DisplayName("S5. discharge → 200 SORTI")
    void s5_discharge() throws Exception {
        String stayId = admit(patientId, bedA);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "dischargeType", "DOMICILE", "dischargeSummary", "RAS"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SORTI"))
                .andExpect(jsonPath("$.dischargeType").value("DOMICILE"));
    }

    @Test
    @DisplayName("S6. sortie en 2 temps : préparer (SORTI + facture émise) → confirmer bloqué "
            + "tant que non réglé → encaissement → confirmer (FACTURE)")
    void s6_dischargeTwoSteps() throws Exception {
        String stayId = admit(patientId, bedA);
        // transfert puis « préparer la sortie » → 2 affectations facturables + facture émise
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/transfer")
                .header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("bedId", bedB)))).andExpect(status().isOk());
        MvcResult dr = mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                .header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SORTI"))
                .andExpect(jsonPath("$.invoiceId").isNotEmpty())
                .andReturn();
        String invoiceId = objectMapper.readTree(dr.getResponse().getContentAsString()).get("invoiceId").asText();

        // La facture est générée ET émise à la préparation (nuits Lit A + Lit B × 400 = 800).
        String invStatus = jdbc.queryForObject(
                "SELECT status FROM billing_invoice WHERE id = ?::uuid", String.class, invoiceId);
        assertThat(invStatus).isEqualTo("EMISE");
        BigDecimal net = jdbc.queryForObject(
                "SELECT net_amount FROM billing_invoice WHERE id = ?::uuid", BigDecimal.class, invoiceId);
        assertThat(net).isEqualByComparingTo("800");
        Integer lines = jdbc.queryForObject(
                "SELECT COUNT(*) FROM billing_invoice_line WHERE invoice_id = ?::uuid", Integer.class, invoiceId);
        assertThat(lines).isEqualTo(2);

        // Confirmer la sortie AVANT règlement → 409 STAY_INVOICE_UNPAID, séjour toujours SORTI.
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/confirm-discharge")
                        .header("Authorization", bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STAY_INVOICE_UNPAID"));
        assertThat(jdbc.queryForObject("SELECT status FROM hospitalization_stay WHERE id = ?::uuid",
                String.class, stayId)).isEqualTo("SORTI");

        // Encaissement total puis confirmation → séjour FACTURE (clôturé).
        mockMvc.perform(post("/api/invoices/" + invoiceId + "/payments")
                        .header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"ESPECES\",\"amount\":800}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/confirm-discharge")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FACTURE"));
        assertThat(jdbc.queryForObject("SELECT status FROM hospitalization_stay WHERE id = ?::uuid",
                String.class, stayId)).isEqualTo("FACTURE");
    }

    @Test
    @DisplayName("S7. invoice avant sortie → 409 STAY_NOT_DISCHARGED")
    void s7_invoiceBeforeDischarge() throws Exception {
        String stayId = admit(patientId, bedA);
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STAY_NOT_DISCHARGED"));
    }

    @Test
    @DisplayName("S8. queue ne liste que les EN_COURS")
    void s8_queueActiveOnly() throws Exception {
        String stay1 = admit(patientId, bedA);
        admit(patient2Id, bedB);
        // sortie du 1er → ne doit plus apparaître
        mockMvc.perform(post("/api/hospitalization/stays/" + stay1 + "/discharge")
                .header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE")))).andExpect(status().isOk());

        mockMvc.perform(get("/api/hospitalization/stays/queue").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].patientLastName").value("Ziani"));
    }
}
