package ma.careplus.stock.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.stock.domain.StockMovement;

/**
 * Public API for stock movements — Étape 2.
 * Handles IN / OUT (FIFO) / ADJUSTMENT logic.
 */
public interface StockMovementService {

    /**
     * Record an IN movement.
     * For MEDICAMENT_INTERNE: lotNumber + expiresOn required (400 LOT_REQUIRED otherwise).
     * If lot exists (article_id + lot_number) → increment quantity; otherwise create the lot.
     * Returns a single StockMovement row.
     */
    StockMovement recordIn(UUID articleId, int quantity,
                           String lotNumber, LocalDate expiresOn,
                           UUID performedByUserId);

    /**
     * Record an OUT movement.
     * For MEDICAMENT_INTERNE: FIFO automatic on ACTIVE lots sorted by expires_on ASC, created_at ASC.
     * May create multiple StockMovement rows (one per lot consumed).
     * If total ACTIVE < quantity → 422 INSUFFICIENT_STOCK.
     * Lot reaching qty=0 → status EXHAUSTED.
     * For non-tracking articles: single OUT row, lot_id null.
     */
    List<StockMovement> recordOut(UUID articleId, int quantity, UUID performedByUserId);

    /**
     * Record an ADJUSTMENT movement.
     * reason is mandatory (400 REASON_REQUIRED otherwise).
     * quantity parameter is the NEW total quantity (not the delta).
     * Computes delta = newQuantity - currentQuantity.
     * For MEDICAMENT_INTERNE: applies delta to oldest ACTIVE lot; if delta > 0 and no ACTIVE lot exists,
     * creates an adjustment lot with lot_number = "ADJ-{date}".
     * Creates 1 StockMovement row ADJUSTMENT with quantity = |delta| and reason persisted.
     */
    StockMovement recordAdjustment(UUID articleId, int newQuantity, String reason, UUID performedByUserId);

    /**
     * Get current quantity for an article.
     * For tracks_lots=true:  SUM(stock_lot.quantity WHERE status='ACTIVE')
     * For tracks_lots=false: SUM(IN) - SUM(OUT) + SUM(ADJUSTMENT net delta) from movements
     */
    long getCurrentQuantity(UUID articleId);

    /**
     * Paginated history of movements for an article, newest first.
     * type: null = all types, otherwise filter by type name string ("IN", "OUT", "ADJUSTMENT").
     * Optional date range filter (from/to on performed_at).
     */
    List<StockMovement> listMovements(UUID articleId,
                                      String typeFilter,
                                      java.time.OffsetDateTime from,
                                      java.time.OffsetDateTime to,
                                      org.springframework.data.domain.Pageable pageable);

    long countMovements(UUID articleId,
                        String typeFilter,
                        java.time.OffsetDateTime from,
                        java.time.OffsetDateTime to);
}
