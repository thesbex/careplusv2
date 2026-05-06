package ma.careplus.dashboard.infrastructure.web.dto;

import java.util.List;

/**
 * Agenda KPIs for the F1 Dashboard.
 *
 * <p>Counters cover scheduling activity (RDV today / week, no-shows,
 * annulations) plus a slot-by-slot histogram for charge horaire and a
 * monthly counter of new patients.
 */
public record AgendaDashboardView(
        long rdvAujourdhui,
        long rdvSemaine,
        double tauxRemplissageJour,
        double tauxRemplissageSemaine,
        long noShowsSemaine,
        long annulationsSemaine,
        long nouveauxPatientsMois,
        List<HourlyLoad> chargeHoraire) {

    /**
     * Hourly bucket for the histogram.
     *   slotStart : "HH:mm" (e.g. "08:00")
     *   count     : number of non-cancelled appointments starting in [slotStart, slotStart+1h)
     */
    public record HourlyLoad(String slotStart, long count) {}
}
