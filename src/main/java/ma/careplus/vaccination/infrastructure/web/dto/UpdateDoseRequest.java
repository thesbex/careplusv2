package ma.careplus.vaccination.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccinationRoute;

/**
 * Request body for PUT /api/patients/{patientId}/vaccinations/{doseId}.
 * All fields are optional except {@code version} (required for optimistic locking).
 */
public record UpdateDoseRequest(
        OffsetDateTime administeredAt,
        @Size(max = 100) String lotNumber,
        VaccinationRoute route,
        @Size(max = 64) String site,
        UUID administeredBy,
        @Size(max = 200) String deferralReason,
        @Size(max = 2000) String notes,
        @NotNull Long version
) {}
