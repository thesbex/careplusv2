package ma.careplus.vaccination.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.vaccination.infrastructure.web.dto.DeferDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.RecordDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.UpdateDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.VaccinationCalendarEntry;

/**
 * Public API for patient-level vaccination operations (Étape 2).
 *
 * <ul>
 *   <li>Calendar materialisation — computes on the fly from birth date × schedule.</li>
 *   <li>Record / defer / skip / update / soft-delete a dose.</li>
 * </ul>
 */
public interface VaccinationService {

    /**
     * Returns the materialised vaccination calendar for a patient.
     *
     * <p>Algorithm:
     * <ol>
     *   <li>Load patient birth date. If absent → return empty list.</li>
     *   <li>Load persisted {@code vaccination_dose} rows (non-deleted) for this patient.</li>
     *   <li>Load all {@code vaccine_schedule_dose} joined to active {@code vaccine_catalog} entries.</li>
     *   <li>For each schedule entry compute {@code targetDate = birthDate + targetAgeDays}.</li>
     *   <li>If a persisted row exists for (vaccineId, doseNumber) → use its persisted status.</li>
     *   <li>Otherwise compute status from today vs targetDate ± tolerance.</li>
     *   <li>Exclude entries where today > targetDate + tolerance + 5 years (adult patient edge case).</li>
     *   <li>Append off-schedule persisted doses (scheduleDoseId == null).</li>
     *   <li>Sort by targetDate ASC (off-schedule entries by administeredAt).</li>
     * </ol>
     *
     * @param patientId active patient id
     * @return list of calendar entries, empty if patient has no birth date
     * @throws ma.careplus.shared.error.NotFoundException if patient not found
     */
    List<VaccinationCalendarEntry> materializeCalendar(UUID patientId);

    /**
     * Records a dose as ADMINISTERED.
     * <ul>
     *   <li>Validates lotNumber and administeredAt (required).</li>
     *   <li>If scheduleDoseId is provided → validates it exists and belongs to the same vaccineId.</li>
     *   <li>409 if (patientId, vaccineId, doseNumber) already exists (non-deleted).</li>
     *   <li>Sets patient.vaccination_started_at if still null.</li>
     * </ul>
     *
     * @return the materialised calendar entry for the new dose
     */
    VaccinationCalendarEntry recordDose(UUID patientId, RecordDoseRequest request);

    /**
     * Defers a dose.
     * If the doseId corresponds to a persisted row → PLANNED → DEFERRED.
     * If the doseId matches a scheduleDoseId → materialise the row first, then DEFERRED.
     * 404 if neither.
     */
    VaccinationCalendarEntry deferDose(UUID patientId, UUID doseId, DeferDoseRequest request);

    /**
     * Skips a dose (DEFERRED or PLANNED → SKIPPED).
     * Same materialisation logic as {@link #deferDose}.
     */
    VaccinationCalendarEntry skipDose(UUID patientId, UUID doseId);

    /**
     * Updates an existing dose. Optimistic locking via version.
     * 409 if version diverges (OptimisticLockingFailureException mapped to 409).
     */
    VaccinationCalendarEntry updateDose(UUID patientId, UUID doseId, UpdateDoseRequest request);

    /**
     * Soft-deletes a dose (sets deleted_at = now()).
     * The calendar materialiser will re-compute that slot as PLANNED/DUE_SOON/OVERDUE.
     */
    void softDelete(UUID patientId, UUID doseId);
}
