package ma.careplus.patient.domain;

/**
 * Fine-grained antecedent taxonomy introduced in ADR-023.
 * Stored as VARCHAR(60) in patient_antecedent.category (V006 migration).
 * The coarser {@link AntecedentType} (V001) is preserved for backward compat.
 */
public enum AntecedentCategory {
    PERSONNEL_MALADIES_CHRONIQUES,
    PERSONNEL_MALADIES_PASSEES,
    PERSONNEL_CHIRURGIES,
    PERSONNEL_HOSPITALISATIONS,
    PERSONNEL_TRAUMATISMES,
    PERSONNEL_ALLERGIES,
    FAMILIAL,
    MEDICAMENTEUX_EN_COURS,
    MEDICAMENTEUX_PASSES,
    MEDICAMENTEUX_AUTOMEDICATION,
    SOCIAL_TABAC,
    SOCIAL_ALCOOL,
    SOCIAL_DROGUES,
    SOCIAL_ACTIVITE_PHYSIQUE,
    SOCIAL_PROFESSION,
    GYNECO_OBSTETRICAL,
    PSYCHIATRIQUE
}
