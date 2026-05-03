package ma.careplus.pregnancy.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.pregnancy.domain.Presentation;

/**
 * Read-only projection of a {@code PregnancyVisit} returned by the API.
 *
 * <p>{@code saWeeks} and {@code saDays} are the gestational age at the time
 * the visit was recorded (computed by the service from
 * {@code (recordedAt - pregnancy.lmpDate)}, stored on the entity).
 */
public record PregnancyVisitView(
        UUID id,
        UUID pregnancyId,
        UUID visitPlanId,
        UUID consultationId,
        OffsetDateTime recordedAt,
        short saWeeks,
        short saDays,
        BigDecimal weightKg,
        Short bpSystolic,
        Short bpDiastolic,
        String urineDipJson,
        BigDecimal fundalHeightCm,
        Short fetalHeartRateBpm,
        Boolean fetalMovementsPerceived,
        Presentation presentation,
        String notes,
        UUID recordedBy,
        long version
) {}
