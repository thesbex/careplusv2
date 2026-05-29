package ma.careplus.scheduling.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;

/** Corps PUT pour définir la pause déjeuner d'un médecin (heures "HH:mm"). */
public record LunchBreakRequest(
        @NotBlank String startTime,
        @NotBlank String endTime) {}
