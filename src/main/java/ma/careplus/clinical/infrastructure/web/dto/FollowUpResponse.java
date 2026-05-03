package ma.careplus.clinical.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response after scheduling a follow-up (CONTROLE) appointment.
 */
public record FollowUpResponse(
        UUID appointmentId,
        UUID patientId,
        UUID originConsultationId,
        String type,
        OffsetDateTime startAt,
        OffsetDateTime endAt
) {}
