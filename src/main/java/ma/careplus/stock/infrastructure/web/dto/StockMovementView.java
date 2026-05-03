package ma.careplus.stock.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.stock.domain.StockMovementType;

/**
 * Read DTO for a stock movement.
 */
public record StockMovementView(
        UUID id,
        UUID articleId,
        UUID lotId,
        StockMovementType type,
        int quantity,
        String reason,
        PerformedByView performedBy,
        OffsetDateTime performedAt
) {}
