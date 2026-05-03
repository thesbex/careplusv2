package ma.careplus.vaccination.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccinationRoute;

/**
 * Read DTO for a vaccine catalog entry.
 */
public record VaccineCatalogView(
        UUID id,
        String code,
        String nameFr,
        String manufacturerDefault,
        VaccinationRoute routeDefault,
        boolean isPni,
        boolean active,
        long version,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
