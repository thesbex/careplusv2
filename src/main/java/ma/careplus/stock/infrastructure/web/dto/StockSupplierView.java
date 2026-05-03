package ma.careplus.stock.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Read DTO for a stock supplier.
 */
public record StockSupplierView(
        UUID id,
        String name,
        String phone,
        boolean active,
        long version,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
