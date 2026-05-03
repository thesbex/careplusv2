package ma.careplus.patient.infrastructure.web.dto;

import java.time.Instant;
import java.util.UUID;

public record PatientNoteResponse(
        UUID id,
        UUID patientId,
        String content,
        String createdByName,
        Instant createdAt
) {}
