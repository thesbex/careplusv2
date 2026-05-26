package ma.careplus.hr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
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
 * Integration tests for QA9-14 HR/Personnel module.
 *
 * <p>Scenarios covered:
 * <ol>
 *   <li>POST /api/hr/staff as ADMIN → 201</li>
 *   <li>POST /api/hr/staff as MEDECIN → 403</li>
 *   <li>POST /api/hr/staff as SECRETAIRE → 403</li>
 *   <li>GET  /api/hr/staff → list includes created staff</li>
 *   <li>PUT  /api/hr/staff/{id} → 200 + updated fields persisted</li>
 *   <li>DELETE /api/hr/staff/{id} → 204 + excluded from subsequent list</li>
 *   <li>POST /api/hr/staff/{id}/leave (CONGE) + GET summary → accrued = monthsWorked*1.5, balance = accrued-taken</li>
 *   <li>POST /api/hr/staff/{id}/leave (ABSENCE, RETARD) + GET summary → absencesCount and latenessCount correct</li>
 *   <li>DELETE /api/hr/leave/{id} → 204</li>
 *   <li>POST /api/hr/staff/{id}/payments + GET /api/hr/staff/{id}/payments → payment listed</li>
 *   <li>DELETE /api/hr/payments/{id} → 204</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class HrStaffIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    // Role UUIDs seeded by V001 baseline
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String PWD           = "Hr-Test-2026!";

    @Autowired MockMvc       mockMvc;
    @Autowired ObjectMapper  objectMapper;
    @Autowired JdbcTemplate  jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    String adminEmail;
    String medEmail;
    String secEmail;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean in dependency order
        jdbc.update("DELETE FROM hr_salary_payment");
        jdbc.update("DELETE FROM hr_leave_entry");
        jdbc.update("DELETE FROM hr_staff");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        adminEmail = seedUser("admin-hr", ROLE_ADMIN);
        medEmail   = seedUser("med-hr",   ROLE_MEDECIN);
        secEmail   = seedUser("sec-hr",   ROLE_SECRETAIRE);
    }

    // ── Test 1: ADMIN can create staff (201) ──────────────────────────────────

    @Test
    @DisplayName("1. POST /api/hr/staff as ADMIN → 201 with body")
    void createStaff_asAdmin_returns201() throws Exception {
        mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Mohamed Rachidi", "SECURITE", "2024-01-15",
                                "3500.00", "0661234567", null, true, null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.fullName").value("Mohamed Rachidi"))
                .andExpect(jsonPath("$.role").value("SECURITE"))
                .andExpect(jsonPath("$.hireDate").value("2024-01-15"))
                .andExpect(jsonPath("$.monthlySalary").value(3500.00))
                .andExpect(jsonPath("$.active").value(true));
    }

    // ── Test 2: MEDECIN cannot create (403) ──────────────────────────────────

    @Test
    @DisplayName("2. POST /api/hr/staff as MEDECIN → 403")
    void createStaff_asMedecin_returns403() throws Exception {
        mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(medEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Test Staff", "MENAGE", "2024-01-01",
                                null, null, null, true, null)))
                .andExpect(status().isForbidden());
    }

    // ── Test 3: SECRETAIRE cannot create (403) ────────────────────────────────

    @Test
    @DisplayName("3. POST /api/hr/staff as SECRETAIRE → 403")
    void createStaff_asSecretaire_returns403() throws Exception {
        mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(secEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Test Staff", "MENAGE", "2024-01-01",
                                null, null, null, true, null)))
                .andExpect(status().isForbidden());
    }

    // ── Test 4: GET lists staff, active filter works ──────────────────────────

    @Test
    @DisplayName("4. GET /api/hr/staff includes created staff + active filter")
    void listStaff_includesCreated() throws Exception {
        // Create two staff members
        mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Fatima Naji", "MENAGE", "2023-06-01",
                                "2800.00", null, null, true, "Femme de ménage")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Hassan Amrani", "INFIRMIER", "2022-03-15",
                                "6000.00", "0677654321", null, false, null)))
                .andExpect(status().isCreated());

        // List all (no filter)
        MvcResult result = mockMvc.perform(get("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();
        assertThat(body.size()).isGreaterThanOrEqualTo(2);

        // Filter by active=true
        MvcResult activeResult = mockMvc.perform(get("/api/hr/staff")
                        .param("active", "true")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode activeBody = objectMapper.readTree(activeResult.getResponse().getContentAsString());
        for (JsonNode node : activeBody) {
            assertThat(node.get("active").asBoolean()).isTrue();
        }

        // Filter by role=INFIRMIER
        MvcResult roleResult = mockMvc.perform(get("/api/hr/staff")
                        .param("role", "INFIRMIER")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode roleBody = objectMapper.readTree(roleResult.getResponse().getContentAsString());
        for (JsonNode node : roleBody) {
            assertThat(node.get("role").asText()).isEqualTo("INFIRMIER");
        }
    }

    // ── Test 5: PUT updates the staff member ─────────────────────────────────

    @Test
    @DisplayName("5. PUT /api/hr/staff/{id} → 200 + updated fields persisted")
    void updateStaff_persistsChanges() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Karim Bennani", "TECHNICIEN", "2023-01-10",
                                "5000.00", null, null, true, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Update phone and salary
        mockMvc.perform(put("/api/hr/staff/" + id)
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Karim Bennani", "TECHNICIEN", "2023-01-10",
                                "5500.00", "0655000000", null, true, "Technicien senior")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlySalary").value(5500.00))
                .andExpect(jsonPath("$.phone").value("0655000000"))
                .andExpect(jsonPath("$.notes").value("Technicien senior"));

        // Verify persisted in DB
        String phoneInDb = jdbc.queryForObject(
                "SELECT phone FROM hr_staff WHERE id = ?::uuid", String.class, id);
        assertThat(phoneInDb).isEqualTo("0655000000");
    }

    // ── Test 6: DELETE soft-deletes, excluded from list ──────────────────────

    @Test
    @DisplayName("6. DELETE /api/hr/staff/{id} → 204 + excluded from subsequent GET")
    void deleteStaff_softDeletes_excludedFromList() throws Exception {
        // Create
        MvcResult created = mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Youssef Idrissi", "AUTRE", "2024-03-01",
                                null, null, null, true, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Delete → 204
        mockMvc.perform(delete("/api/hr/staff/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // deleted_at must be set in DB
        String deletedAt = jdbc.queryForObject(
                "SELECT deleted_at::TEXT FROM hr_staff WHERE id = ?::uuid",
                String.class, id);
        assertThat(deletedAt).isNotNull();

        // Must not appear in list
        MvcResult list = mockMvc.perform(get("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        for (JsonNode node : body) {
            assertThat(node.get("id").asText()).isNotEqualTo(id);
        }

        // GET by id → 404
        mockMvc.perform(get("/api/hr/staff/" + id)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNotFound());
    }

    // ── Test 7: Leave accrual + balance computation ───────────────────────────

    /**
     * Seeds a staff member hired ~10 months ago so accrued ≈ 15 days.
     * Adds a CONGE of 5 days → balance ≈ 10.
     * Verifies the summary endpoint computes correctly.
     */
    @Test
    @DisplayName("7. Leave accrual: hire ~10m ago → accrued≈15, add CONGE 5 → balance≈10")
    void summary_accrualAndBalance() throws Exception {
        // Hire date 10 months ago (whole months → exactly 10 months worked on most days)
        LocalDate hireDate = LocalDate.now().minusMonths(10);

        MvcResult created = mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Amina Berrada", "ASSISTANTE", hireDate.toString(),
                                "4500.00", null, null, true, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String staffId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Add a CONGE of 5 days
        mockMvc.perform(post("/api/hr/staff/" + staffId + "/leave")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(leaveJson("CONGE", LocalDate.now().minusDays(5).toString(), "5.00", "Congé annuel")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("CONGE"))
                .andExpect(jsonPath("$.days").value(5.00));

        // GET summary
        MvcResult summaryResult = mockMvc.perform(get("/api/hr/staff/" + staffId + "/summary")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode summary = objectMapper.readTree(summaryResult.getResponse().getContentAsString());

        long monthsWorked = summary.get("monthsWorked").asLong();
        double accrued    = summary.get("accruedLeaveDays").asDouble();
        double taken      = summary.get("takenLeaveDays").asDouble();
        double balance    = summary.get("leaveBalanceDays").asDouble();

        // monthsWorked should be 10 (hired exactly 10 months ago)
        assertThat(monthsWorked).isEqualTo(10L);

        // accrued = 10 * 1.5 = 15.0
        assertThat(accrued).isEqualTo(15.0);

        // taken = 5.0
        assertThat(taken).isEqualTo(5.0);

        // balance = 15.0 - 5.0 = 10.0
        assertThat(balance).isEqualTo(10.0);
    }

    // ── Test 8: Absences and lateness counts ─────────────────────────────────

    @Test
    @DisplayName("8. Summary counts absences and lateness correctly")
    void summary_absencesAndLatenessCount() throws Exception {
        LocalDate hireDate = LocalDate.now().minusMonths(6);

        MvcResult created = mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Rachid Ouali", "SECURITE", hireDate.toString(),
                                "3200.00", null, null, true, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String staffId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        // Add 2 absences
        mockMvc.perform(post("/api/hr/staff/" + staffId + "/leave")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(leaveJson("ABSENCE", LocalDate.now().minusDays(10).toString(), "1.00", null)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/hr/staff/" + staffId + "/leave")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(leaveJson("ABSENCE", LocalDate.now().minusDays(20).toString(), "1.00", null)))
                .andExpect(status().isCreated());

        // Add 3 lateness entries
        for (int i = 1; i <= 3; i++) {
            mockMvc.perform(post("/api/hr/staff/" + staffId + "/leave")
                            .header("Authorization", bearer(adminEmail))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(leaveJson("RETARD", LocalDate.now().minusDays(i).toString(), "0.00", "Retard " + i)))
                    .andExpect(status().isCreated());
        }

        // GET summary
        MvcResult summaryResult = mockMvc.perform(get("/api/hr/staff/" + staffId + "/summary")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode summary = objectMapper.readTree(summaryResult.getResponse().getContentAsString());

        assertThat(summary.get("absencesCount").asLong()).isEqualTo(2L);
        assertThat(summary.get("latenessCount").asLong()).isEqualTo(3L);

        // accrued = 6 * 1.5 = 9.0, taken = 0.0, balance = 9.0
        assertThat(summary.get("monthsWorked").asLong()).isEqualTo(6L);
        assertThat(summary.get("accruedLeaveDays").asDouble()).isEqualTo(9.0);
        assertThat(summary.get("takenLeaveDays").asDouble()).isEqualTo(0.0);
    }

    // ── Test 9: DELETE leave entry ────────────────────────────────────────────

    @Test
    @DisplayName("9. DELETE /api/hr/leave/{id} → 204 + entry removed")
    void deleteLeaveEntry_removes() throws Exception {
        // Create staff
        MvcResult staffCreated = mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Nadia Tazi", "SECRETAIRE", "2023-09-01",
                                "5500.00", null, null, true, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String staffId = objectMapper.readTree(staffCreated.getResponse().getContentAsString())
                .get("id").asText();

        // Add leave
        MvcResult leaveCreated = mockMvc.perform(post("/api/hr/staff/" + staffId + "/leave")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(leaveJson("CONGE", "2025-08-01", "3.00", null)))
                .andExpect(status().isCreated())
                .andReturn();

        String leaveId = objectMapper.readTree(leaveCreated.getResponse().getContentAsString())
                .get("id").asText();

        // Delete leave
        mockMvc.perform(delete("/api/hr/leave/" + leaveId)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // Verify physically deleted from DB
        int count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM hr_leave_entry WHERE id = ?::uuid",
                Integer.class, leaveId);
        assertThat(count).isZero();
    }

    // ── Test 10: Salary payments CRUD ────────────────────────────────────────

    @Test
    @DisplayName("10. POST salary payment + GET list → payment appears")
    void addAndListPayments() throws Exception {
        // Create staff
        MvcResult staffCreated = mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Omar Tazi", "INFIRMIER", "2022-07-01",
                                "7000.00", null, null, true, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String staffId = objectMapper.readTree(staffCreated.getResponse().getContentAsString())
                .get("id").asText();

        // Add salary payment
        MvcResult paymentCreated = mockMvc.perform(post("/api/hr/staff/" + staffId + "/payments")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(paymentJson("2026-04", "7000.00", "2026-04-28", "Salaire avril")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.period").value("2026-04"))
                .andExpect(jsonPath("$.amount").value(7000.00))
                .andExpect(jsonPath("$.paidAt").value("2026-04-28"))
                .andReturn();

        String paymentId = objectMapper.readTree(paymentCreated.getResponse().getContentAsString())
                .get("id").asText();

        // List payments
        MvcResult list = mockMvc.perform(get("/api/hr/staff/" + staffId + "/payments")
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(list.getResponse().getContentAsString());
        assertThat(body.isArray()).isTrue();
        assertThat(body.size()).isGreaterThanOrEqualTo(1);

        boolean found = false;
        for (JsonNode node : body) {
            if (paymentId.equals(node.get("id").asText())) {
                found = true;
                assertThat(node.get("period").asText()).isEqualTo("2026-04");
                assertThat(node.get("notes").asText()).isEqualTo("Salaire avril");
            }
        }
        assertThat(found).as("Created payment found in list").isTrue();
    }

    // ── Test 11: DELETE salary payment ───────────────────────────────────────

    @Test
    @DisplayName("11. DELETE /api/hr/payments/{id} → 204 + physically removed")
    void deletePayment_removes() throws Exception {
        // Create staff
        MvcResult staffCreated = mockMvc.perform(post("/api/hr/staff")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staffJson("Sanae Idrissi", "ASSISTANTE", "2021-11-01",
                                "4800.00", null, null, true, null)))
                .andExpect(status().isCreated())
                .andReturn();

        String staffId = objectMapper.readTree(staffCreated.getResponse().getContentAsString())
                .get("id").asText();

        // Add payment
        MvcResult paymentCreated = mockMvc.perform(post("/api/hr/staff/" + staffId + "/payments")
                        .header("Authorization", bearer(adminEmail))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(paymentJson("2026-03", "4800.00", "2026-03-31", null)))
                .andExpect(status().isCreated())
                .andReturn();

        String paymentId = objectMapper.readTree(paymentCreated.getResponse().getContentAsString())
                .get("id").asText();

        // Delete payment
        mockMvc.perform(delete("/api/hr/payments/" + paymentId)
                        .header("Authorization", bearer(adminEmail)))
                .andExpect(status().isNoContent());

        // Verify physically deleted
        int count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM hr_salary_payment WHERE id = ?::uuid",
                Integer.class, paymentId);
        assertThat(count).isZero();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String seedUser(String prefix, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                id, email, passwordEncoder.encode(PWD),
                prefix, "Test",
                OffsetDateTime.now(), OffsetDateTime.now());
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return email;
    }

    private String bearer(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
        return "Bearer " + token;
    }

    private String staffJson(String fullName, String role, String hireDate,
                             String monthlySalary, String phone, String userId,
                             Boolean active, String notes) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"fullName\":\"").append(fullName).append("\"");
        sb.append(",\"role\":\"").append(role).append("\"");
        sb.append(",\"hireDate\":\"").append(hireDate).append("\"");
        if (monthlySalary != null) sb.append(",\"monthlySalary\":").append(monthlySalary);
        if (phone != null) sb.append(",\"phone\":\"").append(phone).append("\"");
        if (userId != null) sb.append(",\"userId\":\"").append(userId).append("\"");
        if (active != null) sb.append(",\"active\":").append(active);
        if (notes != null) sb.append(",\"notes\":\"").append(notes).append("\"");
        sb.append("}");
        return sb.toString();
    }

    private String leaveJson(String type, String startDate, String days, String notes) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"type\":\"").append(type).append("\"");
        sb.append(",\"startDate\":\"").append(startDate).append("\"");
        if (days != null) sb.append(",\"days\":").append(days);
        if (notes != null) sb.append(",\"notes\":\"").append(notes).append("\"");
        sb.append("}");
        return sb.toString();
    }

    private String paymentJson(String period, String amount, String paidAt, String notes) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"period\":\"").append(period).append("\"");
        sb.append(",\"amount\":").append(amount);
        sb.append(",\"paidAt\":\"").append(paidAt).append("\"");
        if (notes != null) sb.append(",\"notes\":\"").append(notes).append("\"");
        sb.append("}");
        return sb.toString();
    }
}
