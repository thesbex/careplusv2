package ma.careplus.identity.infrastructure.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Payload for POST /api/admin/users — an authenticated admin creates a new user.
 * Roles list is validated server-side against the identity_role.code column.
 *
 * <p><b>{@code assignedPractitionerIds}</b> (V032) — only meaningful when the
 * created user has the SECRETAIRE or ASSISTANT role:
 * <ul>
 *   <li>field absent (or JSON {@code null}) → value is {@code null} → auto-assign
 *       to all active MEDECIN users (sensible default for small cabinets).</li>
 *   <li>{@code Optional.of([])} (empty list) → no assignment created.</li>
 *   <li>{@code Optional.of([uuid1, uuid2])} → exactly that set.</li>
 * </ul>
 * Ignored entirely for users created with only MEDECIN / ADMIN roles.
 */
public record CreateUserRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 12, max = 128) String password,
        @NotBlank @Size(max = 64) String firstName,
        @NotBlank @Size(max = 64) String lastName,
        @Size(max = 32) String phone,
        @Size(max = 120) String specialty,
        /** Role codes: SECRETAIRE / ASSISTANT / MEDECIN / ADMIN. At least one. */
        @NotEmpty Set<@NotBlank String> roles,
        /** Practitioner ids the new user assists (SECRETAIRE/ASSISTANT only). */
        Optional<List<UUID>> assignedPractitionerIds
) {}
