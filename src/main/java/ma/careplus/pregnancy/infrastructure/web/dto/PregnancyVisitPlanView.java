package ma.careplus.pregnancy.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.UUID;
import ma.careplus.pregnancy.domain.VisitPlanStatus;

/**
 * Read-only view of a pregnancy visit plan entry.
 */
public record PregnancyVisitPlanView(
        UUID id,
        UUID pregnancyId,
        short targetSaWeeks,
        LocalDate targetDate,
        int toleranceDays,
        VisitPlanStatus status,
        UUID appointmentId,
        UUID consultationId,
        long version
) {}
