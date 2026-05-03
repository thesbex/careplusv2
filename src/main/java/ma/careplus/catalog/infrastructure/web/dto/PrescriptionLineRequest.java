package ma.careplus.catalog.infrastructure.web.dto;

import java.util.UUID;

public record PrescriptionLineRequest(
        UUID medicationId,
        UUID labTestId,
        UUID imagingExamId,
        String freeText,
        String dosage,
        String frequency,
        String duration,
        String route,
        String timing,
        Integer quantity,
        String instructions
) {}
