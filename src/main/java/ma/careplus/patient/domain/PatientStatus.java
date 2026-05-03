package ma.careplus.patient.domain;

/** Lifecycle state of a patient record. Mirrors V001 patient_patient.status. */
public enum PatientStatus {
    PROSPECT,
    ACTIF,
    ARCHIVE,
    ANONYMISE
}
