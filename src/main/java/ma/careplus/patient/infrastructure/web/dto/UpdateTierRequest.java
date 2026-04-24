package ma.careplus.patient.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateTierRequest(
        @NotBlank @Pattern(regexp = "NORMAL|PREMIUM") String tier
) {}
