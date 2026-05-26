package ma.careplus.hr.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Summary / balance view for a staff member.
 *
 * <ul>
 *   <li>accruedLeaveDays  = monthsWorked × 1.5</li>
 *   <li>takenLeaveDays    = Σ days of CONGE entries</li>
 *   <li>leaveBalanceDays  = accruedLeaveDays − takenLeaveDays</li>
 *   <li>absencesCount     = count of ABSENCE entries</li>
 *   <li>latenessCount     = count of RETARD entries</li>
 * </ul>
 */
public record StaffSummaryResponse(
        UUID       staffId,
        long       monthsWorked,
        BigDecimal accruedLeaveDays,
        BigDecimal takenLeaveDays,
        BigDecimal leaveBalanceDays,
        long       absencesCount,
        long       latenessCount
) {}
