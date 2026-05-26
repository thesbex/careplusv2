package ma.careplus.finance.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request body for POST /api/expenses and PUT /api/expenses/{id}.
 * Validation mirrors the DB CHECK constraints in V058.
 */
public record ExpenseRequest(

        @NotBlank
        @Pattern(
            regexp = "EAU_ELECTRICITE|INTERNET|LOYER|SYNDIC|REPARATION|FOURNITURES|ASSURANCE|IMPOTS|SALAIRE|AUTRE",
            message = "category must be one of: EAU_ELECTRICITE, INTERNET, LOYER, SYNDIC, REPARATION, FOURNITURES, ASSURANCE, IMPOTS, SALAIRE, AUTRE"
        )
        String category,

        @NotBlank
        @Size(max = 255)
        String label,

        @NotNull
        @DecimalMin(value = "0.00", message = "amount must be >= 0")
        BigDecimal amount,

        @NotNull
        LocalDate expenseDate,

        @Pattern(
            regexp = "PONCTUELLE|MENSUELLE|ANNUELLE",
            message = "periodicity must be one of: PONCTUELLE, MENSUELLE, ANNUELLE"
        )
        String periodicity,

        @Size(max = 255)
        String supplier,

        String notes
) {}
