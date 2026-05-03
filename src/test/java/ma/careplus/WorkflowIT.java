package ma.careplus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end integration test covering WF1→WF6 as a single chained scenario.
 *
 * WF1  — Booking (SECRETAIRE books appointment)
 * WF2  — Check-in (SECRETAIRE checks patient in)
 * WF3  — Vitals  (MEDECIN records TA/temp/weight/height)
 * WF4  — Consultation start + update + sign (MEDECIN)
 * WF5  — Prescription + PDF (MEDECIN)
 * WF6  — Invoice issue + full payment (SECRETAIRE)
 *
 * Uses TestRestTemplate (real HTTP) against RANDOM_PORT.
 * All seed data injected via JDBC — no dev-profile seed dependency.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
class WorkflowIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_wf_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD           = "WorkflowIT-2026!";
    private static final ZoneId CABINET       = ZoneId.of("Africa/Casablanca");

    @LocalServerPort
    int port;

    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    // Seeded IDs
    UUID secId;
    String secEmail;
    UUID medId;
    String medEmail;
    UUID patientId;
    UUID practitionerId;
    UUID actId;
    UUID reasonId;
    UUID medicationId;

    // ── Seed ──────────────────────────────────────────────────────────────────

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();

        // Clean up in dependency order
        jdbc.update("UPDATE billing_invoice SET credit_note_id = NULL");
        jdbc.update("DELETE FROM billing_credit_note");
        jdbc.update("DELETE FROM billing_payment");
        jdbc.update("DELETE FROM billing_invoice_line");
        jdbc.update("DELETE FROM billing_invoice");
        jdbc.update("DELETE FROM catalog_tariff");
        jdbc.update("DELETE FROM clinical_prescription_line");
        jdbc.update("DELETE FROM clinical_prescription");
        jdbc.update("DELETE FROM clinical_vital_signs");
        jdbc.update("DELETE FROM clinical_consultation");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM scheduling_appointment_reason WHERE code = 'WF-CONSULTATION'");
        jdbc.update("DELETE FROM catalog_act WHERE code = 'WF-CONSULT-ACT'");
        jdbc.update("DELETE FROM catalog_medication WHERE commercial_name = 'Doliprane-WF'");
        jdbc.update("DELETE FROM patient_patient");
        jdbc.update("DELETE FROM identity_user_role");
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_user");

        // Reset billing sequence
        int year = java.time.Year.now().getValue();
        jdbc.update("UPDATE billing_invoice_sequence SET next_value = 1 WHERE year = ?", year);

        // Secrétaire user
        secId = UUID.randomUUID();
        secEmail = "wf-sec-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Fatima', 'Zahra', TRUE, 0, 0, now(), now())
                """, secId, secEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", secId, ROLE_SECRETAIRE);

        // Médecin user
        medId = UUID.randomUUID();
        medEmail = "wf-med-" + UUID.randomUUID() + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, 'Youssef', 'El Amrani', TRUE, 0, 0, now(), now())
                """, medId, medEmail, passwordEncoder.encode(PWD));
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", medId, ROLE_MEDECIN);

        practitionerId = medId;

        // Patient (NORMAL tier, no allergies)
        patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, gender, tier,
                    version, number_children, status, created_at, updated_at)
                VALUES (?, 'Alami', 'Mohammed', 'M', 'NORMAL', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        // Catalog act
        actId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_act (id, code, name, default_price, vat_rate, active, type,
                    created_at, updated_at)
                VALUES (?, 'WF-CONSULT-ACT', 'Consultation WF Test', 300.00, 0, TRUE, 'CONSULTATION',
                    now(), now())
                """, actId);

        // Tariff for NORMAL tier
        jdbc.update("""
                INSERT INTO catalog_tariff (id, act_id, tier, amount, effective_from, created_at, updated_at)
                VALUES (gen_random_uuid(), ?, 'NORMAL', 300.00, '2020-01-01', now(), now())
                """, actId);

        // Appointment reason linked to act
        reasonId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scheduling_appointment_reason (id, code, label, duration_minutes, default_act_id,
                    active, created_at, updated_at)
                VALUES (?, 'WF-CONSULTATION', 'Consultation Workflow', 30, ?, TRUE, now(), now())
                """, reasonId, actId);

        // Medication for prescription (no ATC tag → no allergy conflict)
        medicationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags, favorite,
                    created_at, updated_at)
                VALUES (?, 'Doliprane-WF', 'Paracétamol', 'comprimé', '1g', 'antalgique', FALSE,
                    now(), now())
                """, medicationId);
    }

    // ── Token helper ──────────────────────────────────────────────────────────

    private String login(String email) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> resp = rest.exchange(
                url("/api/auth/login"), HttpMethod.POST,
                new HttpEntity<>(body, headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return "Bearer " + mapper.readTree(resp.getBody()).get("accessToken").asText();
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("Authorization", token);
        return h;
    }

    private JsonNode get(String path, String token) throws Exception {
        ResponseEntity<String> resp = rest.exchange(
                url(path), HttpMethod.GET,
                new HttpEntity<>(authHeaders(token)), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return mapper.readTree(resp.getBody());
    }

    private JsonNode post(String path, String body, String token, HttpStatus expected) throws Exception {
        ResponseEntity<String> resp = rest.exchange(
                url(path), HttpMethod.POST,
                new HttpEntity<>(body, authHeaders(token)), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(expected);
        String responseBody = resp.getBody();
        return (responseBody != null && !responseBody.isBlank()) ? mapper.readTree(responseBody) : mapper.createObjectNode();
    }

    private JsonNode put(String path, String body, String token) throws Exception {
        ResponseEntity<String> resp = rest.exchange(
                url(path), HttpMethod.PUT,
                new HttpEntity<>(body, authHeaders(token)), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return mapper.readTree(resp.getBody());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Next Tuesday at 09:00 Casablanca, at least 1 day from now. */
    private OffsetDateTime nextTuesday9am() {
        LocalDate d = LocalDate.now(CABINET).plusDays(1);
        while (d.getDayOfWeek().getValue() != 2) d = d.plusDays(1);
        return d.atTime(9, 0).atZone(CABINET).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
    }

    // ── WF1–WF6 chained scenario ──────────────────────────────────────────────

    @Test
    void fullWorkflowWF1ToWF6() throws Exception {

        // ── WF1: Booking ──────────────────────────────────────────────────────
        String secToken = login(secEmail);

        // Search patient by name → should return seeded patient
        JsonNode searchResult = get("/api/patients?q=Mohammed", secToken);
        assertThat(searchResult.get("content")).isNotNull();
        assertThat(searchResult.get("content").size()).isGreaterThanOrEqualTo(1);
        String foundPatientId = searchResult.get("content").get(0).get("id").asText();
        assertThat(UUID.fromString(foundPatientId)).isEqualTo(patientId);

        // Get availability
        OffsetDateTime slotStart = nextTuesday9am();
        OffsetDateTime slotEnd = slotStart.plusHours(3);
        String availUrl = "/api/availability?practitionerId=" + practitionerId
                + "&from=" + slotStart.toString()
                + "&to=" + slotEnd.toString()
                + "&durationMinutes=30";
        JsonNode slots = get(availUrl, secToken);
        assertThat(slots.isArray()).isTrue();
        assertThat(slots.size()).isGreaterThan(0);

        // Create appointment at the first available slot
        String apptStartAt = slots.get(0).get("startAt").asText();
        String createApptBody = mapper.writeValueAsString(Map.of(
                "patientId", patientId.toString(),
                "practitionerId", practitionerId.toString(),
                "startAt", apptStartAt,
                "durationMinutes", 30,
                "reasonId", reasonId.toString()
        ));
        JsonNode apptNode = post("/api/appointments", createApptBody, secToken, HttpStatus.CREATED);
        String appointmentId = apptNode.get("id").asText();
        assertThat(appointmentId).isNotBlank();

        // ── WF2: Check-in ─────────────────────────────────────────────────────
        // Advance appointment time to today so check-in is valid
        jdbc.update("UPDATE scheduling_appointment SET start_at = now() - interval '5 minutes', end_at = now() + interval '25 minutes' WHERE id = ?::uuid",
                appointmentId);

        post("/api/appointments/" + appointmentId + "/check-in", "", secToken, HttpStatus.NO_CONTENT);

        // Verify appointment is in the queue
        String medToken = login(medEmail);
        JsonNode queue = get("/api/queue", medToken);
        assertThat(queue.isArray()).isTrue();
        boolean foundInQueue = false;
        for (JsonNode entry : queue) {
            if (appointmentId.equals(entry.get("appointmentId").asText())) {
                foundInQueue = true;
                break;
            }
        }
        assertThat(foundInQueue).as("Appointment should appear in queue after check-in").isTrue();

        // ── WF3: Vitals ───────────────────────────────────────────────────────
        // Record vitals — MEDECIN
        String vitalsBody = """
                {
                  "systolicMmhg": 120,
                  "diastolicMmhg": 80,
                  "heartRateBpm": 72,
                  "spo2Percent": 98,
                  "temperatureC": 37.2,
                  "weightKg": 75.0,
                  "heightCm": 175.0
                }
                """;
        JsonNode vitalsNode = post("/api/appointments/" + appointmentId + "/vitals",
                vitalsBody, medToken, HttpStatus.CREATED);
        assertThat(vitalsNode.get("bmi")).isNotNull();
        // BMI = 75 / (1.75^2) ≈ 24.49
        double bmi = vitalsNode.get("bmi").asDouble();
        assertThat(bmi).isBetween(24.0, 25.0);

        // ── WF4: Consultation ─────────────────────────────────────────────────
        // Start consultation
        String startConsultBody = mapper.writeValueAsString(Map.of(
                "patientId", patientId.toString(),
                "appointmentId", appointmentId,
                "motif", "Contrôle tension artérielle"
        ));
        JsonNode consultNode = post("/api/consultations", startConsultBody, medToken, HttpStatus.CREATED);
        String consultationId = consultNode.get("id").asText();
        assertThat(consultationId).isNotBlank();
        assertThat(consultNode.get("status").asText()).isEqualTo("BROUILLON");

        // Update consultation with SOAP fields
        String updateBody = """
                {
                  "motif": "Contrôle tension artérielle",
                  "examination": "TA 12/8, FC 72 bpm, poids 75 kg",
                  "diagnosis": "HTA bien contrôlée sous traitement",
                  "notes": "Continuer Amlor 5mg, prochain contrôle dans 3 mois"
                }
                """;
        JsonNode updatedConsult = put("/api/consultations/" + consultationId, updateBody, medToken);
        assertThat(updatedConsult.get("diagnosis").asText()).isEqualTo("HTA bien contrôlée sous traitement");

        // ── WF5: Prescription (before sign — consultation must be BROUILLON) ──
        // Create drug prescription with one line (paracetamol, no allergy conflict)
        String prescBody = mapper.writeValueAsString(Map.of(
                "type", "DRUG",
                "allergyOverride", false,
                "lines", List.of(Map.of(
                        "medicationId", medicationId.toString(),
                        "dosage", "1g",
                        "frequency", "3 fois par jour",
                        "duration", "5 jours",
                        "quantity", 2
                ))
        ));
        JsonNode prescNode = post("/api/consultations/" + consultationId + "/prescriptions",
                prescBody, medToken, HttpStatus.CREATED);
        String prescriptionId = prescNode.get("id").asText();
        assertThat(prescriptionId).isNotBlank();

        // Sign consultation (after prescription — clinically correct)
        JsonNode signedConsult = post("/api/consultations/" + consultationId + "/sign",
                "", medToken, HttpStatus.OK);
        assertThat(signedConsult.get("status").asText()).isEqualTo("SIGNEE");
        assertThat(signedConsult.get("signedAt").asText()).isNotBlank();

        // Get PDF — verify Content-Type and body not empty
        HttpHeaders pdfHeaders = new HttpHeaders();
        pdfHeaders.set("Authorization", medToken);
        ResponseEntity<byte[]> pdfResp = rest.exchange(
                url("/api/prescriptions/" + prescriptionId + "/pdf"),
                HttpMethod.GET,
                new HttpEntity<>(pdfHeaders),
                byte[].class);
        assertThat(pdfResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pdfResp.getHeaders().getContentType()).isNotNull();
        assertThat(pdfResp.getHeaders().getContentType().toString()).contains("application/pdf");
        assertThat(pdfResp.getBody()).isNotNull();
        assertThat(pdfResp.getBody().length).isGreaterThan(100);

        // ── WF6: Billing ──────────────────────────────────────────────────────
        // Wait for draft invoice to be created (AFTER_COMMIT event listener)
        String[] invoiceIdHolder = new String[1];
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            ResponseEntity<String> invResp = rest.exchange(
                    url("/api/consultations/" + consultationId + "/invoice"),
                    HttpMethod.GET,
                    new HttpEntity<>(authHeaders(secToken)),
                    String.class);
            assertThat(invResp.getStatusCode()).isEqualTo(HttpStatus.OK);
            JsonNode inv = mapper.readTree(invResp.getBody());
            assertThat(inv.get("status").asText()).isEqualTo("BROUILLON");
            invoiceIdHolder[0] = inv.get("id").asText();
        });
        String invoiceId = invoiceIdHolder[0];
        assertThat(invoiceId).isNotBlank();

        // Issue invoice → sequential number
        JsonNode issuedNode = post("/api/invoices/" + invoiceId + "/issue",
                "", secToken, HttpStatus.OK);
        String invoiceNumber = issuedNode.get("number").asText();
        int year = java.time.Year.now().getValue();
        assertThat(invoiceNumber).matches(year + "-\\d{6}");

        // Verify status = EMISE
        JsonNode issuedInvoice = get("/api/invoices/" + invoiceId, secToken);
        assertThat(issuedInvoice.get("status").asText()).isEqualTo("EMISE");

        // Record full payment
        double netAmount = issuedNode.get("netAmount").asDouble();
        String paymentBody = mapper.writeValueAsString(Map.of(
                "amount", netAmount,
                "mode", "ESPECES"
        ));
        JsonNode paymentNode = post("/api/invoices/" + invoiceId + "/payments",
                paymentBody, secToken, HttpStatus.OK);
        assertThat(paymentNode.get("amount").asDouble()).isEqualTo(netAmount);

        // Verify final invoice status = PAYEE_TOTALE
        JsonNode paidInvoice = get("/api/invoices/" + invoiceId, secToken);
        assertThat(paidInvoice.get("status").asText()).isEqualTo("PAYEE_TOTALE");
    }
}
