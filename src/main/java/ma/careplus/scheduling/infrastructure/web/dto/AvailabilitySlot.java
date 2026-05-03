package ma.careplus.scheduling.infrastructure.web.dto;

import java.time.OffsetDateTime;

/** A free slot returned by GET /api/availability. */
public record AvailabilitySlot(
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        int durationMinutes
) {}
