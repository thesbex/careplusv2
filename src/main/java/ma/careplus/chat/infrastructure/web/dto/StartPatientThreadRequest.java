package ma.careplus.chat.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record StartPatientThreadRequest(
        @NotNull UUID patientId,
        @NotBlank String subject,
        List<UUID> participantIds) {}
