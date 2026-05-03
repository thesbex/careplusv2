package ma.careplus.vaccination.domain;

/**
 * Extended status for vaccination calendar entries.
 * Persisted statuses (ADMINISTERED, DEFERRED, SKIPPED, PLANNED) come from
 * {@link VaccinationStatus}. Computed-only statuses (UPCOMING, DUE_SOON,
 * OVERDUE) are derived on the fly from birth date + schedule target age.
 */
public enum VaccinationCalendarStatus {
    /** Dose not yet due (today <= targetDate - tolerance). */
    UPCOMING,
    /** Dose due within the tolerance window (targetDate ± tolerance). */
    DUE_SOON,
    /** Dose overdue (today > targetDate + tolerance), not yet administered. */
    OVERDUE,
    /** Dose successfully administered — persisted. */
    ADMINISTERED,
    /** Dose deferred with a reason — persisted. */
    DEFERRED,
    /** Dose deliberately skipped — persisted. */
    SKIPPED
}
