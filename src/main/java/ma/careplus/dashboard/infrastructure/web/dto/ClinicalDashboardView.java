package ma.careplus.dashboard.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Clinical KPI payload for the F1 Dashboard.
 *
 * <p>All counts are restricted to the calling practitioner where it makes sense
 * (today / week / month consultations). Patient-level KPIs (active count,
 * average age, top diagnoses, daily activity) are cabinet-wide read-models.
 *
 * @param patientsActifsTotal      Active patients (deleted_at IS NULL).
 * @param patientsActifs30j        Patients with at least one signed consultation in the last 30 days.
 * @param consultationsAujourdhui  Consultations signed today by the calling practitioner (Africa/Casablanca TZ).
 * @param consultationsSemaine     Consultations signed this ISO week (Mon → Sun) by the calling practitioner.
 * @param consultationsMois        Consultations signed this calendar month by the calling practitioner.
 * @param ageMoyenPatientele       Mean age in years across active patients with a known birth_date. {@code null} if none.
 * @param topPathologies           Top 5 ICD-10-shaped codes parsed out of the diagnosis free-text, ordered by count desc.
 * @param activite7j               Daily signed-consultation count over the last 7 days, oldest first, missing days zero-filled.
 * @param activite30j              Daily signed-consultation count over the last 30 days, oldest first, missing days zero-filled.
 */
public record ClinicalDashboardView(
        long patientsActifsTotal,
        long patientsActifs30j,
        long consultationsAujourdhui,
        long consultationsSemaine,
        long consultationsMois,
        Double ageMoyenPatientele,
        List<TopPathology> topPathologies,
        List<ActivityPoint> activite7j,
        List<ActivityPoint> activite30j) {

    /** Top diagnosis bucket. label falls back to {@code code} when no catalog is available. */
    public record TopPathology(String code, String label, long count) {}

    /** Daily activity datapoint (signed consultations). */
    public record ActivityPoint(LocalDate date, long count) {}
}
