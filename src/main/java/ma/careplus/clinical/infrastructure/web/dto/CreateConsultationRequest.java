package ma.careplus.clinical.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateConsultationRequest(
        @NotNull UUID patientId,
        UUID appointmentId,
        String motif
) {}
