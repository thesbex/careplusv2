package ma.careplus.dashboard.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Financial KPIs for the F1 Dashboard (CA + impayés + breakdown par acte).
 *
 * <p>Aggregates derived exclusively from {@code billing_invoice} +
 * {@code billing_invoice_line} (cross-module read) using the cabinet timezone
 * (Africa/Casablanca) for window boundaries.
 *
 * <p>Convention: « CA encaissé » = SUM(invoice.total) WHERE
 * status IN (PAYEE_TOTALE, PAYEE_PARTIELLE) — c.f. spec « ENCAISSEE /
 * PARTIELLEMENT_ENCAISSEE ».
 */
public record FinancialDashboardView(
        BigDecimal caJour,
        BigDecimal caMois,
        BigDecimal caYTD,
        BigDecimal caMoisN1,
        List<MonthAmount> ca12Mois,
        List<ActeBreakdown> caParActe,
        BigDecimal impayesTotal,
        long impayesCount,
        BigDecimal tauxEncaissement) {

    /** One bucket for the 12-month CA timeline. {@code month} = "YYYY-MM". */
    public record MonthAmount(String month, BigDecimal amount) {}

    /** One row of the CA breakdown by acte. {@code count} = number of lines. */
    public record ActeBreakdown(
            String acteCode,
            String label,
            BigDecimal amount,
            long count) {}
}
