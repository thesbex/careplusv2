package ma.careplus.stock.infrastructure.web.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import ma.careplus.stock.domain.StockLotStatus;

/**
 * Read DTO for a stock lot.
 * daysUntilExpiry: positive = days remaining, negative = already expired, null if expiresOn is null.
 */
public record StockLotView(
        UUID id,
        UUID articleId,
        String lotNumber,
        LocalDate expiresOn,
        int quantity,
        StockLotStatus status,
        Long daysUntilExpiry,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    /**
     * Factory that computes daysUntilExpiry from today.
     */
    public static StockLotView from(ma.careplus.stock.domain.StockLot lot) {
        Long days = null;
        if (lot.getExpiresOn() != null) {
            days = ChronoUnit.DAYS.between(LocalDate.now(), lot.getExpiresOn());
        }
        return new StockLotView(
                lot.getId(),
                lot.getArticleId(),
                lot.getLotNumber(),
                lot.getExpiresOn(),
                lot.getQuantity(),
                lot.getStatus(),
                days,
                lot.getCreatedAt(),
                lot.getUpdatedAt()
        );
    }
}
