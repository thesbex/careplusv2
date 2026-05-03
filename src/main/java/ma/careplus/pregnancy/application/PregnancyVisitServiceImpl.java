package ma.careplus.pregnancy.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.application.ConsultationStatusReader;
import ma.careplus.clinical.domain.ConsultationStatus;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyStatus;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import ma.careplus.pregnancy.domain.PregnancyVisitPlan;
import ma.careplus.pregnancy.domain.VisitPlanStatus;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyVisitPlanRepository;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyVisitRepository;
import ma.careplus.pregnancy.infrastructure.web.dto.RecordVisitRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.UpdateVisitRequest;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * PregnancyVisitService implementation — Étape 2.
 *
 * <p>Cross-module read:
 * <ul>
 *   <li>{@link ConsultationStatusReader} — checks whether a linked consultation
 *       is SIGNEE before allowing updates. Uses the narrow public API introduced
 *       in {@code clinical.application}, not a direct ConsultationRepository import.</li>
 * </ul>
 */
@Service
@Transactional
public class PregnancyVisitServiceImpl implements PregnancyVisitService {

    private final PregnancyRepository pregnancyRepo;
    private final PregnancyVisitRepository visitRepo;
    private final PregnancyVisitPlanRepository planRepo;
    private final ConsultationStatusReader consultationStatusReader;

