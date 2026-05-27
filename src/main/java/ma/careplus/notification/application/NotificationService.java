package ma.careplus.notification.application;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import ma.careplus.notification.domain.NotificationChannel;
import ma.careplus.notification.domain.NotificationOutbox;
import ma.careplus.notification.domain.NotificationStatus;
import ma.careplus.notification.domain.NotificationTemplate;
import ma.careplus.notification.infrastructure.persistence.NotificationOutboxRepository;
import ma.careplus.notification.infrastructure.persistence.NotificationTemplateRepository;
import ma.careplus.scheduling.domain.AppointmentCreatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Orchestration des notifications sortantes. Lit le contexte (patient, médecin,
 * cabinet) en JdbcTemplate cross-module (lecture seule, comme BillingService),
 * rend le template, écrit l'outbox puis délègue l'envoi au dispatcher.
 *
 * Confidentialité : envoi UNIQUEMENT si le patient a consenti
 * ({@code notifications_opt_in}) et qu'un contact existe pour le canal.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final ZoneId ZONE = ZoneId.of("Africa/Casablanca");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", Locale.FRENCH);
    private static final String EVENT_APPOINTMENT_CREATED = "APPOINTMENT_CREATED";

    private final JdbcTemplate jdbc;
    private final NotificationTemplateRepository templates;
    private final NotificationOutboxRepository outbox;
    private final NotificationDispatcher dispatcher;
    private final TemplateRenderer renderer;
    private final NotificationProperties props;

    public NotificationService(JdbcTemplate jdbc,
                               NotificationTemplateRepository templates,
                               NotificationOutboxRepository outbox,
                               NotificationDispatcher dispatcher,
                               TemplateRenderer renderer,
                               NotificationProperties props) {
        this.jdbc = jdbc;
        this.templates = templates;
        this.outbox = outbox;
        this.dispatcher = dispatcher;
        this.renderer = renderer;
        this.props = props;
    }

    /**
     * AFTER_COMMIT : le RDV est bien persisté. Nouvelle transaction pour écrire
     * l'outbox — un échec notification ne doit jamais annuler la création du RDV.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAppointmentCreated(AppointmentCreatedEvent event) {
        try {
            composeAppointmentCreated(event);
        } catch (RuntimeException ex) {
            // Jamais bloquant : on log et on laisse le RDV exister.
            log.error("[notif] échec composition notification RDV {} : {}",
                    event.appointmentId(), ex.getMessage(), ex);
        }
    }

    /** Visible pour les tests : compose et dispatch sans dépendre de l'AFTER_COMMIT. */
    public void composeAppointmentCreated(AppointmentCreatedEvent event) {
        if (!props.isEnabled()) {
            return;
        }
        Patient patient = loadPatient(event.patientId());
        if (patient == null || !patient.optIn) {
            return; // pas de consentement → rien.
        }

        Map<String, String> ctx = buildContext(patient, event);
        for (NotificationChannel channel : resolveChannels(patient)) {
            String dedupe = EVENT_APPOINTMENT_CREATED + ":" + event.appointmentId() + ":" + channel.name();
            if (outbox.existsByDedupeKey(dedupe)) {
                continue; // idempotent
            }
            List<NotificationTemplate> found = templates.findActive(EVENT_APPOINTMENT_CREATED, channel.name());
            if (found.isEmpty()) {
                continue; // pas de modèle actif pour ce canal
            }
            NotificationTemplate tpl = found.get(0);
            String to = channel == NotificationChannel.WHATSAPP ? patient.phone : patient.email;
            if (to == null || to.isBlank()) {
                continue;
            }

            NotificationOutbox row = new NotificationOutbox();
            row.setEventKey(EVENT_APPOINTMENT_CREATED);
            row.setChannel(channel.name());
            row.setRecipientPatientId(patient.id);
            row.setToAddress(to.trim());
            row.setRenderedSubject(tpl.getSubject() == null ? null : renderer.render(tpl.getSubject(), ctx));
            row.setRenderedBody(renderer.render(tpl.getBody(), ctx));
            row.setStatus(NotificationStatus.PENDING.name());
            row.setDedupeKey(dedupe);
            outbox.save(row);
            dispatcher.dispatch(row);
        }
    }

    // ── Contexte ────────────────────────────────────────────────────────────

    private Map<String, String> buildContext(Patient patient, AppointmentCreatedEvent event) {
        Map<String, String> ctx = new HashMap<>();
        ctx.put("patientNom", patient.lastName == null ? "" : patient.lastName);
        ctx.put("patientPrenom", patient.firstName == null ? "" : patient.firstName);
        var z = event.startAt().atZoneSameInstant(ZONE);
        ctx.put("date", z.format(DATE_FMT));
        ctx.put("heure", z.format(TIME_FMT));
        ctx.put("medecin", practitionerName(event.practitionerId()));
        ctx.put("cabinet", cabinetName());
        ctx.put("motif", reasonLabel(event.reasonId()));
        return ctx;
    }

    private List<NotificationChannel> resolveChannels(Patient p) {
        List<NotificationChannel> out = new ArrayList<>();
        String pref = p.channel == null ? "BOTH" : p.channel;
        boolean both = "BOTH".equalsIgnoreCase(pref);
        if (both || "WHATSAPP".equalsIgnoreCase(pref)) out.add(NotificationChannel.WHATSAPP);
        if (both || "EMAIL".equalsIgnoreCase(pref)) out.add(NotificationChannel.EMAIL);
        return out;
    }

    private Patient loadPatient(UUID patientId) {
        List<Patient> rows = jdbc.query(
                """
                SELECT id, last_name, first_name, phone, email,
                       notifications_opt_in, notifications_channel
                  FROM patient_patient
                 WHERE id = ? AND deleted_at IS NULL
                """,
                (rs, i) -> {
                    Patient p = new Patient();
                    p.id = rs.getObject("id", UUID.class);
                    p.lastName = rs.getString("last_name");
                    p.firstName = rs.getString("first_name");
                    p.phone = rs.getString("phone");
                    p.email = rs.getString("email");
                    p.optIn = rs.getBoolean("notifications_opt_in");
                    p.channel = rs.getString("notifications_channel");
                    return p;
                },
                patientId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String practitionerName(UUID practitionerId) {
        if (practitionerId == null) return "";
        List<String> names = jdbc.query(
                "SELECT first_name, last_name FROM identity_user WHERE id = ?",
                (rs, i) -> ("Dr " + safe(rs.getString("first_name")) + " " + safe(rs.getString("last_name"))).trim(),
                practitionerId);
        return names.isEmpty() ? "" : names.get(0);
    }

    private String reasonLabel(UUID reasonId) {
        if (reasonId == null) return "";
        List<String> labels = jdbc.query(
                "SELECT label FROM scheduling_appointment_reason WHERE id = ?",
                (rs, i) -> rs.getString("label"),
                reasonId);
        return labels.isEmpty() ? "" : safe(labels.get(0));
    }

    private String cabinetName() {
        List<String> names = jdbc.query(
                "SELECT name FROM configuration_clinic_settings LIMIT 1",
                (rs, i) -> rs.getString("name"));
        return names.isEmpty() ? "" : safe(names.get(0));
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    /** Vue interne du patient pour la notification. */
    private static final class Patient {
        UUID id;
        String lastName;
        String firstName;
        String phone;
        String email;
        boolean optIn;
        String channel;
    }
}
