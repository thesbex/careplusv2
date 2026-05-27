package ma.careplus.notification.domain;

/** Statut d'une ligne d'outbox. */
public enum NotificationStatus {
    /** En file d'attente, pas encore envoyée. */
    PENDING,
    /** Envoyée avec succès par un provider réel. */
    SENT,
    /** Échec d'envoi (voir last_error) — éligible au retry. */
    FAILED,
    /** Ignorée volontairement (ex. provider non configuré côté canal). */
    SKIPPED,
    /** "Envoyée" en simulation (provider NoOp) — aucun envoi réel. */
    SENT_SIMULATED
}
