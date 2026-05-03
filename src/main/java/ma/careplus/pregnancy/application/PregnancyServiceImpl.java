package ma.careplus.pregnancy.application;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import ma.careplus.patient.application.PatientService;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.patient.infrastructure.web.dto.CreatePatientRequest;
import ma.careplus.pregnancy.domain.DueDateSource;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyOutcome;
import ma.careplus.pregnancy.domain.PregnancyStatus;
import ma.careplus.pregnancy.domain.PregnancyVisitPlan;
import ma.careplus.pregnancy.domain.VisitPlanStatus;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyVisitPlanRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pregnancy service implementation — Étape 1.
 *
 * <p>Cross-module calls:
 * <ul>
 *   <li>{@link PatientRepository} — gender + existence check (accepted exception,
 *       same precedent as VaccinationServiceImpl, BillingService).</li>
 *   <li>{@link PatientService#create} — creates the child patient record.</li>
 * </ul>
 *
 * <p>Vaccination calendar is not explicitly triggered here: VaccinationServiceImpl
 * materialises the calendar lazily on first GET call. The child patient's birth date
 * is set at creation time so the calendar will compute correctly when the frontend
 * first loads the vaccination tab for the new patient.
 */
@Service
@Transactional
public class PregnancyServiceImpl implements PregnancyService {

    /** SA targets per OMS 2016 recommendation (8 visits minimum). */
    private static final short[] OMS_SA_TARGETS = {12, 20, 26, 30, 34, 36, 38, 40};

    /** Outcomes that lead to INTERROMPUE (instead of TERMINEE). */
    private static final Set<PregnancyOutcome> INTERRUPTION_OUTCOMES =
            Set.of(PregnancyOutcome.FCS, PregnancyOutcome.IVG,
                   PregnancyOutcome.GEU, PregnancyOutcome.MOLE, PregnancyOutcome.MFIU);

    private final PregnancyRepository pregnancyRepo;
    private final PregnancyVisitPlanRepository visitPlanRepo;
    private final PatientRepository patientRepo;
    private final PatientService patientService;
    private final EntityManager em;

    public PregnancyServiceImpl(PregnancyRepository pregnancyRepo,
                                 PregnancyVisitPlanRepository visitPlanRepo,
                                 PatientRepository patientRepo,
                                 PatientService patientService,
                                 EntityManager em) {
        this.pregnancyRepo = pregnancyRepo;
        this.visitPlanRepo = visitPlanRepo;
        this.patientRepo = patientRepo;
        this.patientService = patientService;
        this.em = em;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // declare
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public Pregnancy declare(UUID patientId, LocalDate lmpDate, String notes, UUID actorUserId) {
        Patient patient = patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        if (!"F".equals(patient.getGender())) {
            throw new BusinessException("PATIENT_NOT_FEMALE",
                    "La déclaration de grossesse est réservée aux patientes de sexe féminin.", 422);
        }

        if (pregnancyRepo.existsByPatientIdAndStatus(patientId, PregnancyStatus.EN_COURS)) {
            throw new BusinessException("PREGNANCY_ALREADY_ACTIVE",
                    "Une grossesse est déjà en cours pour cette patiente.", 422);
        }

        LocalDate today = LocalDate.now();

        Pregnancy p = new Pregnancy();
        p.setPatientId(patientId);
        p.setStartedAt(today);
        p.setLmpDate(lmpDate);
        p.setDueDate(lmpDate.plusDays(280));
        p.setDueDateSource(DueDateSource.NAEGELE);
        p.setStatus(PregnancyStatus.EN_COURS);
        p.setNotes(notes);
        p.setCreatedBy(actorUserId);
        p = pregnancyRepo.save(p);

        generateVisitPlan(p, lmpDate, today, actorUserId);

        return p;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // update
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public Pregnancy update(UUID pregnancyId, LocalDate lmpDate, LocalDate dueDate,
                             DueDateSource source, String notes, UUID actorUserId) {
        Pregnancy p = requirePregnancy(pregnancyId);

        boolean lmpChanged = !lmpDate.equals(p.getLmpDate());
        p.setLmpDate(lmpDate);
        p.setDueDate(dueDate != null ? dueDate : lmpDate.plusDays(280));
        p.setDueDateSource(source != null ? source : DueDateSource.NAEGELE);
        if (notes != null) p.setNotes(notes);
        p.setUpdatedBy(actorUserId);
        p = pregnancyRepo.save(p);

        if (lmpChanged) {
            visitPlanRepo.deleteByPregnancyId(pregnancyId);
            // Flush deletions to DB before inserting new rows to avoid UNIQUE constraint conflict
            // on (pregnancy_id, target_sa_weeks) within the same transaction.
            em.flush();
            generateVisitPlan(p, lmpDate, LocalDate.now(), actorUserId);
        }

        return p;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // close
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public Pregnancy close(UUID pregnancyId, LocalDate endedAt, PregnancyOutcome outcome,
                            String notes, UUID actorUserId) {
        Pregnancy p = requirePregnancy(pregnancyId);

        if (p.getStatus() != PregnancyStatus.EN_COURS) {
            throw new BusinessException("PREGNANCY_NOT_ACTIVE",
                    "Cette grossesse n'est pas en cours (statut : " + p.getStatus() + ").", 422);
        }

        PregnancyStatus newStatus = INTERRUPTION_OUTCOMES.contains(outcome)
                ? PregnancyStatus.INTERROMPUE
                : PregnancyStatus.TERMINEE;

        p.setStatus(newStatus);
        p.setEndedAt(endedAt);
        p.setOutcome(outcome);
        if (notes != null) p.setNotes(notes);
        p.setUpdatedBy(actorUserId);

        return pregnancyRepo.save(p);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // createChild
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public UUID createChild(UUID pregnancyId, String firstName, char sex, UUID actorUserId) {
        Pregnancy p = requirePregnancy(pregnancyId);

        if (p.getOutcome() != PregnancyOutcome.ACCOUCHEMENT_VIVANT) {
            throw new BusinessException("OUTCOME_NOT_LIVE_BIRTH",
                    "La création de la fiche enfant n'est possible qu'après un accouchement vivant.", 422);
        }

        if (p.getChildPatientId() != null) {
            throw new BusinessException("CHILD_ALREADY_CREATED",
                    "La fiche enfant a déjà été créée pour cette grossesse.", 422);
        }

        // Fetch mother to copy last name
        Patient mother = patientRepo.findActiveById(p.getPatientId())
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Mère introuvable : " + p.getPatientId()));

        String genderStr = sex == 'F' ? "F" : "M";
        LocalDate birthDate = p.getEndedAt();

        CreatePatientRequest req = new CreatePatientRequest(
                firstName,
                mother.getLastName(),
                genderStr,
                birthDate,
                null,  // cin
                null,  // phone
                null,  // emergencyPhone
                null,  // email
                null,  // address
                null,  // city
                "Maroc",
                null,  // maritalStatus
                null,  // profession
                null,  // bloodGroup
                0,     // numberChildren
                "Enfant de " + mother.getFirstName() + " " + mother.getLastName(),
                null,  // tier
                null,  // mutuelleInsuranceId
                null   // mutuellePolicyNumber
        );

        Patient child = patientService.create(req);

        p.setChildPatientId(child.getId());
        p.setUpdatedBy(actorUserId);
        pregnancyRepo.save(p);

        // Vaccination calendar will be materialised lazily on first GET
        // (VaccinationServiceImpl.materializeCalendar computes from child.birthDate).

        return child.getId();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getVisitPlan
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<PregnancyVisitPlan> getVisitPlan(UUID pregnancyId) {
        requirePregnancy(pregnancyId); // existence check
        return visitPlanRepo.findByPregnancyIdOrderByTargetSaWeeks(pregnancyId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // updateVisitPlanEntry
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public PregnancyVisitPlan updateVisitPlanEntry(UUID pregnancyId, UUID planId,
                                                    LocalDate targetDate,
                                                    VisitPlanStatus status,
                                                    UUID actorUserId) {
        requirePregnancy(pregnancyId);

        PregnancyVisitPlan plan = visitPlanRepo.findById(planId)
                .orElseThrow(() -> new NotFoundException("VISIT_PLAN_NOT_FOUND",
                        "Plan de visite introuvable : " + planId));

        if (!plan.getPregnancyId().equals(pregnancyId)) {
            throw new NotFoundException("VISIT_PLAN_NOT_FOUND",
                    "Plan de visite introuvable pour cette grossesse.");
        }

        if (targetDate != null) plan.setTargetDate(targetDate);
        if (status != null) plan.setStatus(status);
        plan.setUpdatedBy(actorUserId);

        return visitPlanRepo.save(plan);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // listByPatient / findCurrent
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<Pregnancy> listByPatient(UUID patientId) {
        patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));
        return pregnancyRepo.findByPatientIdOrderByStartedAtDesc(patientId);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Pregnancy> findCurrent(UUID patientId) {
        patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));
        return pregnancyRepo.findFirstByPatientIdAndStatus(patientId, PregnancyStatus.EN_COURS);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private Pregnancy requirePregnancy(UUID pregnancyId) {
        return pregnancyRepo.findById(pregnancyId)
                .orElseThrow(() -> new NotFoundException("PREGNANCY_NOT_FOUND",
                        "Grossesse introuvable : " + pregnancyId));
    }

    /**
     * Generates the 8-entry OMS visit plan for a pregnancy.
     * Visits whose target_date is before today are created with status MANQUEE.
     */
    private void generateVisitPlan(Pregnancy pregnancy, LocalDate lmpDate,
                                    LocalDate today, UUID actorUserId) {
        List<PregnancyVisitPlan> plans = new ArrayList<>(OMS_SA_TARGETS.length);
        for (short saWeeks : OMS_SA_TARGETS) {
            LocalDate targetDate = lmpDate.plusDays(saWeeks * 7L);
            VisitPlanStatus status = targetDate.isBefore(today)
                    ? VisitPlanStatus.MANQUEE
                    : VisitPlanStatus.PLANIFIEE;

            PregnancyVisitPlan plan = new PregnancyVisitPlan();
            plan.setPregnancyId(pregnancy.getId());
            plan.setTargetSaWeeks(saWeeks);
            plan.setTargetDate(targetDate);
            plan.setToleranceDays(14);
            plan.setStatus(status);
            plan.setCreatedBy(actorUserId);
            plans.add(plan);
        }
        visitPlanRepo.saveAll(plans);
    }
}
