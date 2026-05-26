package ma.careplus.hr.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import ma.careplus.hr.domain.HrLeaveEntry;
import ma.careplus.hr.domain.HrSalaryPayment;
import ma.careplus.hr.domain.HrStaff;
import ma.careplus.hr.domain.LeaveType;
import ma.careplus.hr.domain.StaffRole;
import ma.careplus.hr.infrastructure.persistence.HrLeaveEntryRepository;
import ma.careplus.hr.infrastructure.persistence.HrSalaryPaymentRepository;
import ma.careplus.hr.infrastructure.persistence.HrStaffRepository;
import ma.careplus.hr.infrastructure.web.dto.LeaveEntryRequest;
import ma.careplus.hr.infrastructure.web.dto.SalaryPaymentRequest;
import ma.careplus.hr.infrastructure.web.dto.StaffRequest;
import ma.careplus.hr.infrastructure.web.dto.StaffSummaryResponse;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation of {@link HrService}.
 * All mutations are transactional; reads are read-only.
 *
 * <p>Leave accrual formula (QA9-14 spec):
 * <pre>
 *   monthsWorked    = ChronoUnit.MONTHS.between(hireDate, today)  [clamped at 0]
 *   accruedLeaveDays = monthsWorked * 1.5
 *   takenLeaveDays   = Σ days of CONGE entries
 *   leaveBalanceDays = accruedLeaveDays - takenLeaveDays
 * </pre>
 */
@Service
@Transactional
public class HrServiceImpl implements HrService {

    private static final BigDecimal ACCRUAL_RATE = new BigDecimal("1.5");

    private final HrStaffRepository         staffRepository;
    private final HrLeaveEntryRepository    leaveRepository;
    private final HrSalaryPaymentRepository paymentRepository;

    public HrServiceImpl(HrStaffRepository staffRepository,
                         HrLeaveEntryRepository leaveRepository,
                         HrSalaryPaymentRepository paymentRepository) {
        this.staffRepository   = staffRepository;
        this.leaveRepository   = leaveRepository;
        this.paymentRepository = paymentRepository;
    }

    // ── Staff CRUD ────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<HrStaff> listStaff(Boolean active, StaffRole role) {
        return staffRepository.findAllActive(active, role);
    }

    @Override
    @Transactional(readOnly = true)
    public HrStaff findStaff(UUID id) {
        return staffRepository.findActiveById(id)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + id));
    }

    @Override
    public HrStaff createStaff(StaffRequest req, UUID createdBy) {
        HrStaff staff = new HrStaff();
        applyRequest(staff, req);
        staff.setCreatedBy(createdBy);
        return staffRepository.save(staff);
    }

    @Override
    public HrStaff updateStaff(UUID id, StaffRequest req) {
        HrStaff staff = staffRepository.findActiveById(id)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + id));
        applyRequest(staff, req);
        return staff; // @Transactional flushes on commit
    }

    @Override
    public void deleteStaff(UUID id) {
        HrStaff staff = staffRepository.findActiveById(id)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + id));
        staff.setDeletedAt(OffsetDateTime.now());
    }

    // ── Staff summary / leave balance ─────────────────────────────────────────

    /**
     * Computes the accrual summary.
     *
     * <p>monthsWorked = whole months elapsed from hire_date to today (ChronoUnit.MONTHS),
     * clamped at 0 so a future hire_date yields 0.
     * accruedLeaveDays = monthsWorked * 1.5.
     */
    @Override
    @Transactional(readOnly = true)
    public StaffSummaryResponse getSummary(UUID staffId) {
        HrStaff staff = staffRepository.findActiveById(staffId)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + staffId));

        LocalDate today = LocalDate.now();
        long monthsWorked = Math.max(0L, ChronoUnit.MONTHS.between(staff.getHireDate(), today));

        BigDecimal accrued = ACCRUAL_RATE.multiply(BigDecimal.valueOf(monthsWorked));
        BigDecimal taken   = leaveRepository.sumDaysByStaffAndType(staffId, LeaveType.CONGE);
        BigDecimal balance = accrued.subtract(taken);

        long absencesCount = leaveRepository.countByStaffAndType(staffId, LeaveType.ABSENCE);
        long latenessCount = leaveRepository.countByStaffAndType(staffId, LeaveType.RETARD);

        return new StaffSummaryResponse(
                staffId,
                monthsWorked,
                accrued,
                taken,
                balance,
                absencesCount,
                latenessCount
        );
    }

    // ── Leave entries ─────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<HrLeaveEntry> listLeave(UUID staffId) {
        // Guard: staff must exist
        staffRepository.findActiveById(staffId)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + staffId));
        return leaveRepository.findByStaffId(staffId);
    }

    @Override
    public HrLeaveEntry addLeave(UUID staffId, LeaveEntryRequest req, UUID createdBy) {
        // Guard: staff must exist
        staffRepository.findActiveById(staffId)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + staffId));

        HrLeaveEntry entry = new HrLeaveEntry();
        entry.setStaffId(staffId);
        entry.setType(LeaveType.valueOf(req.type()));
        entry.setStartDate(req.startDate());
        entry.setDays(req.days() != null ? req.days() : BigDecimal.ONE);
        entry.setNotes(req.notes());
        entry.setCreatedBy(createdBy);
        return leaveRepository.save(entry);
    }

    @Override
    public void deleteLeave(UUID leaveId) {
        HrLeaveEntry entry = leaveRepository.findById(leaveId)
                .orElseThrow(() -> new NotFoundException("LEAVE_NOT_FOUND", "Entrée de congé introuvable : " + leaveId));
        leaveRepository.delete(entry);
    }

    // ── Salary payments ───────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<HrSalaryPayment> listPayments(UUID staffId) {
        // Guard: staff must exist
        staffRepository.findActiveById(staffId)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + staffId));
        return paymentRepository.findByStaffId(staffId);
    }

    @Override
    public HrSalaryPayment addPayment(UUID staffId, SalaryPaymentRequest req, UUID createdBy) {
        // Guard: staff must exist
        staffRepository.findActiveById(staffId)
                .orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "Employé introuvable : " + staffId));

        HrSalaryPayment payment = new HrSalaryPayment();
        payment.setStaffId(staffId);
        payment.setPeriod(req.period());
        payment.setAmount(req.amount());
        payment.setPaidAt(req.paidAt());
        payment.setNotes(req.notes());
        payment.setCreatedBy(createdBy);
        return paymentRepository.save(payment);
    }

    @Override
    public void deletePayment(UUID paymentId) {
        HrSalaryPayment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new NotFoundException("PAYMENT_NOT_FOUND", "Paiement introuvable : " + paymentId));
        paymentRepository.delete(payment);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void applyRequest(HrStaff staff, StaffRequest req) {
        staff.setFullName(req.fullName());
        staff.setRole(StaffRole.valueOf(req.role()));
        staff.setHireDate(req.hireDate());
        staff.setMonthlySalary(req.monthlySalary());
        staff.setPhone(req.phone());
        staff.setUserId(req.userId());
        if (req.active() != null) {
            staff.setActive(req.active());
        }
        staff.setNotes(req.notes());
    }
}
