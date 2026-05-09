package ma.careplus.scheduling.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.identity.application.AccessScopeService;
import ma.careplus.scheduling.application.SchedulingService;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentReason;
import ma.careplus.scheduling.infrastructure.web.dto.AppointmentReasonView;
import ma.careplus.scheduling.infrastructure.web.dto.AppointmentView;
import ma.careplus.scheduling.infrastructure.web.dto.AvailabilitySlot;
import ma.careplus.scheduling.infrastructure.web.dto.CancelAppointmentRequest;
import ma.careplus.scheduling.infrastructure.web.dto.CreateAppointmentRequest;
import ma.careplus.scheduling.infrastructure.web.dto.CreateLeaveRequest;
import ma.careplus.scheduling.infrastructure.web.dto.LeaveView;
import ma.careplus.scheduling.infrastructure.web.dto.MoveAppointmentRequest;
import ma.careplus.scheduling.infrastructure.web.dto.RoomConflictView;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Scheduling HTTP endpoints.
 * Permissions: SECRETAIRE/MEDECIN/ADMIN may book/move/cancel; ASSISTANT read-only.
 */
@RestController
@RequestMapping("/api")
public class SchedulingController {

    private final SchedulingService service;
    private final JdbcTemplate jdbc;
    private final AccessScopeService accessScope;

    public SchedulingController(SchedulingService service, JdbcTemplate jdbc,
                                AccessScopeService accessScope) {
        this.service = service;
        this.jdbc = jdbc;
        this.accessScope = accessScope;
    }

    // ── Appointments ───────────────────────────────────────────────

    @PostMapping("/appointments")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<AppointmentView> create(
            @Valid @RequestBody CreateAppointmentRequest req,
            Authentication auth) {
        accessScope.requireAccess(auth, req.practitionerId());
        Appointment a = service.create(req);
        return ResponseEntity.created(URI.create("/api/appointments/" + a.getId())).body(toView(a));
    }

    @GetMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public AppointmentView get(@PathVariable UUID id, Authentication auth) {
        Appointment a = service.get(id);
        accessScope.requireAccess(auth, a.getPractitionerId());
        return toView(a);
    }

    @GetMapping("/appointments")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<AppointmentView> list(
            @RequestParam UUID practitionerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            Authentication auth) {
        accessScope.requireAccess(auth, practitionerId);
        return jdbc.query("""
                SELECT a.id, a.patient_id,
                       (p.first_name || ' ' || p.last_name) AS patient_full_name,
                       a.practitioner_id, a.reason_id, r.label AS reason_label,
                       a.type, a.origin_consultation_id,
                       a.start_at, a.end_at, a.status, a.cancel_reason,
                       a.walk_in, a.urgency, a.arrived_at, a.created_at, a.updated_at,
                       a.room_id, cr.name AS room_name
                FROM scheduling_appointment a
                JOIN patient_patient p ON p.id = a.patient_id
                LEFT JOIN scheduling_appointment_reason r ON r.id = a.reason_id
                LEFT JOIN clinic_room cr ON cr.id = a.room_id
                WHERE a.practitioner_id = ?
                  AND a.start_at >= ?
                  AND a.start_at <  ?
                  AND a.status NOT IN ('ANNULE','NO_SHOW')
                ORDER BY a.start_at
                """,
                (rs, i) -> new AppointmentView(
                        (UUID) rs.getObject("id"),
                        (UUID) rs.getObject("patient_id"),
                        rs.getString("patient_full_name"),
                        (UUID) rs.getObject("practitioner_id"),
                        (UUID) rs.getObject("reason_id"),
                        rs.getString("reason_label"),
                        rs.getString("type"),
                        (UUID) rs.getObject("origin_consultation_id"),
                        rs.getObject("start_at", OffsetDateTime.class),
                        rs.getObject("end_at", OffsetDateTime.class),
                        rs.getString("status"),
                        rs.getString("cancel_reason"),
                        rs.getBoolean("walk_in"),
                        rs.getBoolean("urgency"),
                        rs.getObject("arrived_at", OffsetDateTime.class),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("updated_at", OffsetDateTime.class),
                        (UUID) rs.getObject("room_id"),
                        rs.getString("room_name")),
                practitionerId, from, to);
    }

