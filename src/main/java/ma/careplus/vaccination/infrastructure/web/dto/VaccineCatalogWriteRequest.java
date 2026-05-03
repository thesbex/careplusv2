package ma.careplus.vaccination.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ma.careplus.vaccination.domain.VaccinationRoute;

/**
 * Write DTO for creating or updating a vaccine in the catalog.
 */
public record VaccineCatalogWriteRequest(

        @NotBlank
        @Size(max = 32)
        @Pattern(regexp = "[A-Z0-9_\\-]+", message = "Le code doit être en majuscules alphanumériques")
        String code,

        @NotBlank
        @Size(max = 255)
        String nameFr,

        @Size(max = 255)
        String manufacturerDefault,

        @NotNull
        VaccinationRoute routeDefault,

        boolean isPni
) {}
