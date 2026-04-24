package ma.careplus.catalog.domain;

/** Type of prescription document. Stored as VARCHAR in clinical_prescription.type. */
public enum PrescriptionType {
    DRUG,
    LAB,
    IMAGING,
    CERT,
    SICK_LEAVE
}
