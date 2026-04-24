package ma.careplus.catalog.infrastructure.web.dto;

import java.util.UUID;

public record MedicationResponse(
        UUID id,
        String name,
        String molecule,
        String form,
        String strength
) {}
