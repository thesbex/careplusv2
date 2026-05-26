package ma.careplus.hospitalization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Rôle RÉCEPTIONNISTE (V062) — bureau des admissions d'une clinique.
 *
 * Scénarios (utilisateur ne portant QUE le rôle RECEPTIONNISTE) :
 *   R1  admit → 201 EN_COURS (ADMIT_ROLES inclut RECEPTIONNISTE).
 *   R2  invoice (après transfert + sortie par un médecin) → 200 (BILL_ROLES
 *       inclut RECEPTIONNISTE), facture brouillon générée.
 *   R3  discharge → 403 (DISCHARGE_ROLES reste médical : MEDECIN/ADMIN).
 *   R4  POST /api/admin/users avec role RECEPTIONNISTE → 201 (rôle accepté par
 *       AdminUserController.ALLOWED_ROLE_CODES + présent dans identity_role).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ReceptionnisteRoleIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_recep_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID ROLE_RECEPTIONNISTE = UUID.fromString("00000000-0000-0000-0000-000000000008");
    private static final String PWD = "Recep-IT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String receptionEmail;
    String medecinEmail;
    String adminEmail;
    UUID patientId;
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

        receptionEmail = "recep-" + UUID.randomUUID() + "@test.ma";
        UUID recepId = createUser(receptionEmail, "Rita", "Recep", ROLE_RECEPTIONNISTE);

        medecinEmail = "med-" + UUID.randomUUID() + "@test.ma";
        createUser(medecinEmail, "Med", "Stay", ROLE_MEDECIN);

        adminEmail = "admin-" + UUID.randomUUID() + "@test.ma";
        createUser(adminEmail, "Adm", "In", ROLE_ADMIN);

        // recepId retained for clarity; no further direct use.
        assertThat(recepId).isNotNull();

        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Cherkaoui', 'Ahmed', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);

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

    private UUID createUser(String email, String first, String last, UUID roleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD), first, last);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return id;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    @Test
    @DisplayName("R1. réceptionniste seule peut admettre → 201 EN_COURS")
    void r1_receptionnisteCanAdmit() throws Exception {
        mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer(receptionEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", patientId, "bedId", bedA, "admissionReason", "Surveillance"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("EN_COURS"));
    }

    @Test
    @DisplayName("R2. réceptionniste peut générer la facture de séjour → 200")
    void r2_receptionnisteCanBill() throws Exception {
        // Admission par la réceptionniste.
        MvcResult admit = mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer(receptionEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", patientId, "bedId", bedA, "admissionReason", "Surveillance"))))
                .andExpect(status().isCreated()).andReturn();
        String stayId = objectMapper.readTree(admit.getResponse().getContentAsString()).get("id").asText();

        // Sortie médicale (réceptionniste interdite — fait par le médecin).
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                        .header("Authorization", bearer(medecinEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE"))))
                .andExpect(status().isOk());

        // Facturation par la réceptionniste → autorisée.
        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/invoice")
                        .header("Authorization", bearer(receptionEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").isNotEmpty());

        String dbStatus = jdbc.queryForObject(
                "SELECT status FROM hospitalization_stay WHERE id = ?::uuid", String.class, stayId);
        assertThat(dbStatus).isEqualTo("FACTURE");
    }

    @Test
    @DisplayName("R3. réceptionniste NE PEUT PAS sortir un patient → 403")
    void r3_receptionnisteCannotDischarge() throws Exception {
        MvcResult admit = mockMvc.perform(post("/api/hospitalization/stays/admit")
                        .header("Authorization", bearer(receptionEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", patientId, "bedId", bedA, "admissionReason", "Surveillance"))))
                .andExpect(status().isCreated()).andReturn();
        String stayId = objectMapper.readTree(admit.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/hospitalization/stays/" + stayId + "/discharge")
                        .header("Authorization", bearer(receptionEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("dischargeType", "DOMICILE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("R4. créer un utilisateur avec le rôle RECEPTIONNISTE → 201")
    void r4_createUserWithReceptionnisteRole() throws Exception {
        String newEmail = "new-recep-" + UUID.randomUUID() + "@test.ma";
        String body = objectMapper.writeValueAsString(Map.of(
                "email", newEmail,
                "password", "longpassword123",
                "firstName", "Nadia",
                "lastName", "Accueil",
                "roles", java.util.List.of("RECEPTIONNISTE")));

        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roles[0]").value("RECEPTIONNISTE"));

        Integer roleCount = jdbc.queryForObject("""
                SELECT COUNT(*) FROM identity_user_role ur
                  JOIN identity_role r ON r.id = ur.role_id
                  JOIN identity_user u ON u.id = ur.user_id
                 WHERE u.email = ? AND r.code = 'RECEPTIONNISTE'
                """, Integer.class, newEmail);
        assertThat(roleCount).isEqualTo(1);
    }
}
