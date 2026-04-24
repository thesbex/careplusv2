package ma.careplus.patient.infrastructure.web.dto;

import java.util.UUID;

public record AllergyView(
        UUID id,
        String substance,
        String atcTag,
        String severity,
        String notes
) {}
