package ma.careplus.identity.infrastructure.web.dto;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Single-user view returned by GET /api/admin/users/{id} and write endpoints.
 *
 * <p>V040 — exposes practitioner credentials (specialty, INPE, CNOM, CNOPS) so
 * the onboarding wizard "Médecin" step can preload the form without a second
 * round-trip. Non-practitioners always have null/empty values.
 */
public record UserView(
        UUID id,
        String email,
        String firstName,
        String lastName,
        Set<String> roles,
        /** Granted permission codes for this user (union of role permissions, QA3-3). */
        Set<String> permissions,
        /** Practitioner ids this user is assigned to (V032, empty for MEDECIN/ADMIN-only). */
        List<UUID> assignedPractitionerIds,
        /** V032 — médecin's clinical specialty. */
        String specialty,
        /** V040 — practitioner INPE. */
        String inpe,
        /** V040 — practitioner CNOM. */
        String cnom,
        /** V040 — practitioner CNOPS. */
        String cnops
) {
    public UserView(UUID id, String email, String firstName, String lastName, Set<String> roles) {
        this(id, email, firstName, lastName, roles, Collections.emptySet(), Collections.emptyList(),
                null, null, null, null);
    }

    public UserView(UUID id, String email, String firstName, String lastName,
                    Set<String> roles, Set<String> permissions) {
        this(id, email, firstName, lastName, roles, permissions, Collections.emptyList(),
                null, null, null, null);
    }

    public UserView(UUID id, String email, String firstName, String lastName,
                    Set<String> roles, Set<String> permissions, List<UUID> assignedPractitionerIds) {
        this(id, email, firstName, lastName, roles, permissions, assignedPractitionerIds,
                null, null, null, null);
    }
}
