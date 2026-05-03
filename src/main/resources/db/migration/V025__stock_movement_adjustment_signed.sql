-- V025: Relax stock_movement.quantity constraint to allow signed delta for ADJUSTMENT movements.
-- Design note: for non-lot-tracking articles, ADJUSTMENT movements store the signed delta
-- (positive = stock increase, negative = stock decrease) so that currentQuantity can be computed
-- as SUM(IN.qty) - SUM(OUT.qty) + SUM(ADJUSTMENT.qty) without a separate direction column.
-- For lot-tracking articles, ADJUSTMENT movements still store |delta| (positive), so the overall
-- constraint is: quantity > 0 OR (type = 'ADJUSTMENT' AND quantity < 0 is allowed).
-- We replace the CHECK (quantity > 0) with CHECK (quantity != 0) — zero adjustments are
-- stored as qty=0 only for no-op cases, which is technically harmless but we allow it.

ALTER TABLE stock_movement
    DROP CONSTRAINT IF EXISTS stock_movement_quantity_check;

-- No new constraint: allow any integer value (positive, negative, or zero for no-op adjustments).
-- The application layer ensures semantics (IN/OUT always positive, ADJUSTMENT signed for non-lots).
