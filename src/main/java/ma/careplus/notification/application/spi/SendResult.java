package ma.careplus.notification.application.spi;

import ma.careplus.notification.domain.NotificationStatus;

/**
 * Résultat d'un envoi par un {@link NotificationSender}.
 * {@code error} non null seulement si {@code status == FAILED}.
 */
public record SendResult(NotificationStatus status, String error) {

    public static SendResult sent() {
        return new SendResult(NotificationStatus.SENT, null);
    }

    public static SendResult failed(String error) {
        return new SendResult(NotificationStatus.FAILED, error);
    }
}
