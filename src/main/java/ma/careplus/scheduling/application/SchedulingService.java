package ma.careplus.scheduling.application;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentReason;
import ma.careplus.scheduling.domain.AppointmentStatus;
import ma.careplus.scheduling.domain.PractitionerLeave;
import ma.careplus.scheduling.domain.WorkingHours;
import ma.careplus.scheduling.infrastructure.persistence.AppointmentReasonRepository;
import ma.careplus.scheduling.infrastructure.persistence.AppointmentRepository;
import ma.careplus.scheduling.infrastructure.persistence.HolidayRepository;
import ma.careplus.scheduling.infrastructure.persistence.PractitionerLeaveRepository;
import ma.careplus.scheduling.infrastructure.persistence.WorkingHoursRepository;
import ma.careplus.scheduling.infrastructure.web.dto.CreateLeaveRequest;
import ma.careplus.scheduling.infrastructure.web.dto.AvailabilitySlot;
import ma.careplus.scheduling.infrastructure.web.dto.CancelAppointmentRequest;
import ma.careplus.scheduling.infrastructure.web.dto.CreateAppointmentRequest;
import ma.careplus.scheduling.infrastructure.web.dto.MoveAppointmentRequest;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Scheduling domain service — appointment CRUD with conflict detection,
 * Moroccan-holiday refusal, and availability slot computation.
 *
 * Decisions:
 *   - Conflict detection rejects any overlapping non-cancelled appointment on
 *     the same practitioner UNLESS the new appointment has urgency=true, which
 *     represents the "walk-in emergency squeezed into the schedule" path.
 *   - Holiday refusal is hard: even urgence cannot be booked on a seeded
 *     Moroccan holiday via this API. Override would require direct DB + audit.
 *   - Availability is computed per day by taking the configured WorkingHours
 *     ranges for the day-of-week, subtracting existing non-cancelled appointments,
 *     and slicing the remainder into slots of the requested duration.
 *   - All DB times are TIMESTAMPTZ. We normalise to Africa/Casablanca for
 *     day-of-week + working-hours matching.
 */
@Service
@Transactional
public class SchedulingService {

    private static final ZoneId CABINET_ZONE = ZoneId.of("Africa/Casablanca");

    private final AppointmentRepository appointmentRepository;
    private final AppointmentReasonRepository reasonRepository;
    private final WorkingHoursRepository workingHoursRepository;
    private final HolidayRepository holidayRepository;
    private final PractitionerLeaveRepository leaveRepository;

    public SchedulingService(AppointmentRepository appointmentRepository,
                             AppointmentReasonRepository reasonRepository,
                             WorkingHoursRepository workingHoursRepository,
                             HolidayRepository holidayRepository,
                             PractitionerLeaveRepository leaveRepository) {
        this.appointmentRepository = appointmentRepository;
        this.reasonRepository = reasonRepository;
        this.workingHoursRepository = workingHoursRepository;
        this.holidayRepository = holidayRepository;
        this.leaveRepository = leaveRepository;
    }

    // ── Create ─────────────────────────────────────────────────────

    public Appointment create(CreateAppointmentRequest req) {
        int duration = resolveDuration(req.reasonId(), req.durationMinutes());
        OffsetDateTime start = req.startAt();
        OffsetDateTime end = start.plusMinutes(duration);

        LocalDate dayInCabinet = start.atZoneSameInstant(CABINET_ZONE).toLocalDate();
        if (holidayRepository.findByDate(dayInCabinet).isPresent()) {
            throw new BusinessException(
                    "APPT_ON_HOLIDAY",
                    "Impossible de créer un rendez-vous un jour férié.",
                    HttpStatus.CONFLICT.value());
        }
        if (leaveRepository.existsActiveOnDate(req.practitionerId(), dayInCabinet)) {
            throw new BusinessException(
                    "APPT_ON_LEAVE",
                    "Le praticien est en congé ce jour-là.",
                    HttpStatus.CONFLICT.value());
        }

        boolean urgency = Boolean.TRUE.equals(req.urgency());
        if (!urgency) {
            List<Appointment> overlapping = appointmentRepository.findOverlapping(
                    req.practitionerId(), start, end, null);
            if (!overlapping.isEmpty()) {
                throw new BusinessException(
                        "APPT_CONFLICT",
                        "Créneau déjà occupé pour ce praticien.",
                        HttpStatus.CONFLICT.value());
            }
        }

        Appointment a = new Appointment();
        a.setPatientId(req.patientId());
        a.setPractitionerId(req.practitionerId());
        a.setReasonId(req.reasonId());
        a.setStartAt(start);
        a.setEndAt(end);
        a.setStatus(AppointmentStatus.PLANIFIE);
        a.setWalkIn(Boolean.TRUE.equals(req.walkIn()));
        a.setUrgency(urgency);
        return appointmentRepository.save(a);
    }

