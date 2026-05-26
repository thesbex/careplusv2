package ma.careplus.hr.domain;

/**
 * Role/function of a staff member in the cabinet.
 * Maps the CHECK constraint in V061__hr_staff.sql.
 */
public enum StaffRole {
    SECURITE,
    MENAGE,
    INFIRMIER,
    SECRETAIRE,
    ASSISTANTE,
    TECHNICIEN,
    AUTRE
}
