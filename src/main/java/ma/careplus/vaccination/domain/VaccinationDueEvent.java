package ma.careplus.vaccination.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import ma.careplus.shared.event.DomainEvent;

/**
 * Event published when a vaccination dose is due.
 *
 * NOTE: Not published in Étape 2. A scheduled job (cron J-7) will publish
 * this event in Étape 3 (Notifications module). The class is here so that
 * the listener can be registered in Étape 3 without modifying the domain.
 *
 * @param eventId   unique event identifier
 * @param occurredAt when the event was created
 * @param patientId the patient whose dose is due
 * @param doseId    the vaccination_dose row id (if already materialised), or null
 * @param dueAt     the computed target date
 */
public record VaccinationDueEvent(
        UUID eventId,
        Instant occurredAt,
        UUID patientId,
        UUID doseId,
        LocalDate dueAt
) implements DomainEvent {

    /** Convenience factory. */
    public static VaccinationDueEvent of(UUID patientId, UUID doseId, LocalDate dueAt) {
        return new VaccinationDueEvent(UUID.randomUUID(), Instant.now(), patientId, doseId, dueAt);
    }
}
