package ma.careplus.shared.event;

import java.time.Instant;
import java.util.UUID;

/**
 * Base contract for all domain events. Every module emits events extending this.
 * Listeners use @TransactionalEventListener(phase = AFTER_COMMIT) by default.
 */
public interface DomainEvent {

    UUID eventId();

    Instant occurredAt();

    default String correlationId() {
        return org.slf4j.MDC.get("correlationId");
    }
}
