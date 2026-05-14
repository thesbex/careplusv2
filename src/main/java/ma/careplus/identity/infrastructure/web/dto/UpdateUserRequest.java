package ma.careplus.identity.infrastructure.web.dto;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Payload for PUT /api/admin/users/{id} — an admin updates an existing user's
 * profile fields, roles and (for SECRETAIRE/ASSISTANT) practitioner assignments.
 *
 * <p>All top-level fields use {@link Optional} to differentiate "not provided
 * in the JSON" (don't touch) from "explicitly null/cleared". A standard nullable
 * field cannot encode that difference for a partial update endpoint.
 *
 * <p>Semantics for {@code assignedPractitionerIds}:
 * <ul>
 *   <li>field absent / JSON null → value is {@code null} → keep current
 *       assignments untouched.</li>
 *   <li>{@code Optional.of([])} → wipe all assignments.</li>
 *   <li>{@code Optional.of([...])} → replace with exact set.</li>
 *   <li>If the user transitions to SECRETAIRE/ASSISTANT and has no existing
 *       assignments, omitting the field auto-assigns to all active practitioners.</li>
 * </ul>
 *
 * <p>Password is intentionally NOT here — password reset has its own endpoint
 * (admin-initiated reset flow) and bundling it would tangle two concerns.
 *
 * <p>V040 — adds {@code inpe}, {@code cnom}, {@code cnops} practitioner credentials.
 *
 * <p><b>Validation note:</b> bean-validation annotations on the inner Optional
 * type parameter are intentionally omitted — Hibernate Validator's container
 * element validation interacts poorly with absent vs explicit-null differentiation.
 * Field-level invariants (length caps, role whitelist, etc.) are enforced in
 * the controller after we've decided whether the field was provided at all.
 */
public record UpdateUserRequest(
        Optional<String> email,
        Optional<String> firstName,
        Optional<String> lastName,
        Optional<String> phone,
        Optional<String> specialty,
        Optional<String> inpe,
        Optional<String> cnom,
        Optional<String> cnops,
        Optional<Set<String>> roles,
        Optional<List<UUID>> assignedPractitionerIds,
        Optional<Boolean> enabled
) {}
