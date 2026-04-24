package ma.careplus.billing.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record InvoiceLineRequest(
        UUID actId,
        @NotBlank String description,
        @NotNull @DecimalMin("0.01") BigDecimal unitPrice,
        @DecimalMin("0.01") BigDecimal quantity
) {}
