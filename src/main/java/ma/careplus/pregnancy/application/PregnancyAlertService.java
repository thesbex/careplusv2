package ma.careplus.pregnancy.application;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Computes obstetric alert rules at query time — no persistence.
 *
 * <p>Seven hardcoded rules per the design doc (ADR-026 lazy materialisation pattern,
 * consistent with Stock/Vaccination alert services).
 *
 * <p>All operations are read-only. No table {@code pregnancy_alert} is needed:
 * alerts are recomputed from existing {@code pregnancy_visit} rows every time they
 * are requested, preventing drift.
 */
public interface PregnancyAlertService {

    /**
     * A single computed alert for a pregnancy.
     *
     * @param code     machine code (e.g. "HTA_GRAVIDIQUE")
     * @param label    human-readable French label
     * @param severity INFO | WARN | CRITICAL
     * @param since    timestamp of the triggering event (recordedAt of the last relevant visit,
     *                 or the pregnancy createdAt when no visit exists)
     */
    record PregnancyAlertView(String code, String label, String severity, Instant since) {}

    /**
     * Evaluates the 7 alert rules for a single pregnancy.
     *
     * @param pregnancyId target pregnancy (must exist)
     * @return list of active alerts (0–7 items), never null
     */
    List<PregnancyAlertView> queryAlertsForPregnancy(UUID pregnancyId);

    /**
     * Total count of EN_COURS pregnancies that have at least one active alert.
     * Used by the sidebar badge (polling every 30 s).
     *
     * @return number of pregnancies with ≥ 1 alert, not the total alert count
     */
    int countActiveAlerts();

    /**
     * Alert count per pregnancy for a batch of ids.
     * Used by the queue service to mark rows that have alerts without N² calls.
     *
     * @param pregnancyIds ids to evaluate
     * @return map pregnancyId → alert count (keys may be absent if count = 0)
     */
    Map<UUID, Integer> countByPregnancy(Collection<UUID> pregnancyIds);
}
