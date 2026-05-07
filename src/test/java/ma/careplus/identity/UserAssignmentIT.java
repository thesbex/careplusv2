package ma.careplus.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
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
 * V032 — covers the full create / update / read lifecycle of practitioner
 * assignments on a non-medical user (SECRETAIRE / ASSISTANT). Drives the
 * AdminUserController endpoints exclusively over MockMvc (no direct
 * service calls) so the validation + role-check + JSON contracts are exercised.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class UserAssignmentIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final String URL = "/api/admin/users";
    private static final UUID ROLE_MEDECIN = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN   = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String ADMIN_PWD = "Assignment-Admin-Pwd-2026!";
    private static final String NEW_USER_PWD = "Assignment-User-Pwd-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    private String adminEmail;
    private UUID doc1Id;
    private UUID doc2Id;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM identity_user_assignment");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Admin user
        adminEmail = "assign-admin-" + UUID.randomUUID() + "@test.ma";
        UUID adminId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Admin', 'Boss', TRUE, 0, 0, now(), now())
                """, adminId, adminEmail, passwordEncoder.encode(ADMIN_PWD));
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", adminId, ROLE_ADMIN);

        // Two active MEDECIN
        doc1Id = seedMedecin("Karim", "Zahidi", "Pédiatre");
        doc2Id = seedMedecin("Amina", "Bennani", "Cardiologue");
    }

    private UUID seedMedecin(String firstName, String lastName, String specialty) {
        UUID id = UUID.randomUUID();
        String email = "med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name, specialty,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode("Med-Seed-Pwd-2026!"),
                firstName, lastName, specialty);
        jdbc.update("INSERT INTO identity_user_role VALUES (?, ?)", id, ROLE_MEDECIN);
        return id;
    }

    private String adminBearer() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + adminEmail + "\",\"password\":\"" + ADMIN_PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private UUID createSecretaire(String token, String body) throws Exception {
        MvcResult r = mockMvc.perform(post(URL)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
                .get("id").asText());
    }

    private List<UUID> assignmentsInDb(UUID userId) {
        return jdbc.query(
                "SELECT practitioner_id FROM identity_user_assignment WHERE user_id = ? ORDER BY practitioner_id",
                (rs, i) -> (UUID) rs.getObject("practitioner_id"),
                userId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — create with auto-assign default
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void postSecretaireWithoutAssignedField_autoAssignsToAllActivePractitioners() throws Exception {
        String token = adminBearer();
        String email = "auto-" + UUID.randomUUID() + "@test.ma";
        UUID secId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"Sec","lastName":"Auto",
                 "roles":["SECRETAIRE"]}
                """.formatted(email, NEW_USER_PWD));

        // Both MEDECIN doc1Id + doc2Id should be linked
        List<UUID> rows = assignmentsInDb(secId);
        assertThat(rows).containsExactlyInAnyOrder(doc1Id, doc2Id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — create with explicit subset
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void postSecretaireWithExplicitSingleId_createsOnlyThatRow() throws Exception {
        String token = adminBearer();
        String email = "exp-" + UUID.randomUUID() + "@test.ma";
        UUID secId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"Sec","lastName":"Explicit",
                 "roles":["SECRETAIRE"],
                 "assignedPractitionerIds":["%s"]}
                """.formatted(email, NEW_USER_PWD, doc1Id));

        List<UUID> rows = assignmentsInDb(secId);
        assertThat(rows).containsExactly(doc1Id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — explicit empty list creates nothing
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void postSecretaireWithEmptyList_createsNoAssignment() throws Exception {
        String token = adminBearer();
        String email = "empty-" + UUID.randomUUID() + "@test.ma";
        UUID secId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"Sec","lastName":"Empty",
                 "roles":["SECRETAIRE"],
                 "assignedPractitionerIds":[]}
                """.formatted(email, NEW_USER_PWD));

        assertThat(assignmentsInDb(secId)).isEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT — replaces exact set
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void putWithAssignedField_replacesExactSet() throws Exception {
        String token = adminBearer();
        String email = "rep-" + UUID.randomUUID() + "@test.ma";
        UUID secId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"Sec","lastName":"Replace",
                 "roles":["SECRETAIRE"],
                 "assignedPractitionerIds":["%s","%s"]}
                """.formatted(email, NEW_USER_PWD, doc1Id, doc2Id));
        // Sanity check
        assertThat(assignmentsInDb(secId)).containsExactlyInAnyOrder(doc1Id, doc2Id);

        // Now PUT with a single id
        mockMvc.perform(put(URL + "/" + secId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"assignedPractitionerIds":["%s"]}
                                """.formatted(doc2Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedPractitionerIds.length()").value(1))
                .andExpect(jsonPath("$.assignedPractitionerIds[0]").value(doc2Id.toString()));

        assertThat(assignmentsInDb(secId)).containsExactly(doc2Id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT — without the field preserves current assignments
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void putWithoutAssignedField_preservesExistingAssignments() throws Exception {
        String token = adminBearer();
        String email = "preserve-" + UUID.randomUUID() + "@test.ma";
        UUID secId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"Sec","lastName":"Preserve",
                 "roles":["SECRETAIRE"],
                 "assignedPractitionerIds":["%s"]}
                """.formatted(email, NEW_USER_PWD, doc1Id));
        assertThat(assignmentsInDb(secId)).containsExactly(doc1Id);

        // PUT touching only firstName → assignments unchanged
        mockMvc.perform(put(URL + "/" + secId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"NewFirst"}
                                """))
                .andExpect(status().isOk());

        assertThat(assignmentsInDb(secId)).containsExactly(doc1Id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST MEDECIN never creates assignments
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void postMedecin_neverCreatesAssignments_evenIfFieldProvided() throws Exception {
        String token = adminBearer();
        String email = "med-new-" + UUID.randomUUID() + "@test.ma";
        // We send the field defensively — must be ignored for non-assistant role.
        UUID newDocId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"New","lastName":"Doc",
                 "roles":["MEDECIN"],
                 "assignedPractitionerIds":["%s"]}
                """.formatted(email, NEW_USER_PWD, doc1Id));

        assertThat(assignmentsInDb(newDocId)).isEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /{id} returns assignedPractitionerIds
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void getUserById_returnsAssignedPractitionerIds() throws Exception {
        String token = adminBearer();
        String email = "get-" + UUID.randomUUID() + "@test.ma";
        UUID secId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"Sec","lastName":"Get",
                 "roles":["SECRETAIRE"],
                 "assignedPractitionerIds":["%s","%s"]}
                """.formatted(email, NEW_USER_PWD, doc1Id, doc2Id));

        MvcResult r = mockMvc.perform(get(URL + "/" + secId)
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(secId.toString()))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.assignedPractitionerIds.length()").value(2))
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        // Don't enforce order — assignmentsFor follows DB row order
        var ids = java.util.stream.StreamSupport.stream(body.get("assignedPractitionerIds").spliterator(), false)
                .map(JsonNode::asText)
                .toList();
        assertThat(ids).containsExactlyInAnyOrder(doc1Id.toString(), doc2Id.toString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT — explicit empty list wipes all
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void putWithEmptyArray_wipesAllAssignments() throws Exception {
        String token = adminBearer();
        String email = "wipe-" + UUID.randomUUID() + "@test.ma";
        UUID secId = createSecretaire(token, """
                {"email":"%s",
                 "password":"%s",
                 "firstName":"Sec","lastName":"Wipe",
                 "roles":["SECRETAIRE"],
                 "assignedPractitionerIds":["%s","%s"]}
                """.formatted(email, NEW_USER_PWD, doc1Id, doc2Id));
        assertThat(assignmentsInDb(secId)).hasSize(2);

        mockMvc.perform(put(URL + "/" + secId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"assignedPractitionerIds":[]}
                                """))
                .andExpect(status().isOk());

        assertThat(assignmentsInDb(secId)).isEmpty();
    }
}
