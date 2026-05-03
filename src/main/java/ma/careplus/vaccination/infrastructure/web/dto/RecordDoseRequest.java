package ma.careplus.vaccination.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccinationRoute;

/**
 * Request body for POST /api/patients/{patientId}/vaccinations.
 * Records a dose as ADMINISTERED.
 */
public record RecordDoseRequest(
        @NotNull UUID vaccineId,
        @Positive int doseNumber,
        UUID scheduleDoseId,
        @NotNull OffsetDateTime administeredAt,
        @NotBlank @Size(max = 100) String lotNumber,
        VaccinationRoute route,
        @Size(max = 64) String site,
        UUID administeredBy,
        @Size(max = 2000) String notes
) {}