    public PregnancyVisitServiceImpl(PregnancyRepository pregnancyRepo,
                                      PregnancyVisitRepository visitRepo,
                                      PregnancyVisitPlanRepository planRepo,
                                      ConsultationStatusReader consultationStatusReader) {
        this.pregnancyRepo = pregnancyRepo;
        this.visitRepo = visitRepo;
        this.planRepo = planRepo;
        this.consultationStatusReader = consultationStatusReader;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // record
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public PregnancyVisit record(UUID pregnancyId, RecordVisitRequest body, UUID actorUserId) {
        Pregnancy pregnancy = requireActivePregnancy(pregnancyId);

        validateVitals(body.weightKg(), body.bpSystolic(), body.bpDiastolic(),
                body.fundalHeightCm(), body.fetalHeartRateBpm());

        OffsetDateTime now = OffsetDateTime.now();
        LocalDate lmpDate = pregnancy.getLmpDate();
        LocalDate today = now.toLocalDate();

        long totalDays = ChronoUnit.DAYS.between(lmpDate, today);
        if (totalDays < 0) totalDays = 0;
        short saWeeks = (short) (totalDays / 7);
        short saDays  = (short) (totalDays % 7);

        PregnancyVisit visit = new PregnancyVisit();
        visit.setPregnancyId(pregnancyId);
        visit.setRecordedAt(now);
        visit.setSaWeeks(saWeeks);
        visit.setSaDays(saDays);
        visit.setWeightKg(body.weightKg());
        if (body.bpSystolic()  != null) visit.setBpSystolic(body.bpSystolic().shortValue());
        if (body.bpDiastolic() != null) visit.setBpDiastolic(body.bpDiastolic().shortValue());
        visit.setUrineDipJson(body.urineDipJson());
        visit.setFundalHeightCm(body.fundalHeightCm());
        if (body.fetalHeartRateBpm() != null) visit.setFetalHeartRateBpm(body.fetalHeartRateBpm().shortValue());
        visit.setFetalMovementsPerceived(body.fetalMovementsPerceived());
        visit.setPresentation(body.presentation());
        visit.setNotes(body.notes());
        visit.setRecordedBy(actorUserId);
        visit.setConsultationId(body.consultationId());
        visit.setCreatedBy(actorUserId);

        // Link to visit plan if appointment matches within tolerance
        if (body.appointmentId() != null) {
            linkToVisitPlan(visit, pregnancyId, body.appointmentId(), today, actorUserId);
        }

        return visitRepo.save(visit);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // update
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public PregnancyVisit update(UUID visitId, UpdateVisitRequest body, UUID actorUserId) {
        PregnancyVisit visit = visitRepo.findById(visitId)
                .orElseThrow(() -> new NotFoundException("VISIT_NOT_FOUND",
                        "Visite introuvable : " + visitId));

        // Guard: cannot modify if linked consultation is signed
        if (visit.getConsultationId() != null) {
            ConsultationStatus status = consultationStatusReader
                    .statusOf(visit.getConsultationId())
                    .orElse(null);
            if (ConsultationStatus.SIGNEE == status) {
                throw new BusinessException("CONSULTATION_SIGNED",
                        "La visite ne peut plus être modifiée : la consultation liée est signée.", 422);
            }
        }

        validateVitals(body.weightKg(), body.bpSystolic(), body.bpDiastolic(),
                body.fundalHeightCm(), body.fetalHeartRateBpm());

        if (body.weightKg()              != null) visit.setWeightKg(body.weightKg());
        if (body.bpSystolic()            != null) visit.setBpSystolic(body.bpSystolic().shortValue());
        if (body.bpDiastolic()           != null) visit.setBpDiastolic(body.bpDiastolic().shortValue());
        if (body.urineDipJson()          != null) visit.setUrineDipJson(body.urineDipJson());
        if (body.fundalHeightCm()        != null) visit.setFundalHeightCm(body.fundalHeightCm());
        if (body.fetalHeartRateBpm()     != null) visit.setFetalHeartRateBpm(body.fetalHeartRateBpm().shortValue());
        if (body.fetalMovementsPerceived() != null) visit.setFetalMovementsPerceived(body.fetalMovementsPerceived());
        if (body.presentation()          != null) visit.setPresentation(body.presentation());
        if (body.notes()                 != null) visit.setNotes(body.notes());
        visit.setUpdatedBy(actorUserId);

        return visitRepo.save(visit);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // listByPregnancy
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<PregnancyVisit> listByPregnancy(UUID pregnancyId, Pageable pageable) {
        requirePregnancy(pregnancyId); // existence check
        return visitRepo.findByPregnancyIdOrderByRecordedAtDesc(pregnancyId, pageable);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private Pregnancy requireActivePregnancy(UUID pregnancyId) {
        Pregnancy p = requirePregnancy(pregnancyId);
        if (p.getStatus() != PregnancyStatus.EN_COURS) {
            throw new BusinessException("PREGNANCY_NOT_ACTIVE",
                    "Cette grossesse n'est pas en cours (statut : " + p.getStatus() + ").", 422);
        }
        return p;
    }

    private Pregnancy requirePregnancy(UUID pregnancyId) {
        return pregnancyRepo.findById(pregnancyId)
                .orElseThrow(() -> new NotFoundException("PREGNANCY_NOT_FOUND",
                        "Grossesse introuvable : " + pregnancyId));
    }

    /**
     * Validates vital sign ranges per OMS thresholds.
     * Bean validation handles these on the DTO; this is a second-gate service-layer check.
     */
    private void validateVitals(BigDecimal weightKg, Integer bpSystolic, Integer bpDiastolic,
                                 BigDecimal fundalHeightCm, Integer fetalHeartRateBpm) {
        if (weightKg != null) {
            double w = weightKg.doubleValue();
            if (w < 30 || w > 180) throw vitalsOutOfRange("weight_kg", w);
        }
        if (bpSystolic != null && (bpSystolic < 60 || bpSystolic > 220)) {
            throw vitalsOutOfRange("bp_systolic", bpSystolic);
        }
        if (bpDiastolic != null && (bpDiastolic < 30 || bpDiastolic > 140)) {
            throw vitalsOutOfRange("bp_diastolic", bpDiastolic);
        }
        if (fundalHeightCm != null) {
            double h = fundalHeightCm.doubleValue();
            if (h < 5 || h > 50) throw vitalsOutOfRange("fundal_height_cm", h);
        }
        if (fetalHeartRateBpm != null && (fetalHeartRateBpm < 100 || fetalHeartRateBpm > 200)) {
            throw vitalsOutOfRange("fetal_heart_rate_bpm", fetalHeartRateBpm);
        }
    }

    private BusinessException vitalsOutOfRange(String field, double value) {
        return new BusinessException("VITALS_OUT_OF_RANGE",
                "Valeur hors limites pour " + field + " : " + value, 422);
    }

    /**
     * Attempts to link the new visit to a PLANIFIEE visit plan entry whose
     * appointment_id matches OR whose target_date is within tolerance of today.
     *
     * <p>Logic: find a PLANIFIEE plan entry where the appointment_id is already set
     * to the given appointmentId, OR where |targetDate - today| &lt;= toleranceDays.
     * Marks it HONOREE and sets visit.visitPlanId.
     */
    private void linkToVisitPlan(PregnancyVisit visit, UUID pregnancyId,
                                  UUID appointmentId, LocalDate today, UUID actorUserId) {
        List<PregnancyVisitPlan> plans = planRepo.findByPregnancyIdOrderByTargetSaWeeks(pregnancyId);

        // First: find a plan entry already linked to this appointmentId
        PregnancyVisitPlan matched = plans.stream()
                .filter(p -> p.getStatus() == VisitPlanStatus.PLANIFIEE
                        && appointmentId.equals(p.getAppointmentId()))
                .findFirst()
                .orElse(null);

        // Fallback: find nearest plan entry within tolerance window
        if (matched == null) {
            matched = plans.stream()
                    .filter(p -> p.getStatus() == VisitPlanStatus.PLANIFIEE)
                    .filter(p -> Math.abs(ChronoUnit.DAYS.between(p.getTargetDate(), today))
                            <= p.getToleranceDays())
                    .findFirst()
                    .orElse(null);
        }

        if (matched != null) {
            visit.setVisitPlanId(matched.getId());
            matched.setStatus(VisitPlanStatus.HONOREE);
            if (matched.getAppointmentId() == null) {
                matched.setAppointmentId(appointmentId);
            }
            matched.setUpdatedBy(actorUserId);
            planRepo.save(matched);
        }
        // No match → visit is ad-hoc (visitPlanId remains null)
    }
}
