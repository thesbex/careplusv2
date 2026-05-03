package ma.careplus.vaccination.domain;

/**
 * Status of a vaccination dose entry.
 */
public enum VaccinationStatus {
    /** Dose planned per the PNI calendar but not yet administered. */
    PLANNED,
    /** Dose successfully administered. */
    ADMINISTERED,
    /** Dose deferred (reported) with a reason. */
    DEFERRED,
    /** Dose deliberately skipped. */
    SKIPPED
}