    // ── Read ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Appointment get(UUID id) {
        return appointmentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("APPT_NOT_FOUND", "Rendez-vous introuvable : " + id));
    }

    @Transactional(readOnly = true)
    public List<Appointment> listInWindow(UUID practitionerId, OffsetDateTime from, OffsetDateTime to) {
        return appointmentRepository.findInWindow(practitionerId, from, to);
    }

    // ── Move ───────────────────────────────────────────────────────

    public Appointment move(UUID id, MoveAppointmentRequest req) {
        Appointment existing = get(id);

        if (existing.getStatus() == AppointmentStatus.ANNULE
                || existing.getStatus() == AppointmentStatus.NO_SHOW
                || existing.getStatus() == AppointmentStatus.CLOS) {
            throw new BusinessException(
                    "APPT_IMMUTABLE",
                    "Ce rendez-vous ne peut plus être déplacé (statut " + existing.getStatus() + ").",
                    HttpStatus.CONFLICT.value());
        }

        int duration = req.durationMinutes() != null
                ? req.durationMinutes()
                : (int) java.time.Duration.between(existing.getStartAt(), existing.getEndAt()).toMinutes();
        OffsetDateTime newStart = req.startAt();
        OffsetDateTime newEnd = newStart.plusMinutes(duration);

        LocalDate dayInCabinet = newStart.atZoneSameInstant(CABINET_ZONE).toLocalDate();
        if (holidayRepository.findByDate(dayInCabinet).isPresent()) {
            throw new BusinessException(
                    "APPT_ON_HOLIDAY",
                    "Impossible de déplacer un rendez-vous vers un jour férié.",
                    HttpStatus.CONFLICT.value());
        }
        if (leaveRepository.existsActiveOnDate(existing.getPractitionerId(), dayInCabinet)) {
            throw new BusinessException(
                    "APPT_ON_LEAVE",
                    "Le praticien est en congé ce jour-là.",
                    HttpStatus.CONFLICT.value());
        }

        List<Appointment> overlap = appointmentRepository.findOverlapping(
                existing.getPractitionerId(), newStart, newEnd, existing.getId());
        if (!overlap.isEmpty() && !existing.isUrgency()) {
            throw new BusinessException(
                    "APPT_CONFLICT",
                    "Nouveau créneau en conflit avec un autre rendez-vous.",
                    HttpStatus.CONFLICT.value());
        }

        existing.setStartAt(newStart);
        existing.setEndAt(newEnd);
        return existing;
    }

    // ── Cancel ─────────────────────────────────────────────────────

    public Appointment cancel(UUID id, CancelAppointmentRequest req) {
        Appointment a = get(id);
        if (a.getStatus() == AppointmentStatus.ANNULE) {
            return a; // idempotent
        }
        if (a.getStatus() == AppointmentStatus.CLOS) {
            throw new BusinessException(
                    "APPT_IMMUTABLE",
                    "Un rendez-vous clos ne peut être annulé.",
                    HttpStatus.CONFLICT.value());
        }
        a.setStatus(AppointmentStatus.ANNULE);
        if (req != null && req.reason() != null) a.setCancelReason(req.reason());
        return a;
    }

    // ── Availability ───────────────────────────────────────────────

    /**
     * Computes free slots across [from, to) for the cabinet, in `durationMinutes`
     * increments. Takes working-hours ranges per day minus holidays minus all
     * non-cancelled appointments on the given practitioner. Caller specifies
     * reasonId OR durationMinutes directly.
     */
    @Transactional(readOnly = true)
    public List<AvailabilitySlot> availability(
            UUID practitionerId,
            OffsetDateTime from,
            OffsetDateTime to,
            UUID reasonId,
            Integer durationMinutes) {
        int slotMinutes = resolveDuration(reasonId, durationMinutes);
        if (slotMinutes <= 0) slotMinutes = 30;

        List<AvailabilitySlot> slots = new ArrayList<>();
        LocalDate day = from.atZoneSameInstant(CABINET_ZONE).toLocalDate();
        LocalDate endDay = to.atZoneSameInstant(CABINET_ZONE).toLocalDate();

        while (!day.isAfter(endDay)) {
            if (holidayRepository.findByDate(day).isEmpty()
                    && !leaveRepository.existsActiveOnDate(practitionerId, day)) {
                int dow = day.getDayOfWeek().getValue();
                for (WorkingHours wh : workingHoursRepository.findByDayOfWeekAndActiveTrue(dow)) {
                    emitSlotsForRange(day, wh, practitionerId, slotMinutes, from, to, slots);
                }
            }
            day = day.plusDays(1);
        }
        return slots;
    }

    private void emitSlotsForRange(
            LocalDate day,
            WorkingHours wh,
            UUID practitionerId,
            int slotMinutes,
            OffsetDateTime windowFrom,
            OffsetDateTime windowTo,
            List<AvailabilitySlot> out) {
        OffsetDateTime rangeStart = LocalDateTime.of(day, wh.getStartTime())
                .atZone(CABINET_ZONE).toOffsetDateTime();
        OffsetDateTime rangeEnd = LocalDateTime.of(day, wh.getEndTime())
                .atZone(CABINET_ZONE).toOffsetDateTime();

        // Clip to the caller's overall window
        OffsetDateTime cursor = rangeStart.isBefore(windowFrom) ? windowFrom : rangeStart;
        OffsetDateTime end = rangeEnd.isAfter(windowTo) ? windowTo : rangeEnd;
        if (!cursor.isBefore(end)) return;

        List<Appointment> taken = appointmentRepository.findOverlapping(
                practitionerId, cursor, end, null);

        for (Appointment a : taken) {
            OffsetDateTime aStart = a.getStartAt();
            // Emit slots between cursor and the taken appointment's start
            while (cursor.plusMinutes(slotMinutes).compareTo(aStart) <= 0) {
                out.add(new AvailabilitySlot(
                        cursor, cursor.plusMinutes(slotMinutes), slotMinutes));
                cursor = cursor.plusMinutes(slotMinutes);
            }
            // Advance past the taken block
            if (a.getEndAt().isAfter(cursor)) cursor = a.getEndAt();
        }
        // Trailing free block
        while (cursor.plusMinutes(slotMinutes).compareTo(end) <= 0) {
            out.add(new AvailabilitySlot(
                    cursor, cursor.plusMinutes(slotMinutes), slotMinutes));
            cursor = cursor.plusMinutes(slotMinutes);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────

    private int resolveDuration(UUID reasonId, Integer explicit) {
        if (explicit != null && explicit > 0) return explicit;
        if (reasonId != null) {
            AppointmentReason r = reasonRepository.findById(reasonId)
                    .orElseThrow(() -> new NotFoundException(
                            "REASON_NOT_FOUND", "Motif inconnu : " + reasonId));
            return r.getDurationMinutes();
        }
        return 30; // sensible default
    }

    @Transactional(readOnly = true)
    public List<AppointmentReason> listActiveReasons() {
        return reasonRepository.findByActiveTrueOrderByLabel();
    }

    // ── Practitioner leaves ────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PractitionerLeave> listLeaves(UUID practitionerId) {
        return leaveRepository.findByPractitionerIdOrderByStartDateAsc(practitionerId);
    }

    public PractitionerLeave createLeave(UUID practitionerId, CreateLeaveRequest req) {
        if (req.endDate().isBefore(req.startDate())) {
            throw new BusinessException(
                    "LEAVE_INVALID_DATES",
                    "La date de fin doit être postérieure ou égale à la date de début.",
                    HttpStatus.BAD_REQUEST.value());
        }
        PractitionerLeave leave = new PractitionerLeave();
        leave.setId(UUID.randomUUID());
        leave.setPractitionerId(practitionerId);
        leave.setStartDate(req.startDate());
        leave.setEndDate(req.endDate());
        leave.setReason(req.reason());
        leave.setCreatedAt(OffsetDateTime.now());
        return leaveRepository.save(leave);
    }

    public void deleteLeave(UUID practitionerId, UUID leaveId) {
        PractitionerLeave l = leaveRepository.findById(leaveId)
                .orElseThrow(() -> new NotFoundException("LEAVE_NOT_FOUND", "Congé introuvable : " + leaveId));
        if (!l.getPractitionerId().equals(practitionerId)) {
            throw new BusinessException("LEAVE_ACCESS_DENIED", "Ce congé n'appartient pas à ce praticien.", 403);
        }
        leaveRepository.delete(l);
    }

    // Offset alignment — used by tests that pass instants in UTC
    @SuppressWarnings("unused")
    private static OffsetDateTime toUtc(OffsetDateTime t) {
        return t.withOffsetSameInstant(ZoneOffset.UTC);
    }
}
