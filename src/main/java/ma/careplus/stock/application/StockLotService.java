package ma.careplus.stock.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.stock.domain.StockLot;
import ma.careplus.stock.domain.StockLotStatus;

/**
 * Public API for stock lot management — Étape 2.
 */
public interface StockLotService {

    /**
     * Inactivate a lot (e.g. supplier recall).
     * ACTIVE → INACTIVE. Idempotent if already INACTIVE.
     * Refuses if EXHAUSTED (409 LOT_EXHAUSTED).
     * Does NOT create a stock movement.
     */
    StockLot inactivateLot(UUID lotId, UUID performedByUserId);

    /**
     * List lots for an article with optional status filter.
     * If statusFilter is null, returns all statuses.
     * Ordered by expires_on ASC.
     */
    List<StockLot> listLotsForArticle(UUID articleId, StockLotStatus statusFilter);
}
