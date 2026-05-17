package ma.careplus.identity.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body for POST /api/users/me/change-password (V044).
 *
 * <p>The user must prove possession of the {@code currentPassword} before
 * we accept a new one. Same 12-character minimum as creation / admin reset.
 */
public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 12, max = 128) String newPassword
) {}
