package ma.careplus.prestation.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record PrestationRequest(
        @NotBlank @Size(max = 32) String code,
        @NotBlank @Size(max = 128) String label,
        @DecimalMin("0.0") BigDecimal defaultPrice,
        Boolean active,
        Integer sortOrder
) {}
