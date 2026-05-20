package ma.careplus.identity.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Payload create / update d'un confrère (V046). Mêmes contraintes côté DB,
 * la validation Bean Validation surface une erreur métier plus lisible que
 * la violation SQL.
 */
public record ReferralContactRequest(
        @NotBlank @Size(max = 160) String fullName,
        @NotBlank @Size(max = 120) String specialty,
        @Size(max = 40) String phone,
        @Size(max = 120) String city,
        @Size(max = 4000) String notes
) {}
