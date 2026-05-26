package ma.careplus.hr.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Request body for POST /api/hr/staff and PUT /api/hr/staff/{id}.
 * Validation mirrors the DB CHECK constraints in V061.
 */
public record StaffRequest(

        @NotBlank
        @Size(max = 255)
        String fullName,

        @NotBlank
        @Pattern(
            regexp = "SECURITE|MENAGE|INFIRMIER|SECRETAIRE|ASSISTANTE|TECHNICIEN|AUTRE",
            message = "role must be one of: SECURITE, MENAGE, INFIRMIER, SECRETAIRE, ASSISTANTE, TECHNICIEN, AUTRE"
        )
        String role,

        @NotNull
        LocalDate hireDate,

        @DecimalMin(value = "0.00", message = "monthlySalary must be >= 0")
        BigDecimal monthlySalary,

        @Size(max = 32)
        String phone,

        UUID userId,

        Boolean active,

        String notes
) {}
