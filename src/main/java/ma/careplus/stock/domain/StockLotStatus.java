package ma.careplus.stock.domain;

/**
 * Lifecycle status of a stock lot.
 */
public enum StockLotStatus {
    /** Lot has remaining quantity and can be consumed. */
    ACTIVE,
    /** Lot quantity reached 0 — auto-set by FIFO logic. */
    EXHAUSTED,
    /** Manually deactivated (e.g. supplier recall). Ignored by FIFO. */
    INACTIVE
}
