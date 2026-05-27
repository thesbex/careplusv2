package ma.careplus.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.LocalDate;
import ma.careplus.notification.application.AppointmentReminderScheduler;
import ma.careplus.notification.application.NotificationService;
import ma.careplus.scheduling.application.SchedulingService;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentCreatedEvent;
import ma.careplus.scheduling.infrastructure.web.dto.CreateAppointmentRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * IT du module notification (socle v1) — orchestration sans envoyeur réel
 * (provider NoOp → statut SENT_SIMULATED). Couvre :
 * <ol>
 *   <li>patient opt-in canal BOTH → 2 lignes outbox (WHATSAPP + EMAIL), rendues</li>
 *   <li>patient opt-out → 0 ligne</li>
 *   <li>idempotence : composer 2× le même RDV ne crée pas de doublon</li>
 *   <li>bout-en-bout : SchedulingService.create() publie l'event → outbox écrite (AFTER_COMMIT)</li>
 *   <li>canal préféré EMAIL → 1 seule ligne EMAIL</li>
 * </ol>
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
@TestPropertySource(properties = "careplus.notifications.enabled=true")
class NotificationOutboxIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    @Autowired NotificationService notificationService;
    @Autowired SchedulingService schedulingService;
    @Autowired AppointmentReminderScheduler reminderScheduler;
    @Autowired JdbcTemplate jdbc;

    UUID optInPatient;
    UUID optOutPatient;
    UUID practitioner;

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM notification_outbox");
        jdbc.update("DELETE FROM scheduling_appointment");
        jdbc.update("DELETE FROM scheduling_holiday");
        jdbc.update("DELETE FROM patient_patient");

        practitioner = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name,
                     enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, 'x', 'Youssef', 'El Amrani', TRUE, 0, 0, now(), now())
                """, practitioner, "med-" + practitioner + "@test.ma");

        optInPatient = seedPatient("BENNANI", "Salma", "+212600000001", "salma@test.ma", true, null);
        optOutPatient = seedPatient("TAZI", "Karim", "+212600000002", "karim@test.ma", false, null);
    }

    private UUID seedPatient(String last, String first, String phone, String email,
                            boolean optIn, String channel) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient
                    (id, last_name, first_name, gender, tier, version, number_children,
                     status, created_at, updated_at, phone, email,
                     notifications_opt_in, notifications_channel)
                VALUES (?, ?, ?, 'F', 'NORMAL', 0, 0, 'ACTIF', now(), now(), ?, ?, ?, ?)
                """, id, last, first, phone, email, optIn, channel);
        return id;
    }

    private AppointmentCreatedEvent event(UUID patientId, UUID appointmentId) {
        return new AppointmentCreatedEvent(
                UUID.randomUUID(), appointmentId, patientId, practitioner, null,
                OffsetDateTime.of(2030, 6, 12, 10, 30, 0, 0, ZoneOffset.ofHours(1)),
                OffsetDateTime.now());
    }

    @Test
    @DisplayName("1. opt-in BOTH → 2 lignes outbox simulées, corps rendu")
    void optInBoth_twoRows() {
        UUID appt = UUID.randomUUID();
        notificationService.composeAppointmentCreated(event(optInPatient, appt));

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT channel, status, to_address, rendered_body FROM notification_outbox ORDER BY channel");
        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.get("status")).isEqualTo("SENT_SIMULATED");
            assertThat((String) r.get("rendered_body")).contains("Salma");      // {{patientPrenom}}
            assertThat((String) r.get("rendered_body")).contains("12/06/2030"); // {{date}}
            assertThat((String) r.get("rendered_body")).contains("10:30");      // {{heure}}
        });
        // EMAIL → email, WHATSAPP → téléphone
        assertThat(rows.get(0).get("channel")).isEqualTo("EMAIL");
        assertThat(rows.get(0).get("to_address")).isEqualTo("salma@test.ma");
        assertThat(rows.get(1).get("channel")).isEqualTo("WHATSAPP");
        assertThat(rows.get(1).get("to_address")).isEqualTo("+212600000001");
    }

    @Test
    @DisplayName("2. opt-out → aucune ligne")
    void optOut_noRow() {
        notificationService.composeAppointmentCreated(event(optOutPatient, UUID.randomUUID()));
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM notification_outbox", Integer.class);
        assertThat(n).isZero();
    }

    @Test
    @DisplayName("3. idempotence : composer 2× le même RDV ne double pas")
    void dedupe_noDuplicate() {
        UUID appt = UUID.randomUUID();
        notificationService.composeAppointmentCreated(event(optInPatient, appt));
        notificationService.composeAppointmentCreated(event(optInPatient, appt));
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM notification_outbox", Integer.class);
        assertThat(n).isEqualTo(2);
    }

    @Test
    @DisplayName("4. bout-en-bout : create() publie l'event → outbox écrite (AFTER_COMMIT)")
    void create_publishesEvent_writesOutbox() {
        CreateAppointmentRequest req = new CreateAppointmentRequest(
                optInPatient, practitioner, null,
                OffsetDateTime.of(2030, 6, 12, 9, 0, 0, 0, ZoneOffset.ofHours(1)),
                30, null, Boolean.TRUE, null, null);
        Appointment created = schedulingService.create(req);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT dedupe_key FROM notification_outbox WHERE recipient_patient_id = ?", optInPatient);
        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(r ->
                assertThat((String) r.get("dedupe_key")).contains(created.getId().toString()));
    }

    @Test
    @DisplayName("5. canal préféré EMAIL → 1 seule ligne EMAIL")
    void preferEmail_onlyEmail() {
        UUID emailOnly = seedPatient("IDRISSI", "Nadia", "+212600000003", "nadia@test.ma", true, "EMAIL");
        notificationService.composeAppointmentCreated(event(emailOnly, UUID.randomUUID()));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT channel FROM notification_outbox");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).get("channel")).isEqualTo("EMAIL");
    }

    @Test
    @DisplayName("6. rappel J-1 : seuls les RDV actifs du lendemain → outbox REMINDER")
    void reminderJ1_activeNextDayOnly() {
        LocalDate day = LocalDate.of(2030, 6, 12);
        OffsetDateTime at = OffsetDateTime.of(2030, 6, 12, 9, 0, 0, 0, ZoneOffset.ofHours(1));
        // RDV actif (PLANIFIE) du jour cible pour le patient opt-in.
        insertAppointment(optInPatient, at, "PLANIFIE");
        // RDV annulé le même jour → ignoré.
        insertAppointment(optInPatient, at.plusHours(1), "ANNULE");

        int processed = reminderScheduler.sendRemindersFor(day);

        assertThat(processed).isEqualTo(1); // seul le PLANIFIE
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT channel, event_key, rendered_body FROM notification_outbox");
        assertThat(rows).hasSize(2); // WHATSAPP + EMAIL
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.get("event_key")).isEqualTo("APPOINTMENT_REMINDER");
            assertThat((String) r.get("rendered_body")).contains("demain");
        });
    }

    private void insertAppointment(UUID patientId, OffsetDateTime startAt, String status) {
        jdbc.update("""
                INSERT INTO scheduling_appointment
                    (id, patient_id, practitioner_id, start_at, end_at, status,
                     walk_in, urgency, version, created_at, updated_at, type)
                VALUES (?, ?, ?, ?, ?, ?, false, false, 0, now(), now(), 'CONSULTATION')
                """,
                UUID.randomUUID(), patientId, practitioner, startAt, startAt.plusMinutes(30), status);
    }
}
