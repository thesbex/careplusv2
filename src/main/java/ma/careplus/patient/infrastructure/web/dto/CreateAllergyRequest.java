package ma.careplus.patient.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateAllergyRequest(
        @NotBlank @Size(max = 255) String substance,
        @Size(max = 64) String atcTag,
        @Pattern(regexp = "LEGERE|MODEREE|SEVERE") String severity,
        String notes
) {}
