package ma.careplus.stock.infrastructure.web.dto;

/**
 * Aggregate counts for stock alerts.
 * Used by GET /api/stock/alerts/count (sidebar badge polling).
 */
public record StockAlertCountView(int lowStock, int expiringSoon) {}
