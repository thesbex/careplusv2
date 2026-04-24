package ma.careplus.identity.infrastructure.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Payload for POST /api/admin/bootstrap — creates the first admin on an empty instance. */
public record BootstrapRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 12, max = 128) String password,
        @NotBlank @Size(max = 64) String firstName,
        @NotBlank @Size(max = 64) String lastName
) {}
