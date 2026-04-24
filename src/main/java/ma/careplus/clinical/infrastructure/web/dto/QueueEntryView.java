package ma.careplus.clinical.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row in the salle d'attente queue — merges an appointment + its patient
 * into a shape the Salle screen can render directly.
 */
public record QueueEntryView(
        UUID appointmentId,
        UUID patientId,
        String patientFullName,
        OffsetDateTime scheduledAt,
        String status,
        OffsetDateTime arrivedAt,
        boolean hasAllergies
) {}
