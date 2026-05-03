package ma.careplus.stock.infrastructure.web.dto;

import java.util.UUID;

/**
 * Embedded view of the user who performed a stock movement.
 */
public record PerformedByView(UUID id, String name) {}
