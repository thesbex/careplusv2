package ma.careplus.hr.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response DTO for a staff member.
 */
public record StaffResponse(
        UUID          id,
        String        fullName,
        String        role,
        LocalDate     hireDate,
        BigDecimal    monthlySalary,
        String        phone,
        UUID          userId,
        boolean       active,
        String        notes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
