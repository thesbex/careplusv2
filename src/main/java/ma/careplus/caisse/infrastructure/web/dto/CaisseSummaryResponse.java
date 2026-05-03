package ma.careplus.caisse.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Daily cash register summary. Variante A : aggregated on-the-fly from
 * billing_payment.received_at filtered to the day in Africa/Casablanca TZ.
 * Self-resetting : a new date naturally returns zero rows until payments come in.
 */
public record CaisseSummaryResponse(
        LocalDate date,
        BigDecimal total,
        long count,
        List<CaisseModeAmount> byMode,
        BigDecimal invoicesIssuedTotal,
        long invoicesIssuedCount
) {}
