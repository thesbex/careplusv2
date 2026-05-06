package ma.careplus.dashboard.application;

import java.util.UUID;
import ma.careplus.dashboard.infrastructure.web.dto.ClinicalDashboardView;

/**
 * Application service for the clinical part of the F1 Dashboard.
 *
 * <p>Pure read-side aggregate. Aggregates KPIs across {@code patient_patient}
 * and {@code clinical_consultation}. All time windows are evaluated in the
 * cabinet timezone (Africa/Casablanca).
 */
public interface ClinicalDashboardService {

    /**
     * Compute the full clinical dashboard payload for the calling practitioner.
     *
     * @param practitionerId calling user — restricts {@code consultationsAujourdhui/Semaine/Mois}
     * @return populated dashboard view
     */
    ClinicalDashboardView getClinicalDashboard(UUID practitionerId);
}
