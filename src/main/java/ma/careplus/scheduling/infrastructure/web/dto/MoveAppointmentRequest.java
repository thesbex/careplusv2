package ma.careplus.scheduling.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.OffsetDateTime;
import java.util.UUID;

public record MoveAppointmentRequest(
        @NotNull OffsetDateTime startAt,
        /** If omitted, duration is preserved. */
        @Positive Integer durationMinutes,
        /** Nouvelle salle assignée (nullable). null = conserver la salle existante. */
        UUID roomId
) {}
