package ma.careplus.clinical.application;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.infrastructure.web.dto.QueueEntryView;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentStatus;
import ma.careplus.scheduling.infrastructure.persistence.AppointmentRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Presence / queue — the assistant's salle d'attente surface.
 *
 * Check-in transitions PLANIFIE/CONFIRME → ARRIVE and stamps arrived_at.
 * Queue lists appointments whose status is ARRIVE / EN_ATTENTE_CONSTANTES /
 * CONSTANTES_PRISES / EN_CONSULTATION, ordered by scheduled start time.
 *
 * Queue reads go direct via JDBC joining appointments + patients — simpler
 * than two JPA repos and avoids N+1 on what will be a polled endpoint. If
 * this becomes a hotspot we'll project into a denormalised view later.
 */
@Service
@Transactional
public class PresenceService {

    private static final ZoneId CABINET_ZONE = ZoneId.of("Africa/Casablanca");

    private final AppointmentRepository appointmentRepository;
    private final JdbcTemplate jdbc;

    public PresenceService(AppointmentRepository appointmentRepository, JdbcTemplate jdbc) {
        this.appointmentRepository = appointmentRepository;
        this.jdbc = jdbc;
    }

    public Appointment checkIn(UUID appointmentId) {
        Appointment a = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new NotFoundException(
                        "APPT_NOT_FOUND", "Rendez-vous introuvable : " + appointmentId));

        if (a.getStatus() == AppointmentStatus.ANNULE
                || a.getStatus() == AppointmentStatus.NO_SHOW
                || a.getStatus() == AppointmentStatus.CLOS) {
            throw new BusinessException(
                    "APPT_IMMUTABLE",
                    "Impossible d'enregistrer l'arrivée (statut " + a.getStatus() + ").",
                    HttpStatus.CONFLICT.value());
        }
        if (a.getArrivedAt() != null && a.getStatus() != AppointmentStatus.PLANIFIE
                && a.getStatus() != AppointmentStatus.CONFIRME) {
            // already checked in — idempotent
            return a;
        }
        a.setStatus(AppointmentStatus.ARRIVE);
        a.setArrivedAt(OffsetDateTime.now());
        return a;
    }

    @Transactional(readOnly = true)
    public List<QueueEntryView> queueForToday() {
        LocalDate today = LocalDate.now(CABINET_ZONE);
        OffsetDateTime from = today.atStartOfDay(CABINET_ZONE).toOffsetDateTime();
        OffsetDateTime to = today.plusDays(1).atStartOfDay(CABINET_ZONE).toOffsetDateTime();

        return jdbc.query("""
                SELECT a.id, a.patient_id, p.first_name, p.last_name,
                       a.start_at, a.status, a.arrived_at,
                       EXISTS (SELECT 1 FROM patient_allergy al WHERE al.patient_id = a.patient_id) AS has_allergies
                FROM scheduling_appointment a
                JOIN patient_patient p ON p.id = a.patient_id
                WHERE a.start_at >= ?
                  AND a.start_at <  ?
                  AND a.status IN ('ARRIVE','EN_ATTENTE_CONSTANTES','CONSTANTES_PRISES','EN_CONSULTATION')
                ORDER BY a.start_at
                """,
                (rs, i) -> new QueueEntryView(
                        (UUID) rs.getObject("id"),
                        (UUID) rs.getObject("patient_id"),
                        rs.getString("first_name") + " " + rs.getString("last_name"),
                        rs.getObject("start_at", OffsetDateTime.class),
                        rs.getString("status"),
                        rs.getObject("arrived_at", OffsetDateTime.class),
                        rs.getBoolean("has_allergies")),
                from, to);
    }
}
