package ma.careplus.identity.infrastructure.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.Set;

/**
 * Payload for POST /api/admin/users — an authenticated admin creates a new user.
 * Roles list is validated server-side against the identity_role.code column.
 */
public record CreateUserRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 12, max = 128) String password,
        @NotBlank @Size(max = 64) String firstName,
        @NotBlank @Size(max = 64) String lastName,
        @Size(max = 32) String phone,
        /** Role codes: SECRETAIRE / ASSISTANT / MEDECIN / ADMIN. At least one. */
        @NotEmpty Set<@NotBlank String> roles
) {}
