package ma.careplus.notification.application;

import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import ma.careplus.notification.application.spi.NotificationSender;
import ma.careplus.notification.application.spi.OutboxMessage;
import ma.careplus.notification.application.spi.SendResult;
import ma.careplus.notification.domain.NotificationChannel;
import ma.careplus.notification.domain.NotificationOutbox;
import ma.careplus.notification.domain.NotificationStatus;
import ma.careplus.notification.infrastructure.persistence.NotificationOutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Remet une ligne d'outbox à l'envoyeur du canal et persiste le résultat.
 * Aucun {@link NotificationSender} pour un canal (cas v1 socle) →
 * {@code SENT_SIMULATED} (log, aucun envoi réel). Ne lève jamais : un échec
 * d'envoi ne doit pas remonter dans le flux métier.
 */
@Component
public class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final Map<NotificationChannel, NotificationSender> senders = new EnumMap<>(NotificationChannel.class);
    private final NotificationOutboxRepository outboxRepository;

    public NotificationDispatcher(List<NotificationSender> senderBeans,
                                  NotificationOutboxRepository outboxRepository) {
        for (NotificationSender s : senderBeans) {
            this.senders.put(s.channel(), s);
        }
        this.outboxRepository = outboxRepository;
    }

    public void dispatch(NotificationOutbox row) {
        NotificationChannel channel = NotificationChannel.valueOf(row.getChannel());
        NotificationSender sender = senders.get(channel);
        row.setAttempts(row.getAttempts() + 1);

        if (sender == null) {
            // Pas d'envoyeur réel configuré → simulation.
            log.info("[notif] simulation {} → {} (dedupe={})", channel, row.getToAddress(), row.getDedupeKey());
            row.setStatus(NotificationStatus.SENT_SIMULATED.name());
            row.setSentAt(OffsetDateTime.now());
            row.setLastError(null);
            outboxRepository.save(row);
            return;
        }

        SendResult result;
        try {
            result = sender.send(new OutboxMessage(
                    channel, row.getToAddress(), row.getRenderedSubject(),
                    row.getRenderedBody(), null));
        } catch (RuntimeException ex) {
            result = SendResult.failed(ex.getMessage());
        }
        row.setStatus(result.status().name());
        if (result.status() == NotificationStatus.SENT) {
            row.setSentAt(OffsetDateTime.now());
            row.setLastError(null);
        } else {
            row.setLastError(result.error());
        }
        outboxRepository.save(row);
    }
}
