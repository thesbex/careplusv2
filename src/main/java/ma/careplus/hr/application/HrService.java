package ma.careplus.hr.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.hr.domain.HrLeaveEntry;
import ma.careplus.hr.domain.HrSalaryPayment;
import ma.careplus.hr.domain.HrStaff;
import ma.careplus.hr.domain.StaffRole;
import ma.careplus.hr.infrastructure.web.dto.LeaveEntryRequest;
import ma.careplus.hr.infrastructure.web.dto.SalaryPaymentRequest;
import ma.careplus.hr.infrastructure.web.dto.StaffRequest;
import ma.careplus.hr.infrastructure.web.dto.StaffSummaryResponse;

/**
 * Public application interface for the HR module.
 * Controller injects this interface, not the implementation.
 */
public interface HrService {

    // ── Staff CRUD ────────────────────────────────────────────────────────────

    /**
     * List non-deleted staff members.
     *
     * @param active optional filter on active flag
     * @param role   optional filter on role
     */
    List<HrStaff> listStaff(Boolean active, StaffRole role);

    /**
     * Find a non-deleted staff member by id.
     *
     * @throws ma.careplus.shared.error.NotFoundException if not found or soft-deleted
     */
    HrStaff findStaff(UUID id);

    /**
     * Create a new staff member.
     *
     * @param request   request body
     * @param createdBy authenticated user id
     */
    HrStaff createStaff(StaffRequest request, UUID createdBy);

    /**
     * Update an existing staff member.
     *
     * @throws ma.careplus.shared.error.NotFoundException if not found or soft-deleted
     */
    HrStaff updateStaff(UUID id, StaffRequest request);

    /**
     * Soft-delete a staff member (sets deleted_at = now()).
     *
     * @throws ma.careplus.shared.error.NotFoundException if not found or already deleted
     */
    void deleteStaff(UUID id);

    // ── Staff summary / leave balance ─────────────────────────────────────────

    /**
     * Compute accrual summary for a staff member.
     *
     * <p>Accrual formula: {@code accruedLeaveDays = monthsWorked * 1.5}
     * where {@code monthsWorked = ChronoUnit.MONTHS.between(hireDate, today)} clamped at 0.
     *
     * @throws ma.careplus.shared.error.NotFoundException if staff not found or soft-deleted
     */
    StaffSummaryResponse getSummary(UUID staffId);

    // ── Leave entries ─────────────────────────────────────────────────────────

    List<HrLeaveEntry> listLeave(UUID staffId);

    /**
     * Add a leave / absence / lateness entry.
     *
     * @throws ma.careplus.shared.error.NotFoundException if staff not found or soft-deleted
     */
    HrLeaveEntry addLeave(UUID staffId, LeaveEntryRequest request, UUID createdBy);

    /**
     * Delete a leave entry (physical delete).
     *
     * @throws ma.careplus.shared.error.NotFoundException if not found
     */
    void deleteLeave(UUID leaveId);

    // ── Salary payments ───────────────────────────────────────────────────────

    List<HrSalaryPayment> listPayments(UUID staffId);

    /**
     * Add a salary payment log entry.
     *
     * @throws ma.careplus.shared.error.NotFoundException if staff not found or soft-deleted
     */
    HrSalaryPayment addPayment(UUID staffId, SalaryPaymentRequest request, UUID createdBy);

    /**
     * Delete a salary payment entry (physical delete).
     *
     * @throws ma.careplus.shared.error.NotFoundException if not found
     */
    void deletePayment(UUID paymentId);
}
