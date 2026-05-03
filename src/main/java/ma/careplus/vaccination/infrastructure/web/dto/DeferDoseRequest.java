package ma.careplus.vaccination.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request body for POST /api/patients/{patientId}/vaccinations/{doseId}/defer.
 */
public record DeferDoseRequest(
        @NotNull @NotBlank @Size(max = 200) String reason
) {}
