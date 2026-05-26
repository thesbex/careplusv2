package ma.careplus.hr.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response DTO for a leave / absence / lateness entry.
 */
public record LeaveEntryResponse(
        UUID          id,
        UUID          staffId,
        String        type,
        LocalDate     startDate,
        BigDecimal    days,
        String        notes,
        OffsetDateTime createdAt
) {}
