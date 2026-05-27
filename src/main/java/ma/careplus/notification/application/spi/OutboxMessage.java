package ma.careplus.notification.application.spi;

import ma.careplus.notification.domain.NotificationChannel;

/**
 * Message rendu remis à un {@link NotificationSender}. Découple le provider de
 * l'entité de persistance {@code NotificationOutbox}.
 */
public record OutboxMessage(
        NotificationChannel channel,
        String toAddress,
        String subject,
        String body,
        String whatsappTemplateName
) {}
