package ma.careplus.clinical.application;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.clinical.domain.Consultation;
import ma.careplus.clinical.domain.ConsultationSigneeEvent;
import ma.careplus.clinical.domain.ConsultationStatus;
import ma.careplus.clinical.infrastructure.persistence.ConsultationRepository;
import ma.careplus.clinical.infrastructure.web.dto.CreateConsultationRequest;
import ma.careplus.clinical.infrastructure.web.dto.FollowUpRequest;
import ma.careplus.clinical.infrastructure.web.dto.UpdateConsultationRequest;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentStatus;
import ma.careplus.scheduling.domain.AppointmentType;
import ma.careplus.scheduling.infrastructure.persistence.AppointmentRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import java.time.ZoneId;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consultation write-side — create draft, update draft, sign (lock).
 *
 * Signing emits ConsultationSigneeEvent via Spring's ApplicationEventPublisher
 * so the billing module (J7) can draft an invoice in an AFTER_COMMIT listener
 * without us knowing about billing here. Pure inter-module event coupling per
 * docs/ARCHITECTURE.md — NO direct billing.createDraftInvoice() call.
 */
@Service
@Transactional
public class ConsultationService {

    private final ConsultationRepository consultationRepository;
    private final AppointmentRepository appointmentRepository;
    private final ApplicationEventPublisher events;

    public ConsultationService(ConsultationRepository consultationRepository,
                               AppointmentRepository appointmentRepository,
                               ApplicationEventPublisher events) {
        this.consultationRepository = consultationRepository;
        this.appointmentRepository = appointmentRepository;
        this.events = events;
    }

    public Consultation start(UUID practitionerId, CreateConsultationRequest req) {
        Consultation c = new Consultation();
        c.setPatientId(req.patientId());
        c.setPractitionerId(practitionerId);
        c.setAppointmentId(req.appointmentId());
        c.setMotif(req.motif());
        c.setStatus(ConsultationStatus.BROUILLON);

        // Advance the appointment into EN_CONSULTATION if eligible
        if (req.appointmentId() != null) {
            appointmentRepository.findById(req.appointmentId()).ifPresent(a -> {
                if (a.getStatus() == AppointmentStatus.CONSTANTES_PRISES
                        || a.getStatus() == AppointmentStatus.ARRIVE
                        || a.getStatus() == AppointmentStatus.EN_ATTENTE_CONSTANTES) {
                    a.setStatus(AppointmentStatus.EN_CONSULTATION);
                }
            });
        }
        return consultationRepository.save(c);
    }

    @Transactional(readOnly = true)
    public Consultation get(UUID id) {
        return consultationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException(
                        "CONSULT_NOT_FOUND", "Consultation introuvable : " + id));
    }

    @Transactional(readOnly = true)
    public java.util.List<Consultation> listForPractitioner(UUID practitionerId,
                                                            OffsetDateTime from,
                                                            OffsetDateTime to) {
        if (from != null && to != null) {
            return consultationRepository
                    .findByPractitionerIdAndStartedAtBetweenOrderByStartedAtDesc(practitionerId, from, to);
        }
        return consultationRepository.findByPractitionerIdOrderByStartedAtDesc(practitionerId);
    }

    @Transactional(readOnly = true)
    public java.util.List<Consultation> listForPatient(UUID patientId) {
        return consultationRepository.findByPatientIdOrderByStartedAtDesc(patientId);
    }

    public Consultation update(UUID id, UpdateConsultationRequest req) {
        Consultation c = get(id);
        if (c.isSigned()) {
            throw new BusinessException(
                    "CONSULT_LOCKED",
                    "Une consultation signée ne peut plus être modifiée. Créer un amendement.",
                    HttpStatus.CONFLICT.value());
        }
        if (req.motif() != null)       c.setMotif(req.motif());
        if (req.examination() != null) c.setExamination(req.examination());
        if (req.diagnosis() != null)   c.setDiagnosis(req.diagnosis());
        if (req.notes() != null)       c.setNotes(req.notes());
        return c;
    }

    public Consultation sign(UUID id) {
        Consultation c = get(id);
        if (c.isSigned()) {
            return c; // idempotent
        }
        OffsetDateTime now = OffsetDateTime.now();
        c.setStatus(ConsultationStatus.SIGNEE);
        c.setSignedAt(now);

        // Bump the appointment forward (consultation done → awaiting invoice)
        if (c.getAppointmentId() != null) {
            appointmentRepository.findById(c.getAppointmentId()).ifPresent(a -> {
                if (a.getStatus() == AppointmentStatus.EN_CONSULTATION) {
                    a.setStatus(AppointmentStatus.CONSULTATION_TERMINEE);
                }
            });
        }

        events.publishEvent(ConsultationSigneeEvent.of(
                c.getId(), c.getPatientId(), c.getPractitionerId(),
                c.getAppointmentId(), now));
        return c;
    }

    /**
     * Schedules a follow-up (CONTROLE) appointment linked to a signed consultation.
     * MEDECIN only — enforcement is at the controller layer via @PreAuthorize.
     * TODO(post-MVP:events): replace direct AppointmentRepository write with a
     *   ScheduleFollowUpRequestedEvent consumed by the scheduling module.
     */
    public Appointment scheduleFollowUp(UUID consultationId, FollowUpRequest req, UUID practitionerId) {
        Consultation c = get(consultationId);

        // Resolve practitionerId from the linked appointment if not passed
        UUID docId = practitionerId;
        if (c.getAppointmentId() != null) {
            appointmentRepository.findById(c.getAppointmentId()).ifPresent(a -> {
                // intentionally not overriding docId — it comes from the authenticated user
            });
        }

        OffsetDateTime startAt = req.date().atTime(req.time())
                .atZone(ZoneId.of("Africa/Casablanca"))
                .toOffsetDateTime();
        OffsetDateTime endAt = startAt.plusMinutes(30); // default 30-min follow-up

        Appointment followUp = new Appointment();
        followUp.setPatientId(c.getPatientId());
        followUp.setPractitionerId(docId);
        followUp.setReasonId(req.reasonId());
        followUp.setStartAt(startAt);
        followUp.setEndAt(endAt);
        followUp.setStatus(AppointmentStatus.PLANIFIE);
        followUp.setType(AppointmentType.CONTROLE);
        followUp.setOriginConsultationId(consultationId);

        return appointmentRepository.save(followUp);
    }
}
