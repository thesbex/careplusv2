package ma.careplus.scheduling.domain;

/** V003 scheduling_appointment.type values. Extended in V026 with SUIVI_GROSSESSE. */
public enum AppointmentType {
    CONSULTATION,
    CONTROLE,
    URGENCE,
    /** Added in V026 — prenatal follow-up visit. */
    SUIVI_GROSSESSE
}
