package ma.careplus.stock.domain;

/**
 * Type of stock movement.
 * The quantity field is always positive; the sign is carried by this type.
 */
public enum StockMovementType {
    /** Incoming stock (reception from supplier, donation). */
    IN,
    /** Outgoing stock (consumption, dispensing). */
    OUT,
    /** Manual adjustment to correct discrepancy (requires reason). */
    ADJUSTMENT
}
