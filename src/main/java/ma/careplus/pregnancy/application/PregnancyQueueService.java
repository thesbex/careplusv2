package ma.careplus.pregnancy.application;

import java.time.LocalDate;
import java.time.Instant;
import java.util.UUID;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;

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
     * @param saWeeks   gestational age in weeks at today
     * @param trimester T1 (< 14), T2 (14–27), T3 (≥ 28)
     * @param alertCount number of active alerts for this pregnancy (0 if none)
     */
    record PregnancyQueueEntry(
            UUID pregnancyId,
            UUID patientId,
            String patientLastName,
            String patientFirstName,
            LocalDate lmpDate,
            LocalDate dueDate,
            int saWeeks,
            String trimester,
            Instant lastVisitAt,
            int alertCount
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
     * @param filters filters + pagination; never null
     * @return paginated result
     */
    PageView<PregnancyQueueEntry> queue(QueueFilters filters);
}
