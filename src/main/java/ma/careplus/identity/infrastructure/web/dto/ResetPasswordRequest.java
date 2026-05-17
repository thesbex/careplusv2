package ma.careplus.identity.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body for POST /api/admin/users/{id}/reset-password (V044).
 *
 * <p>Same 12-character minimum as user creation. The endpoint also flags
 * {@code password_change_required} so the target user is forced to pick a
 * new password at next login.
 */
public record ResetPasswordRequest(
        @NotBlank @Size(min = 12, max = 128) String password
) {}
