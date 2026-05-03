package ma.careplus.pregnancy.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import java.time.LocalDate;
import ma.careplus.pregnancy.domain.DueDateSource;

/**
 * Request body for PUT /api/pregnancies/{id}.
 */
public record UpdatePregnancyRequest(
        @NotNull(message = "La date des dernières règles (DDR) est obligatoire")
        @PastOrPresent(message = "La DDR doit être dans le passé ou aujourd'hui")
        LocalDate lmpDate,

        LocalDate dueDate,

        DueDateSource dueDateSource,

        String notes
) {}
