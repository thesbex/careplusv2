package ma.careplus.notification.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.notification.domain.NotificationTemplate;

/** Vue en lecture d'un modèle de notification. */
public record NotificationTemplateView(
        UUID id,
        String eventKey,
        String channel,
        String subject,
        String body,
        String whatsappTemplateName,
        boolean active,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static NotificationTemplateView of(NotificationTemplate t) {
        return new NotificationTemplateView(
                t.getId(), t.getEventKey(), t.getChannel(), t.getSubject(),
                t.getBody(), t.getWhatsappTemplateName(), t.isActive(),
                t.getCreatedAt(), t.getUpdatedAt());
    }
}
