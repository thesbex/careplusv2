package ma.careplus.scheduling.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AppointmentView(
        UUID id,
        UUID patientId,
        String patientFullName,
        UUID practitionerId,
        UUID reasonId,
        String reasonLabel,
        String type,
        UUID originConsultationId,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        String status,
        String cancelReason,
        boolean walkIn,
        boolean urgency,
        OffsetDateTime arrivedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