    @PutMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public AppointmentView move(@PathVariable UUID id,
                                @Valid @RequestBody MoveAppointmentRequest req,
                                Authentication auth) {
        accessScope.requireAccess(auth, service.get(id).getPractitionerId());
        return toView(service.move(id, req));
    }

    @DeleteMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public AppointmentView cancel(
            @PathVariable UUID id,
            @RequestBody(required = false) CancelAppointmentRequest req,
            Authentication auth) {
        accessScope.requireAccess(auth, service.get(id).getPractitionerId());
        return toView(service.cancel(id, req));
    }

    // ── Availability ───────────────────────────────────────────────

    @GetMapping("/availability")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<AvailabilitySlot> availability(
            @RequestParam UUID practitionerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) UUID reasonId,
            @RequestParam(required = false) Integer durationMinutes,
            Authentication auth) {
        accessScope.requireAccess(auth, practitionerId);
        return service.availability(practitionerId, from, to, reasonId, durationMinutes);
    }

    // ── Reasons ────────────────────────────────────────────────────

    @GetMapping("/reasons")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<AppointmentReasonView> listReasons() {
        return service.listActiveReasons().stream()
                .map(r -> new AppointmentReasonView(
                        r.getId(), r.getCode(), r.getLabel(),
                        r.getDurationMinutes(), r.getColorHex()))
                .toList();
    }

    // ── Practitioner leaves ────────────────────────────────────────

    @GetMapping("/practitioners/{practitionerId}/leaves")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<LeaveView> listLeaves(@PathVariable UUID practitionerId, Authentication auth) {
        accessScope.requireAccess(auth, practitionerId);
        return service.listLeaves(practitionerId).stream()
                .map(l -> new LeaveView(l.getId(), l.getStartDate(), l.getEndDate(), l.getReason()))
                .toList();
    }

    @PostMapping("/practitioners/{practitionerId}/leaves")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<LeaveView> createLeave(
            @PathVariable UUID practitionerId,
            @Valid @RequestBody CreateLeaveRequest req,
            Authentication auth) {
        accessScope.requireAccess(auth, practitionerId);
        var l = service.createLeave(practitionerId, req);
        return ResponseEntity
                .created(URI.create("/api/practitioners/" + practitionerId + "/leaves/" + l.getId()))
                .body(new LeaveView(l.getId(), l.getStartDate(), l.getEndDate(), l.getReason()));
    }

    @DeleteMapping("/practitioners/{practitionerId}/leaves/{leaveId}")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Void> deleteLeave(
            @PathVariable UUID practitionerId,
            @PathVariable UUID leaveId,
            Authentication auth) {
        accessScope.requireAccess(auth, practitionerId);
        service.deleteLeave(practitionerId, leaveId);
        return ResponseEntity.noContent().build();
    }

    // ── Mapping ────────────────────────────────────────────────────

    /**
     * Adds the room-conflicts endpoint. Returns overlapping appointments in the
     * same room (warning only — never blocks). Empty list if no room assigned.
     */
    @GetMapping("/appointments/{id}/room-conflicts")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<RoomConflictView> roomConflicts(@PathVariable UUID id, Authentication auth) {
        accessScope.requireAccess(auth, service.get(id).getPractitionerId());
        return service.roomConflicts(id, jdbc);
    }

    private AppointmentView toView(Appointment a) {
        String roomName = null;
        if (a.getRoomId() != null) {
            roomName = jdbc.queryForObject(
                    "SELECT name FROM clinic_room WHERE id = ?",
                    String.class, a.getRoomId());
        }
        return new AppointmentView(
                a.getId(),
                a.getPatientId(),
                null,
                a.getPractitionerId(),
                a.getReasonId(),
                null,
                a.getType() != null ? a.getType().name() : "CONSULTATION",
                a.getOriginConsultationId(),
                a.getStartAt(),
                a.getEndAt(),
                a.getStatus().name(),
                a.getCancelReason(),
                a.isWalkIn(),
                a.isUrgency(),
                a.getArrivedAt(),
                a.getCreatedAt(),
                a.getUpdatedAt(),
                a.getRoomId(),
                roomName);
    }
}
