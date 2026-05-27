package ma.careplus.scheduling.domain;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.shared.event.DomainEvent;

/**
 * Émis à la création d'un rendez-vous. Le module notification l'écoute
 * (AFTER_COMMIT) pour composer une confirmation patient. Délivré via
 * {@code ApplicationEventPublisher} + {@code @TransactionalEventListener} —
 * jamais d'appel cross-module direct (cf. ARCHITECTURE.md).
 */
public record AppointmentCreatedEvent(
        UUID eventId,
        UUID appointmentId,
        UUID patientId,
        UUID practitionerId,
        UUID reasonId,
        OffsetDateTime startAt,
        OffsetDateTime createdAt
) implements DomainEvent {

    public static AppointmentCreatedEvent of(
            UUID appointmentId, UUID patientId, UUID practitionerId,
            UUID reasonId, OffsetDateTime startAt) {
        return new AppointmentCreatedEvent(
                UUID.randomUUID(), appointmentId, patientId, practitionerId,
                reasonId, startAt, OffsetDateTime.now());
    }

    @Override
    public Instant occurredAt() {
        return createdAt.toInstant();
    }
}
