package ma.careplus.billing.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.List;

/** Filtered + paginated invoice list with KPI aggregates over the full match. */
public record InvoiceSearchResponse(
        List<InvoiceListRow> items,
        int totalCount,
        int page,
        int size,
        BigDecimal totalNet,
        BigDecimal totalPaid,
        BigDecimal totalRemaining) {}
