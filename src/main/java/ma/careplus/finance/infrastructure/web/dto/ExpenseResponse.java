package ma.careplus.finance.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Read-model returned by GET /api/expenses and POST/PUT /api/expenses.
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
        OffsetDateTime  updatedAt
) {}
