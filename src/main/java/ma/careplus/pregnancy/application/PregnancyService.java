package ma.careplus.pregnancy.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.pregnancy.domain.DueDateSource;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyOutcome;
import ma.careplus.pregnancy.domain.PregnancyVisitPlan;

/**
 * Public API for the pregnancy module — Étape 1 scope.
 *
 * <ul>
 *   <li>declare — registers a new pregnancy + auto-generates OMS visit plan.</li>
 *   <li>update — modifies LMP/DPA/notes; recomputes plan if LMP changes.</li>
 *   <li>close  — terminates a pregnancy with an outcome.</li>
 *   <li>createChild — creates the child patient record + triggers PNI vaccination calendar.</li>
 *   <li>getVisitPlan / updateVisitPlanEntry — read/update the 8-entry plan.</li>
 * </ul>
 */
public interface PregnancyService {

    /**
     * Declare a new pregnancy for the patient.
     *
     * <p>Validations:
     * <ul>
     *   <li>Patient must exist and be female (gender = 'F') → 422 PATIENT_NOT_FEMALE.</li>
     *   <li>No existing EN_COURS pregnancy for this patient → 422 PREGNANCY_ALREADY_ACTIVE.</li>
     * </ul>
     *
     * <p>Side-effects:
     * <ul>
     *   <li>Computes {@code due_date = lmpDate + 280 days}.</li>
     *   <li>Inserts 8 {@code pregnancy_visit_plan} rows for SA {12,20,26,30,34,36,38,40}.
     *       Visits whose {@code target_date < today} are created with status MANQUEE.</li>
     * </ul>
     *
     * @param patientId   active patient id
     * @param lmpDate     last menstrual period date (DDR)
     * @param notes       optional free-text notes
     * @param actorUserId the authenticated user triggering the action (stored in created_by)
     * @return the persisted Pregnancy entity
     */
    Pregnancy declare(UUID patientId, LocalDate lmpDate, String notes, UUID actorUserId);

    /**
     * Update an existing pregnancy.
     *
     * <p>If {@code lmpDate} differs from the current value the visit plan is fully
     * deleted and regenerated (delete + recreate in PLANIFIEE — same logic as declare).
     *
     * @param pregnancyId target pregnancy id
     * @param lmpDate     new LMP date (may be same as current — no-op on plan)
     * @param dueDate     override for due date (null = recompute from new lmpDate)
     * @param source      NAEGELE or ECHO_T1
     * @param notes       optional notes
     * @param actorUserId actor
     */
    Pregnancy update(UUID pregnancyId, LocalDate lmpDate, LocalDate dueDate,
                     DueDateSource source, String notes, UUID actorUserId);

    /**
     * Close a pregnancy.
     *
     * <p>Validations:
     * <ul>
     *   <li>Pregnancy must be EN_COURS → 422 PREGNANCY_NOT_ACTIVE.</li>
     *   <li>{@code endedAt} must be >= pregnancy.startedAt.</li>
     * </ul>
     *
     * <p>Sets status to TERMINEE for live births and full-term outcomes;
     * INTERROMPUE for FCS, IVG, GEU, MOLE, MFIU.
     *
     * @param pregnancyId target pregnancy id
     * @param endedAt     date of delivery / termination
     * @param outcome     mandatory
     * @param notes       optional notes
     * @param actorUserId actor
     */
    Pregnancy close(UUID pregnancyId, LocalDate endedAt, PregnancyOutcome outcome,
                    String notes, UUID actorUserId);

    /**
     * Create the child patient record after a live birth.
     *
     * <p>Validations:
     * <ul>
     *   <li>Pregnancy must be TERMINEE with outcome = ACCOUCHEMENT_VIVANT → 422 OUTCOME_NOT_LIVE_BIRTH.</li>
     *   <li>{@code child_patient_id} must be null (not yet created) → 422 CHILD_ALREADY_CREATED.</li>
     * </ul>
     *
     * <p>Side-effects:
     * <ul>
     *   <li>Calls {@link ma.careplus.patient.application.PatientService#create} cross-module.</li>
     *   <li>Calls {@link ma.careplus.vaccination.application.VaccinationService#materializeCalendar}
     *       to trigger the PNI calendar (read-only materialise is enough — Vaccination generates
     *       PLANNED rows lazily on first calendar load). Actually just ensures vaccination module
     *       can operate by storing child_patient_id and returning the new patient id.</li>
     *   <li>Persists {@code pregnancy.child_patient_id = newPatientId}.</li>
     * </ul>
     *
     * @param pregnancyId target pregnancy id
     * @param firstName   child's first name
     * @param sex         'M' or 'F'
     * @param actorUserId actor
     * @return UUID of the newly created child patient
     */
    UUID createChild(UUID pregnancyId, String firstName, char sex, UUID actorUserId);

    /**
     * Returns the full visit plan for a pregnancy, ordered by target SA ASC.
     */
    List<PregnancyVisitPlan> getVisitPlan(UUID pregnancyId);

    /**
     * Modifies a single visit plan entry (date and/or status override by MEDECIN).
     *
     * @param pregnancyId  parent pregnancy id (validated)
     * @param planId       plan entry id
     * @param targetDate   new target date (nullable = keep existing)
     * @param status       new status (nullable = keep existing)
     * @param actorUserId  actor
     */
    PregnancyVisitPlan updateVisitPlanEntry(UUID pregnancyId, UUID planId,
                                            LocalDate targetDate,
                                            ma.careplus.pregnancy.domain.VisitPlanStatus status,
                                            UUID actorUserId);

    /**
     * Returns all pregnancies for a patient (history + current), ordered by startedAt DESC.
     */
    List<Pregnancy> listByPatient(UUID patientId);

    /**
     * Returns the current EN_COURS pregnancy for a patient, or empty.
     */
    java.util.Optional<Pregnancy> findCurrent(UUID patientId);
}
