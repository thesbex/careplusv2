package ma.careplus.identity.infrastructure.web.dto;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;

public record UserView(
        UUID id,
        String email,
        String firstName,
        String lastName,
        Set<String> roles,
        /** Granted permission codes for this user (union of role permissions, QA3-3). */
        Set<String> permissions
) {
    public UserView(UUID id, String email, String firstName, String lastName, Set<String> roles) {
        this(id, email, firstName, lastName, roles, Collections.emptySet());
    }
}
