package ma.careplus.catalog.application;

/**
 * Thrown when a DRUG prescription line contains a medication whose molecule/name
 * matches a patient allergy and allergyOverride is false.
 * Mapped to HTTP 422 by GlobalExceptionHandler.
 */
public class AllergyConflictException extends RuntimeException {

    private final String medication;
    private final String allergy;

    public AllergyConflictException(String medication, String allergy) {
        super("Conflit allergique : " + medication + " — " + allergy);
        this.medication = medication;
        this.allergy = allergy;
    }

    public String getMedication() { return medication; }
    public String getAllergy() { return allergy; }
}
