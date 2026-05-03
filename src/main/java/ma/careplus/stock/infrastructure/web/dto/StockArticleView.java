package ma.careplus.stock.infrastructure.web.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.stock.domain.StockArticleCategory;

/**
 * Read DTO for a stock article.
 * currentQuantity is computed from stock_movement / stock_lot.
 * nearestExpiry: nearest expiry date among ACTIVE lots (MEDICAMENT_INTERNE only), null otherwise.
 */
public record StockArticleView(
        UUID id,
        String code,
        String label,
        StockArticleCategory category,
        String unit,
        int minThreshold,
        UUID supplierId,
        String supplierName,
        String location,
        boolean active,
        boolean tracksLots,
        long currentQuantity,
        LocalDate nearestExpiry,
        long version,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
