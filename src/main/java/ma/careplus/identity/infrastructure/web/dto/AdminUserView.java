package ma.careplus.identity.infrastructure.web.dto;

import java.util.List;
import java.util.UUID;

/**
 * Listing-shaped projection for the Paramétrage > Utilisateurs tab and the
 * onboarding wizard's "Médecin" step team list.
 *
 * <p>V040 — exposes practitioner credentials (specialty, INPE, CNOM, CNOPS)
 * directly in the list so the multi-praticien wizard doesn't need an N+1
 * round-trip to render each médecin's avatar row. Non-practitioner users
 * have null values for these fields.
 */
public record AdminUserView(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String phone,
        boolean enabled,
        List<String> roles,
        String specialty,
        String inpe,
        String cnom,
        String cnops,
        /** V031/V035 — true if this user has a signature_blob configured. */
        boolean hasSignature
) {
    /** Back-compat constructor for callers that don't yet know about the credential fields. */
    public AdminUserView(UUID id, String email, String firstName, String lastName,
                         String phone, boolean enabled, List<String> roles) {
        this(id, email, firstName, lastName, phone, enabled, roles,
                null, null, null, null, false);
    }
}
