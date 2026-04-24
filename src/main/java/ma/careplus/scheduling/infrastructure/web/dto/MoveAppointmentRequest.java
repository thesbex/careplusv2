package ma.careplus.scheduling.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.OffsetDateTime;

public record MoveAppointmentRequest(
        @NotNull OffsetDateTime startAt,
        /** If omitted, duration is preserved. */
        @Positive Integer durationMinutes
) {}
