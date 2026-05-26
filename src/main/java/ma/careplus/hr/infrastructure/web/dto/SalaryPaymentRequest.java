package ma.careplus.hr.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request body for POST /api/hr/staff/{id}/payments.
 */
public record SalaryPaymentRequest(

        @NotBlank
        @Pattern(
            regexp = "\\d{4}-\\d{2}",
            message = "period must be in YYYY-MM format"
        )
        String period,

        @NotNull
        @DecimalMin(value = "0.00", message = "amount must be >= 0")
        BigDecimal amount,

        @NotNull
        LocalDate paidAt,

        String notes
) {}
