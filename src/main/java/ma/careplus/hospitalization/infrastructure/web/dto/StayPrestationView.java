package ma.careplus.hospitalization.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Projection d'une prestation de séjour (lecture).
 */
public record StayPrestationView(
        UUID id,
        UUID stayId,
        UUID actId,
        String label,
        BigDecimal unitPrice,
        BigDecimal quantity,
        BigDecimal lineTotal,
        Instant performedAt,
        UUID createdBy
) {}
