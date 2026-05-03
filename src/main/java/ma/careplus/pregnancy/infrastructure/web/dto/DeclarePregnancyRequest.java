package ma.careplus.pregnancy.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import java.time.LocalDate;

/**
 * Request body for POST /api/patients/{patientId}/pregnancies.
 */
public record DeclarePregnancyRequest(
        @NotNull(message = "La date des dernières règles (DDR) est obligatoire")
        @PastOrPresent(message = "La DDR doit être dans le passé ou aujourd'hui")
        LocalDate lmpDate,

        String notes
) {}
