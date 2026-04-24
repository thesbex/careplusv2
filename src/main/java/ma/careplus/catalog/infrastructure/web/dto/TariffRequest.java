package ma.careplus.catalog.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TariffRequest(
        @NotBlank String tier,
        @NotNull @DecimalMin("0.00") BigDecimal amount,
        @NotNull LocalDate effectiveFrom
) {}
