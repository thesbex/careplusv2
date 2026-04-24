package ma.careplus.scheduling.domain;

/** Matches V001 scheduling_appointment.status CHECK constraint. */
public enum AppointmentStatus {
    PLANIFIE,
    CONFIRME,
    ARRIVE,
    EN_ATTENTE_CONSTANTES,
    CONSTANTES_PRISES,
    EN_CONSULTATION,
    CONSULTATION_TERMINEE,
    FACTURE,
    CLOS,
    ANNULE,
    NO_SHOW
}
