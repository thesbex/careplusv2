package ma.careplus.vaccination.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Read DTO for a vaccine schedule dose entry.
 */
public record VaccineScheduleDoseView(
        UUID id,
        UUID vaccineId,
        short doseNumber,
        int targetAgeDays,
        int toleranceDays,
        String labelFr,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
