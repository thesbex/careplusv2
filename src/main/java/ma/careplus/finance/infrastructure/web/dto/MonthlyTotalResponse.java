package ma.careplus.finance.infrastructure.web.dto;

import java.math.BigDecimal;

/**
 * One entry in the GET /api/expenses/summary?year= response.
 * month is 1-12.
 */
public record MonthlyTotalResponse(int month, BigDecimal total) {}
