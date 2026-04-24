package ma.careplus.scheduling.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.scheduling.application.SchedulingService;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentReason;
import ma.careplus.scheduling.infrastructure.web.dto.AppointmentReasonView;
import ma.careplus.scheduling.infrastructure.web.dto.AppointmentView;
import ma.careplus.scheduling.infrastructure.web.dto.AvailabilitySlot;
import ma.careplus.scheduling.infrastructure.web.dto.CancelAppointmentRequest;
import ma.careplus.scheduling.infrastructure.web.dto.CreateAppointmentRequest;
import ma.careplus.scheduling.infrastructure.web.dto.MoveAppointmentRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    public SchedulingController(SchedulingService service) {
        this.service = service;
    }

    // ── Appointments ───────────────────────────────────────────────

    @PostMapping("/appointments")
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public ResponseEntity<AppointmentView> create(@Valid @RequestBody CreateAppointmentRequest req) {
        Appointment a = service.create(req);
        return ResponseEntity.created(URI.create("/api/appointments/" + a.getId())).body(toView(a));
    }

    @GetMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public AppointmentView get(@PathVariable UUID id) {
        return toView(service.get(id));
    }

    @GetMapping("/appointments")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<AppointmentView> list(
            @RequestParam UUID practitionerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        return service.listInWindow(practitionerId, from, to).stream().map(this::toView).toList();
    }

    @PutMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public AppointmentView move(@PathVariable UUID id, @Valid @RequestBody MoveAppointmentRequest req) {
        return toView(service.move(id, req));
    }

    @DeleteMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public AppointmentView cancel(
            @PathVariable UUID id,
            @RequestBody(required = false) CancelAppointmentRequest req) {
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
            @RequestParam(required = false) Integer durationMinutes) {
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

    // ── Mapping ────────────────────────────────────────────────────

    private AppointmentView toView(Appointment a) {
        return new AppointmentView(
                a.getId(),
                a.getPatientId(),
                a.getPractitionerId(),
                a.getReasonId(),
                a.getStartAt(),
                a.getEndAt(),
                a.getStatus().name(),
                a.getCancelReason(),
                a.isWalkIn(),
                a.isUrgency(),
                a.getArrivedAt(),
                a.getCreatedAt(),
                a.getUpdatedAt());
    }
}
