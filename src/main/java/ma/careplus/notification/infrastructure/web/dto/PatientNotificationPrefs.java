package ma.careplus.notification.infrastructure.web.dto;

import jakarta.validation.constraints.Pattern;

/**
 * Préférences de notification d'un patient : consentement + canal préféré.
 * {@code channel} : WHATSAPP | EMAIL | BOTH (null = BOTH selon contacts).
 */
public record PatientNotificationPrefs(
        boolean optIn,
        @Pattern(regexp = "WHATSAPP|EMAIL|BOTH", message = "Canal invalide (WHATSAPP|EMAIL|BOTH).")
        String channel
) {}
