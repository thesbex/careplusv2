package ma.careplus.identity.infrastructure.web.dto;

import java.util.UUID;

/**
 * Read-only projection of a MEDECIN user — used by every screen that needs to
 * pick a practitioner (agenda owner selector, prescription doctor picker,
 * paramètres > assignations secrétaires/assistants).
 *
 * Includes {@code active} so the frontend can render disabled-but-historical
 * users with a different style (e.g. greyed out in a "Dr. inactif" filter).
 */
public record PractitionerView(
        UUID id,
        String firstName,
        String lastName,
        String specialty,
        boolean active
) {}
