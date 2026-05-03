package ma.careplus.identity.infrastructure.web.dto;

import java.util.List;
import java.util.UUID;

/**
 * Listing-shaped projection for the Paramétrage > Utilisateurs tab.
 * Includes phone + enabled flag in addition to the basic UserView fields.
 */
public record AdminUserView(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String phone,
        boolean enabled,
        List<String> roles
) {}
