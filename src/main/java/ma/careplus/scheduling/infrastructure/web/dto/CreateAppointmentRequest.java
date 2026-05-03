package ma.careplus.scheduling.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreateAppointmentRequest(
        @NotNull UUID patientId,
        @NotNull UUID practitionerId,
        UUID reasonId,
        @NotNull OffsetDateTime startAt,
        /** If omitted, inferred from reason's duration. */
        @Positive Integer durationMinutes,
        Boolean walkIn,
        Boolean urgency,
        @Size(max = 500) String notes
) {}
