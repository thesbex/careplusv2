package ma.careplus.vaccination.application;

import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import ma.careplus.vaccination.infrastructure.web.dto.QueueFilters;
import ma.careplus.vaccination.infrastructure.web.dto.VaccinationQueueEntry;
import org.springframework.security.core.Authentication;

/**
 * Cross-patient vaccination worklist (Étape 3).
 *
 * <p>Computes on the fly — no dedicated queue table. Loads all pediatric
 * patients (age &lt; 18 years, not soft-deleted), materialises their calendar,
 * filters and sorts by urgency descending (OVERDUE first with most days
 * overdue, then DUE_SOON with nearest date, then UPCOMING).
 *
 * <p>V036 — quand le cloisonnement (V032 agenda_strict_isolation) est activé,
 * la queue est filtrée par praticien : un médecin ne voit que les patients
 * qu'il « suit » (au moins une action sur une dose) + les patients orphelins
 * si son rôle est dans la liste vaccination_orphan_visible_roles.
 */
public interface VaccinationQueueService {

    /**
     * Returns a paginated, urgency-sorted list of upcoming/overdue vaccination
     * doses for pediatric patients visible to the caller.
     *
     * <p>Default behaviour (status == null): returns OVERDUE + DUE_SOON only.
     *
     * @param filters pagination + filter parameters; never null
     * @param auth    current authentication, used to resolve the caller's
     *                practitioner scope (V032 strict isolation). May be null
     *                in tests where security is bypassed → treated as
     *                {@code ADMIN} (full access).
     * @return paginated result with total element count
     */
    PageView<VaccinationQueueEntry> queue(QueueFilters filters, Authentication auth);
}
