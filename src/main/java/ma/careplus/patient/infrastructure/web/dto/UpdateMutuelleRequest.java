package ma.careplus.patient.infrastructure.web.dto;

import java.util.UUID;

public record UpdateMutuelleRequest(
        UUID insuranceId,
        String policyNumber
) {}
