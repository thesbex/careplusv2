package ma.careplus.clinical.domain;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.shared.event.DomainEvent;

/**
 * Emitted when a consultation transitions BROUILLON → SIGNEE.
 * Listeners in billing (J7) create the draft invoice; other modules may
 * pick this up later for analytics, notifications, etc. Delivered via
 * `ApplicationEventPublisher` + `@TransactionalEventListener(AFTER_COMMIT)`
 * per ARCHITECTURE.md — never cross-module method calls.
 */
public record ConsultationSigneeEvent(
        UUID eventId,
        UUID consultationId,
        UUID patientId,
        UUID practitionerId,
        UUID appointmentId,
        OffsetDateTime signedAt
) implements DomainEvent {

    public static ConsultationSigneeEvent of(
            UUID consultationId, UUID patientId, UUID practitionerId,
            UUID appointmentId, OffsetDateTime signedAt) {
        return new ConsultationSigneeEvent(
                UUID.randomUUID(), consultationId, patientId,
                practitionerId, appointmentId, signedAt);
    }

    @Override
    public Instant occurredAt() {
        return signedAt.toInstant();
    }
}
