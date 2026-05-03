package ma.careplus.pregnancy.infrastructure.web.dto;

import java.time.LocalDate;
import ma.careplus.pregnancy.domain.VisitPlanStatus;

/**
 * Request body for PUT /api/pregnancies/{id}/plan/{planId}.
 * Both fields are optional — only non-null values are applied.
 */
public record PregnancyVisitPlanUpdateRequest(
        LocalDate targetDate,
        VisitPlanStatus status
) {}
