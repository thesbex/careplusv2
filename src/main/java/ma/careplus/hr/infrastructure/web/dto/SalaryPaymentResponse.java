package ma.careplus.hr.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response DTO for a salary payment entry.
 */
public record SalaryPaymentResponse(
        UUID          id,
        UUID          staffId,
        String        period,
        BigDecimal    amount,
        LocalDate     paidAt,
        String        notes,
        OffsetDateTime createdAt
) {}
