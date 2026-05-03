package ma.careplus.pregnancy.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import java.time.LocalDate;
import ma.careplus.pregnancy.domain.PregnancyOutcome;

/**
 * Request body for POST /api/pregnancies/{id}/close.
 */
public record ClosePregnancyRequest(
        @NotNull(message = "La date de clôture est obligatoire")
        @PastOrPresent(message = "La date de clôture doit être dans le passé ou aujourd'hui")
        LocalDate endedAt,

        @NotNull(message = "L'issue de la grossesse est obligatoire")
        PregnancyOutcome outcome,

        String notes
) {}
