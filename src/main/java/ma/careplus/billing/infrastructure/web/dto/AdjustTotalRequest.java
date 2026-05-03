package ma.careplus.billing.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AdjustTotalRequest(
        @NotNull @DecimalMin("0") BigDecimal discountAmount
) {}
