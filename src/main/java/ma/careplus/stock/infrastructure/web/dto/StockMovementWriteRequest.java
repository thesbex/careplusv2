package ma.careplus.stock.infrastructure.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import ma.careplus.stock.domain.StockMovementType;

/**
 * Request body for POST /api/stock/articles/{id}/movements.
 *
 * type       — required: IN | OUT | ADJUSTMENT
 * quantity   — required: for ADJUSTMENT this is the NEW total quantity (not delta)
 * reason     — required for ADJUSTMENT, optional otherwise
 * lotNumber  — required for IN on MEDICAMENT_INTERNE
 * expiresOn  — required for IN on MEDICAMENT_INTERNE
 */
public record StockMovementWriteRequest(
        @NotNull StockMovementType type,
        @Min(0) int quantity,
        String reason,
        String lotNumber,
        LocalDate expiresOn
) {}
