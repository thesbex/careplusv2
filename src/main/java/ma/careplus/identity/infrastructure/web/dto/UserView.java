package ma.careplus.identity.infrastructure.web.dto;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record UserView(
        UUID id,
        String email,
        String firstName,
        String lastName,
        Set<String> roles,
        /** Granted permission codes for this user (union of role permissions, QA3-3). */
        Set<String> permissions,
        /** Practitioner ids this user is assigned to (V032, empty for MEDECIN/ADMIN-only). */
        List<UUID> assignedPractitionerIds
) {
    public UserView(UUID id, String email, String firstName, String lastName, Set<String> roles) {
        this(id, email, firstName, lastName, roles, Collections.emptySet(), Collections.emptyList());
    }

    public UserView(UUID id, String email, String firstName, String lastName,
                    Set<String> roles, Set<String> permissions) {
        this(id, email, firstName, lastName, roles, permissions, Collections.emptyList());
    }
}
