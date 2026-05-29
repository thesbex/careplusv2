package ma.careplus.finance.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Read-model returned by GET /api/expenses and POST/PUT /api/expenses.
 *
 * <p>{@code source} distingue les charges saisies manuellement ({@code MANUAL})
 * des lignes virtuelles agrégées depuis le module RH ({@code HR}, paiements de
 * salaire). Les lignes {@code HR} sont en lecture seule côté Charges : elles se
 * gèrent dans la page Personnel.
 */
public record ExpenseResponse(
        UUID            id,
        String          category,
        String          label,
        BigDecimal      amount,
        LocalDate       expenseDate,
        String          periodicity,
        String          supplier,
        String          notes,
        OffsetDateTime  createdAt,
        OffsetDateTime  updatedAt,
        String          source
) {}
