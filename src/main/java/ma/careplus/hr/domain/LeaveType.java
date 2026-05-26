package ma.careplus.hr.domain;

/**
 * Type of leave / absence event.
 * Maps the CHECK constraint on hr_leave_entry.type in V061__hr_staff.sql.
 */
public enum LeaveType {
    CONGE,
    ABSENCE,
    RETARD
}
