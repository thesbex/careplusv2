package ma.careplus.pregnancy.domain;

/** Source used to determine the due date (date prévue d'accouchement). */
public enum DueDateSource {
    /** Naegele rule: LMP date + 280 days. */
    NAEGELE,
    /** Corrected by first-trimester ultrasound when echo-Naegele discrepancy &gt; 7 days. */
    ECHO_T1
}
