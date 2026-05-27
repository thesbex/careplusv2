package ma.careplus.notification.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Corps de requête pour créer / mettre à jour un modèle de notification. ADMIN. */
public record NotificationTemplateWriteRequest(

        @NotBlank(message = "L'événement est obligatoire.")
        @Pattern(regexp = "APPOINTMENT_CREATED|APPOINTMENT_REMINDER|PRESCRIPTION_READY",
                message = "Événement invalide.")
        String eventKey,

        @NotBlank(message = "Le canal est obligatoire.")
        @Pattern(regexp = "WHATSAPP|EMAIL", message = "Canal invalide (WHATSAPP|EMAIL).")
        String channel,

        @Size(max = 200, message = "Le sujet ne peut pas dépasser 200 caractères.")
        String subject,

        @NotBlank(message = "Le corps du message est obligatoire.")
        String body,

        @Size(max = 120)
        String whatsappTemplateName,

        boolean active
) {}
