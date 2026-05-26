package ma.careplus.hr.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request body for POST /api/hr/staff/{id}/leave.
 */
public record LeaveEntryRequest(

        @NotBlank
        @Pattern(
            regexp = "CONGE|ABSENCE|RETARD",
            message = "type must be one of: CONGE, ABSENCE, RETARD"
        )
        String type,

        @NotNull
        LocalDate startDate,

        @DecimalMin(value = "0.00", message = "days must be >= 0")
        BigDecimal days,

        String notes
) {}
