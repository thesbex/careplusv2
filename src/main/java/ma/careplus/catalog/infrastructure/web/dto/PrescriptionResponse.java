package ma.careplus.catalog.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PrescriptionResponse(
        UUID id,
        UUID consultationId,
        UUID patientId,
        String type,
        OffsetDateTime issuedAt,
        List<PrescriptionLineResponse> lines,
        boolean allergyOverride
) {}
