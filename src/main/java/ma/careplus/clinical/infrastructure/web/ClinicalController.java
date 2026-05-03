package ma.careplus.clinical.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.application.ConsultationService;
import ma.careplus.clinical.application.PresenceService;
import ma.careplus.clinical.application.VitalsService;
import ma.careplus.clinical.domain.Consultation;
import ma.careplus.clinical.domain.VitalSigns;
import ma.careplus.clinical.infrastructure.web.dto.ConsultationView;
import ma.careplus.clinical.infrastructure.web.dto.CreateConsultationRequest;
import ma.careplus.clinical.infrastructure.web.dto.FollowUpRequest;
import ma.careplus.clinical.infrastructure.web.dto.FollowUpResponse;
import ma.careplus.clinical.infrastructure.web.dto.QueueEntryView;
import ma.careplus.clinical.infrastructure.web.dto.RecordVitalsRequest;
import ma.careplus.clinical.infrastructure.web.dto.UpdateConsultationRequest;
import ma.careplus.clinical.infrastructure.web.dto.VitalSignsView;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Clinical HTTP endpoints (J5):
 *   POST /api/appointments/{id}/check-in   → presence
 *   GET  /api/queue                        → today's waiting queue
 *   POST /api/appointments/{id}/vitals     → record vitals
 *   GET  /api/patients/{id}/vitals         → history
 *   POST /api/consultations                → start draft
 *   GET  /api/consultations/{id}           → read
 *   PUT  /api/consultations/{id}           → update draft
 *   POST /api/consultations/{id}/sign      → lock + emit event
 */
@RestController
@RequestMapping("/api")
public class ClinicalController {

    private final PresenceService presenceService;
    private final VitalsService vitalsService;
    private final ConsultationService consultationService;

    public ClinicalController(PresenceService presenceService,
                              VitalsService vitalsService,
                              ConsultationService consultationService) {
        this.presenceService = presenceService;
        this.vitalsService = vitalsService;
        this.consultationService = consultationService;
    }

    // ── Check-in + queue ───────────────────────────────────────────

    @PostMapping("/appointments/{id}/check-in")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Void> checkIn(@PathVariable UUID id) {
        presenceService.checkIn(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<QueueEntryView> queue() {
        return presenceService.queueForToday();
    }

    // ── Vitals ─────────────────────────────────────────────────────

    @PostMapping("/appointments/{id}/vitals")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<VitalSignsView> recordVitals(
            @PathVariable UUID id,
            @Valid @RequestBody RecordVitalsRequest req,
            Authentication auth) {
        UUID recordedBy = UUID.fromString(auth.getName());
        VitalSigns v = vitalsService.record(id, recordedBy, req);
        return ResponseEntity.created(
                URI.create("/api/patients/" + v.getPatientId() + "/vitals/" + v.getId()))
                .body(toView(v));
    }

    @PostMapping("/consultations/{id}/vitals")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<VitalSignsView> recordVitalsForConsultation(
            @PathVariable UUID id,
            @Valid @RequestBody RecordVitalsRequest req,
            Authentication auth) {
        UUID recordedBy = UUID.fromString(auth.getName());
        VitalSigns v = vitalsService.recordForConsultation(id, recordedBy, req);
        return ResponseEntity.created(
                URI.create("/api/patients/" + v.getPatientId() + "/vitals/" + v.getId()))
                .body(toView(v));
    }

    @GetMapping("/patients/{id}/vitals")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<VitalSignsView> patientVitals(@PathVariable UUID id) {
        return vitalsService.forPatient(id).stream().map(this::toView).toList();
    }

    // ── Consultations ─────────────────────────────────────────────

    @PostMapping("/consultations")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<ConsultationView> start(
            @Valid @RequestBody CreateConsultationRequest req,
            Authentication auth) {
        UUID practitionerId = UUID.fromString(auth.getName());
        Consultation c = consultationService.start(practitionerId, req);
        return ResponseEntity.created(URI.create("/api/consultations/" + c.getId())).body(toView(c));
    }

    @GetMapping("/consultations/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ConsultationView get(@PathVariable UUID id) {
        return toView(consultationService.get(id));
    }

    @GetMapping("/consultations")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<ConsultationView> list(
            @org.springframework.web.bind.annotation.RequestParam(required = false) UUID practitionerId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) UUID patientId,
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            OffsetDateTime from,
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            OffsetDateTime to,
            Authentication auth) {
        if (patientId != null) {
            return consultationService.listForPatient(patientId).stream().map(this::toView).toList();
        }
        UUID pid = practitionerId != null ? practitionerId : UUID.fromString(auth.getName());
        return consultationService.listForPractitioner(pid, from, to).stream().map(this::toView).toList();
    }

    @PutMapping("/consultations/{id}")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ConsultationView update(@PathVariable UUID id,
                                   @Valid @RequestBody UpdateConsultationRequest req) {
        return toView(consultationService.update(id, req));
    }

    @PostMapping("/consultations/{id}/sign")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ConsultationView sign(@PathVariable UUID id) {
        return toView(consultationService.sign(id));
    }

    @PostMapping("/consultations/{id}/suspend")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ConsultationView suspend(@PathVariable UUID id) {
        return toView(consultationService.suspend(id));
    }

    @PostMapping("/consultations/{id}/follow-up")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<FollowUpResponse> followUp(
            @PathVariable UUID id,
            @Valid @RequestBody FollowUpRequest req,
            Authentication auth) {
        UUID practitionerId = UUID.fromString(auth.getName());
        Appointment followUp = consultationService.scheduleFollowUp(id, req, practitionerId);
        return ResponseEntity.created(URI.create("/api/appointments/" + followUp.getId()))
                .body(new FollowUpResponse(
                        followUp.getId(),
                        followUp.getPatientId(),
                        followUp.getOriginConsultationId(),
                        AppointmentType.CONTROLE.name(),
                        followUp.getStartAt(),
                        followUp.getEndAt()));
    }

    // ── Mapping ───────────────────────────────────────────────────

    private ConsultationView toView(Consultation c) {
        return new ConsultationView(
                c.getId(), c.getPatientId(), c.getPractitionerId(),
                c.getAppointmentId(), c.getVersionNumber(), c.getStatus().name(),
                c.getMotif(), c.getExamination(), c.getDiagnosis(), c.getNotes(),
                c.getStartedAt(), c.getSignedAt(),
                c.getCreatedAt(), c.getUpdatedAt());
    }

    private VitalSignsView toView(VitalSigns v) {
        return new VitalSignsView(
                v.getId(), v.getPatientId(), v.getAppointmentId(), v.getConsultationId(),
                v.getSystolicMmhg(), v.getDiastolicMmhg(), v.getTemperatureC(),
                v.getWeightKg(), v.getHeightCm(), v.getBmi(),
                v.getHeartRateBpm(), v.getSpo2Percent(), v.getGlycemiaGPerL(),
                v.getRecordedAt(), v.getRecordedBy(), v.getNotes());
    }

    // suppress unused Appointment import warning in some IDEs
    @SuppressWarnings("unused")
    private void _touchAppointment(Appointment a) { /* no-op */ }
}
