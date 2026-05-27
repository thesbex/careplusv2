package ma.careplus.notification.application;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Rappel RDV J-1 : chaque soir, balaye les rendez-vous du lendemain (statut
 * actif) et compose un rappel par patient. Idempotent (dedupe_key dans
 * l'outbox) — un re-passage du job ne crée pas de doublon.
 *
 * La logique est exposée via {@link #sendRemindersFor(LocalDate)} pour être
 * testable sans dépendre du déclenchement planifié.
 */
@Component
public class AppointmentReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(AppointmentReminderScheduler.class);
    private static final ZoneId ZONE = ZoneId.of("Africa/Casablanca");

    private final JdbcTemplate jdbc;
    private final NotificationService notificationService;

    public AppointmentReminderScheduler(JdbcTemplate jdbc, NotificationService notificationService) {
        this.jdbc = jdbc;
        this.notificationService = notificationService;
    }

    /** Tous les soirs à 18h (heure cabinet) : rappels pour le lendemain. */
    @Scheduled(cron = "0 0 18 * * *", zone = "Africa/Casablanca")
    public void runDailyReminders() {
        LocalDate tomorrow = LocalDate.now(ZONE).plusDays(1);
        int n = sendRemindersFor(tomorrow);
        log.info("[notif] rappels J-1 composés pour le {} : {} RDV", tomorrow, n);
    }

    /** Compose les rappels pour les RDV actifs du jour cabinet donné. Renvoie le nombre de RDV traités. */
    public int sendRemindersFor(LocalDate cabinetDay) {
        List<Reminder> due = jdbc.query(
                """
                SELECT id, patient_id, practitioner_id, reason_id, start_at
                  FROM scheduling_appointment
                 WHERE (start_at AT TIME ZONE 'Africa/Casablanca')::date = ?
                   AND status IN ('PLANIFIE', 'CONFIRME')
                """,
                (rs, i) -> new Reminder(
                        rs.getObject("id", UUID.class),
                        rs.getObject("patient_id", UUID.class),
                        rs.getObject("practitioner_id", UUID.class),
                        rs.getObject("reason_id", UUID.class),
                        rs.getObject("start_at", OffsetDateTime.class)),
                cabinetDay);
        for (Reminder r : due) {
            notificationService.composeAppointmentReminder(
                    r.appointmentId(), r.patientId(), r.practitionerId(), r.reasonId(), r.startAt());
        }
        return due.size();
    }

    private record Reminder(UUID appointmentId, UUID patientId, UUID practitionerId,
                            UUID reasonId, OffsetDateTime startAt) {}
}
