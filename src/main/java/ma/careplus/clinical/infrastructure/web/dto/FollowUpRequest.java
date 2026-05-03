package ma.careplus.clinical.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Request to schedule a follow-up (CONTROLE) appointment from a signed consultation.
 */
public record FollowUpRequest(
        @NotNull LocalDate date,
        @NotNull LocalTime time,
        UUID reasonId,
        String notes
) {}
