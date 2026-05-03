package ma.careplus.vaccination.application;

import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import ma.careplus.vaccination.infrastructure.web.dto.QueueFilters;
import ma.careplus.vaccination.infrastructure.web.dto.VaccinationQueueEntry;

/**
 * Cross-patient vaccination worklist (Étape 3).
 *
 * <p>Computes on the fly — no dedicated queue table. Loads all pediatric
 * patients (age &lt; 18 years, not soft-deleted), materialises their calendar,
 * filters and sorts by urgency descending (OVERDUE first with most days
 * overdue, then DUE_SOON with nearest date, then UPCOMING).
 */
public interface VaccinationQueueService {

    /**
     * Returns a paginated, urgency-sorted list of upcoming/overdue vaccination
     * doses for all pediatric patients matching the given filters.
     *
     * <p>Default behaviour (status == null): returns OVERDUE + DUE_SOON only.
     *
     * @param filters pagination + filter parameters; never null
     * @return paginated result with total element count
     */
    PageView<VaccinationQueueEntry> queue(QueueFilters filters);
}
