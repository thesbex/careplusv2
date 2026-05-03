package ma.careplus.stock.infrastructure.web.dto;

import java.util.List;

/**
 * Detailed alerts response.
 * Used by GET /api/stock/alerts.
 */
public record StockAlertsView(
        List<StockArticleView> lowStock,
        List<StockLotWithArticleView> expiringSoon
) {}
