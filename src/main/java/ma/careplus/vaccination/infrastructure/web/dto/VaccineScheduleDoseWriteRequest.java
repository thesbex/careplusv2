package ma.careplus.vaccination.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Write DTO for creating or updating a schedule dose entry.
 */
public record VaccineScheduleDoseWriteRequest(

        @NotNull
        UUID vaccineId,

        @Positive
        short doseNumber,

        @PositiveOrZero
        int targetAgeDays,

        @Positive
        int toleranceDays,

        @Size(max = 255)
        String labelFr
) {}
