package ma.careplus.scheduling.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Projection of a conflicting appointment in the same room.
 * Returned by GET /api/appointments/{id}/room-conflicts.
 * This is a warning signal only — never blocks the caller.
 */
public record RoomConflictView(
        UUID conflictAppointmentId,
        String conflictPatientLastName,
        String conflictPatientFirstName,
        OffsetDateTime conflictStartAt,
        OffsetDateTime conflictEndAt,
        UUID conflictPractitionerId,
        String conflictPractitionerLastName,
        String conflictPractitionerFirstName
) {}
