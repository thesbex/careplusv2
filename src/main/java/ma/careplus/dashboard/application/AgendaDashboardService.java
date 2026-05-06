package ma.careplus.dashboard.application;

import ma.careplus.dashboard.infrastructure.web.dto.AgendaDashboardView;

/**
 * Application service for the agenda part of the F1 Dashboard.
 *
 * <p>Pure read-side aggregate. Computes KPIs from
 * {@code scheduling_appointment}, {@code patient_patient} and
 * {@code scheduling_working_hours} for "today" and "current ISO week" in the
 * cabinet timezone (Africa/Casablanca).
 */
public interface AgendaDashboardService {

    /** Compute the full agenda dashboard payload. */
    AgendaDashboardView getAgendaDashboard();
}
