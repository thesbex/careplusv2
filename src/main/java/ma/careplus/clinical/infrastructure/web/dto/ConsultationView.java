package ma.careplus.clinical.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ConsultationView(
        UUID id,
        UUID patientId,
        UUID practitionerId,
        UUID appointmentId,
        int versionNumber,
        String status,
        String motif,
        String examination,
        String diagnosis,
        String notes,
        OffsetDateTime startedAt,
        OffsetDateTime signedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
