package ma.careplus.stock.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.stock.domain.StockArticleCategory;

/**
 * Read DTO for a stock article.
 * currentQuantity is a placeholder (0) in Étape 1.
 * Étape 2 will populate it from stock_movement / stock_lot.
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
        long version,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
