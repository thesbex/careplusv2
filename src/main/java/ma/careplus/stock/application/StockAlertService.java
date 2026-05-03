package ma.careplus.stock.application;

import ma.careplus.stock.infrastructure.web.dto.StockAlertCountView;
import ma.careplus.stock.infrastructure.web.dto.StockAlertsView;

/**
 * Public API for stock alerts — Étape 3.
 *
 * getAlertCount():  aggregate counts for sidebar badge (polling 30s).
 * listAlerts():     detailed lists for the /api/stock/alerts page.
 *
 * All operations are read-only.
 */
public interface StockAlertService {

    /**
     * Returns alert counts:
     * - lowStock: number of active articles with currentQuantity < minThreshold (threshold > 0).
     * - expiringSoon: number of ACTIVE lots (whose article is active) expiring within 30 days.
     */
    StockAlertCountView getAlertCount();

    /**
     * Returns the full alert detail:
     * - lowStock: list of StockArticleView for articles below threshold (with currentQuantity computed).
     * - expiringSoon: list of StockLotWithArticleView for lots expiring within 30 days.
     */
    StockAlertsView listAlerts();
}
