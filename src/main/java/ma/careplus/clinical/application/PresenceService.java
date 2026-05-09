package ma.careplus.clinical.application;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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
        return checkIn(appointmentId, null);
    }

    /**
     * Check-in with optional room reassignment. When {@code roomId} is non-null
     * the appointment's room is overwritten before the status transitions —
     * including for already-checked-in entries (idempotent path). This lets a
     * secretary reassign a salle on the spot without going through the
     * "Déplacer le RDV" flow.
     */
    public Appointment checkIn(UUID appointmentId, UUID roomId) {
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
        if (roomId != null) {
            a.setRoomId(roomId);
        }
        if (a.getArrivedAt() != null && a.getStatus() != AppointmentStatus.PLANIFIE
                && a.getStatus() != AppointmentStatus.CONFIRME) {
            // already checked in — idempotent on status, room update above still applies
            return a;
        }
        a.setStatus(AppointmentStatus.ARRIVE);
        a.setArrivedAt(OffsetDateTime.now());
        return a;
    }

    @Transactional(readOnly = true)
    public List<QueueEntryView> queueForToday() {
        return queueForToday(Optional.empty());
    }

    /**
     * Same as {@link #queueForToday()} but additionally restricts the result to
     * the given practitioner scope. {@link Optional#empty()} = no restriction
     * (admin / cabinet solo / strict isolation off). An empty set returns
     * nothing — the caller has no assigned practitioner.
     */
    @Transactional(readOnly = true)
    public List<QueueEntryView> queueForToday(Optional<Set<UUID>> scope) {
        if (scope.isPresent() && scope.get().isEmpty()) {
            return Collections.emptyList();
        }
        LocalDate today = LocalDate.now(CABINET_ZONE);
        OffsetDateTime from = today.atStartOfDay(CABINET_ZONE).toOffsetDateTime();
        OffsetDateTime to = today.plusDays(1).atStartOfDay(CABINET_ZONE).toOffsetDateTime();

        StringBuilder sql = new StringBuilder("""
                SELECT a.id, a.patient_id, p.first_name, p.last_name,
                       p.birth_date, p.tier,
                       a.start_at, a.end_at, a.status, a.arrived_at,
                       r.label AS reason_label,
                       u.first_name AS prac_first, u.last_name AS prac_last,
                       cr.id AS room_id, cr.name AS room_name,
                       EXISTS (SELECT 1 FROM patient_allergy al WHERE al.patient_id = a.patient_id) AS has_allergies
                FROM scheduling_appointment a
                JOIN patient_patient p ON p.id = a.patient_id
                LEFT JOIN scheduling_appointment_reason r ON r.id = a.reason_id
                LEFT JOIN identity_user u ON u.id = a.practitioner_id
                LEFT JOIN clinic_room cr ON cr.id = a.room_id
                WHERE a.start_at >= ?
                  AND a.start_at <  ?
                  AND a.status IN ('ARRIVE','EN_ATTENTE_CONSTANTES','CONSTANTES_PRISES','EN_CONSULTATION')
                """);
        java.util.List<Object> args = new java.util.ArrayList<>();
        args.add(from);
        args.add(to);
        if (scope.isPresent()) {
            Set<UUID> allowed = scope.get();
            String placeholders = String.join(",", Collections.nCopies(allowed.size(), "?"));
            sql.append("  AND a.practitioner_id IN (").append(placeholders).append(")\n");
            args.addAll(allowed);
        }
        sql.append("ORDER BY a.start_at");

        return jdbc.query(sql.toString(),
                (rs, i) -> {
                    LocalDate birth = rs.getObject("birth_date", LocalDate.class);
                    Integer age = birth != null ? Period.between(birth, today).getYears() : null;
                    OffsetDateTime startAt = rs.getObject("start_at", OffsetDateTime.class);
                    OffsetDateTime endAt = rs.getObject("end_at", OffsetDateTime.class);
                    Integer duration = (startAt != null && endAt != null)
                            ? (int) Duration.between(startAt, endAt).toMinutes()
                            : null;
                    String pracFirst = rs.getString("prac_first");
                    String pracLast = rs.getString("prac_last");
                    String pracName = (pracFirst != null && pracLast != null)
                            ? ("Dr. " + pracFirst + " " + pracLast)
                            : null;
                    String tier = rs.getString("tier");
                    UUID roomId = (UUID) rs.getObject("room_id");
                    String roomName = rs.getString("room_name");
                    return new QueueEntryView(
                            (UUID) rs.getObject("id"),
                            (UUID) rs.getObject("patient_id"),
                            rs.getString("first_name") + " " + rs.getString("last_name"),
                            startAt,
                            rs.getString("status"),
                            rs.getObject("arrived_at", OffsetDateTime.class),
                            rs.getBoolean("has_allergies"),
                            age,
                            rs.getString("reason_label"),
                            pracName,
                            duration,
                            "PREMIUM".equals(tier),
                            roomId,
                            roomName);
                },
                args.toArray());
    }
}
