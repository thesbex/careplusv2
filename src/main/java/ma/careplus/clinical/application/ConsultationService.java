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
import ma.careplus.scheduling.application.SchedulingService;
import ma.careplus.scheduling.infrastructure.persistence.AppointmentRepository;
import ma.careplus.scheduling.infrastructure.web.dto.CreateAppointmentRequest;
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
    private final SchedulingService schedulingService;
    private final ApplicationEventPublisher events;

    public ConsultationService(ConsultationRepository consultationRepository,
                               AppointmentRepository appointmentRepository,
                               SchedulingService schedulingService,
                               ApplicationEventPublisher events) {
        this.consultationRepository = consultationRepository;
        this.appointmentRepository = appointmentRepository;
        this.schedulingService = schedulingService;
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
        // Auto-resume: any edit on a SUSPENDUE consultation flips it back
        // to BROUILLON and pulls the patient out of the queue into EN_CONSULTATION.
        if (c.getStatus() == ConsultationStatus.SUSPENDUE) {
            c.setStatus(ConsultationStatus.BROUILLON);
            if (c.getAppointmentId() != null) {
                appointmentRepository.findById(c.getAppointmentId()).ifPresent(a -> {
                    if (a.getStatus() == AppointmentStatus.CONSTANTES_PRISES
                            || a.getStatus() == AppointmentStatus.ARRIVE
                            || a.getStatus() == AppointmentStatus.EN_ATTENTE_CONSTANTES) {
                        a.setStatus(AppointmentStatus.EN_CONSULTATION);
                    }
                });
            }
        }
        if (req.motif() != null)       c.setMotif(req.motif());
        if (req.examination() != null) c.setExamination(req.examination());
        if (req.diagnosis() != null)   c.setDiagnosis(req.diagnosis());
        if (req.notes() != null)       c.setNotes(req.notes());
        return c;
    }

    /**
     * Suspend a draft consultation: doctor steps out, patient returns to the queue.
     * - Consultation status: BROUILLON → SUSPENDUE (idempotent if already SUSPENDUE).
     * - Linked appointment: EN_CONSULTATION → CONSTANTES_PRISES.
     * - Refused on a signed/amended consultation.
     */
    public Consultation suspend(UUID id) {
        Consultation c = get(id);
        if (c.isSigned()) {
            throw new BusinessException(
                    "CONSULT_LOCKED",
                    "Impossible de suspendre une consultation déjà signée.",
                    HttpStatus.CONFLICT.value());
        }
        if (c.getStatus() == ConsultationStatus.SUSPENDUE) {
            return c; // idempotent
        }
        c.setStatus(ConsultationStatus.SUSPENDUE);
        if (c.getAppointmentId() != null) {
            appointmentRepository.findById(c.getAppointmentId()).ifPresent(a -> {
                if (a.getStatus() == AppointmentStatus.EN_CONSULTATION) {
                    a.setStatus(AppointmentStatus.CONSTANTES_PRISES);
                }
            });
        }
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
     *
     * Délègue à {@link SchedulingService#create} pour bénéficier des trois guards
     * (jour férié, congé du praticien, conflit de créneau) + résolution de durée
     * via reasonId. Ne JAMAIS court-circuiter par un appointmentRepository.save()
     * direct — voir QA wave 6 (BUG #2/3/4 du 2026-05-02).
     */
    public Appointment scheduleFollowUp(UUID consultationId, FollowUpRequest req, UUID practitionerId) {
        Consultation c = get(consultationId);

        OffsetDateTime startAt = req.date().atTime(req.time())
                .atZone(ZoneId.of("Africa/Casablanca"))
                .toOffsetDateTime();

        CreateAppointmentRequest createReq = new CreateAppointmentRequest(
                c.getPatientId(),
                practitionerId,
                req.reasonId(),
                startAt,
                null,    // durationMinutes — laisser SchedulingService résoudre via reasonId
                false,   // walkIn
                false,   // urgency
                null);   // notes

        Appointment followUp = schedulingService.create(createReq);
        followUp.setType(AppointmentType.CONTROLE);
        followUp.setOriginConsultationId(consultationId);
        // JPA dirty tracking flushe au commit du @Transactional ambiant
        return followUp;
    }
}
