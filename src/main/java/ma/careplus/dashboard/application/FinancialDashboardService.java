package ma.careplus.dashboard.application;

import ma.careplus.dashboard.infrastructure.web.dto.FinancialDashboardView;

/**
 * Application service for the financial part of the F1 Dashboard.
 *
 * <p>Pure read-side aggregate (no writes). Computes CA (chiffre d'affaires)
 * KPIs from {@code billing_invoice} and {@code billing_invoice_line} for the
 * current day / month / YTD windows in the cabinet timezone
 * (Africa/Casablanca), plus impayés and a breakdown par acte.
 */
public interface FinancialDashboardService {

    /** Compute the full financial dashboard payload. */
    FinancialDashboardView getFinancialDashboard();
}
