package ma.careplus.pregnancy.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request body for POST /api/pregnancies/{id}/create-child.
 */
public record CreateChildRequest(
        @NotBlank(message = "Le prénom de l'enfant est obligatoire")
        @Size(min = 2, max = 64)
        String firstName,

        @NotBlank(message = "Le sexe de l'enfant est obligatoire (M ou F)")
        @Pattern(regexp = "M|F", message = "Le sexe doit être M ou F")
        String sex
) {}
