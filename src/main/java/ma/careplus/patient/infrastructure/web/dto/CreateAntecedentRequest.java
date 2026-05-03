package ma.careplus.patient.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import ma.careplus.patient.domain.AntecedentCategory;

public record CreateAntecedentRequest(
        @NotBlank @Pattern(regexp = "MEDICAL|CHIRURGICAL|FAMILIAL|GYNECO_OBSTETRIQUE|HABITUS") String type,
        @NotBlank @Size(max = 512) String description,
        LocalDate occurredOn,
        AntecedentCategory category
) {}
