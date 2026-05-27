package ma.careplus.notification.application.spi;

import ma.careplus.notification.domain.NotificationChannel;

/**
 * Point d'extension provider : un envoyeur réel pour un canal donné
 * (EmailSender SMTP, WhatsAppSender Meta Cloud API…). Aucun bean en v1 socle →
 * le dispatcher retombe sur la simulation (NoOp). Branchés en phase 4.
 */
public interface NotificationSender {

    /** Canal géré par cet envoyeur. */
    NotificationChannel channel();

    /** Envoi effectif. Ne doit pas lever : encapsule l'échec dans SendResult.failed(). */
    SendResult send(OutboxMessage message);
}
