package ma.careplus.stock.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.UUID;
import ma.careplus.stock.domain.StockArticleCategory;

/**
 * Alert DTO for a lot nearing expiry.
 * Carries lot info + parent article info (code / label / category).
 */
public record StockLotWithArticleView(
        UUID lotId,
        String lotNumber,
        LocalDate expiresOn,
        int quantity,
        long daysUntilExpiry,
        UUID articleId,
        String articleCode,
        String articleLabel,
        StockArticleCategory articleCategory
) {}
