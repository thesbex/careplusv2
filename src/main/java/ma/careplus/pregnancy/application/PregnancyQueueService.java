package ma.careplus.pregnancy.application;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import ma.careplus.pregnancy.application.PregnancyAlertService.PregnancyAlertView;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import org.springframework.security.core.Authentication;

/**
 * Cross-patient pregnancy worklist (Étape 3).
 *
 * <p>Computes on the fly from {@code pregnancy} + {@code patient_patient} join —
 * no dedicated queue table (ADR-026 lazy materialisation pattern).
 */
public interface PregnancyQueueService {

    /**
     * A single row in the worklist.
     *
     * @param saWeeks   gestational age — full weeks at today (0–44)
     * @param saDays    gestational age — days within the current week (0–6); displayed as "Xs+Yj"
     * @param trimester T1 (< 14), T2 (14–27), T3 (≥ 28)
     * @param alerts    active alerts for this pregnancy (empty if none)
     */
    record PregnancyQueueEntry(
            UUID pregnancyId,
            UUID patientId,
            String patientLastName,
            String patientFirstName,
            LocalDate lmpDate,
            LocalDate dueDate,
            int saWeeks,
            int saDays,
            String trimester,
            Instant lastVisitAt,
            List<PregnancyAlertView> alerts
    ) {}

    /**
     * Filters for the worklist query.
     *
     * @param trimester  nullable — T1, T2, T3
     * @param withAlerts nullable — if true, only pregnancies with ≥ 1 alert
     * @param q          nullable — patient last name/first name search (contains, case-insensitive)
     * @param page       0-based page number
     * @param size       page size
     */
    record QueueFilters(
            String trimester,
            Boolean withAlerts,
            String q,
            int page,
            int size
    ) {
        public int resolvedPage() { return Math.max(page, 0); }
        public int resolvedSize() { return (size > 0 && size <= 200) ? size : 20; }
    }

    /**
     * Returns a paginated, SA-descending list of EN_COURS pregnancies.
     *
     * <p>V039 — quand le cloisonnement (V032) est activé et qu'au moins
     * 2 MEDECIN sont actifs, on ne renvoie que les grossesses dont l'un
     * des médecins rattachés (déclaration, visite, écho ou plan de visite)
     * appartient au scope du caller. Les grossesses orphelines (jamais
     * touchées par personne) sont visibles si le rôle du caller appartient
     * à {@code configuration_clinic_settings.pregnancy_orphan_visible_roles}.
     *
     * @param filters filters + pagination; never null
     * @param auth    Spring Security auth — utilisé par {@code AccessScopeService}
     *                pour dériver le set des practitioners visibles. Peut être
     *                null en tests unitaires hors HTTP, dans quel cas le
     *                cloisonnement est bypassé.
     * @return paginated result
     */
    PageView<PregnancyQueueEntry> queue(QueueFilters filters, Authentication auth);
}
