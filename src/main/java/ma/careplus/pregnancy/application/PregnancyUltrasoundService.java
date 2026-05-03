package ma.careplus.pregnancy.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.pregnancy.domain.PregnancyUltrasound;
import ma.careplus.pregnancy.infrastructure.web.dto.RecordUltrasoundRequest;

/**
 * Public API for obstetric ultrasound recording — Étape 2 scope.
 *
 * <ul>
 *   <li>{@link #record} — saisir un examen écho.</li>
 *   <li>{@link #listByPregnancy} — liste des échos par grossesse.</li>
 * </ul>
 */
public interface PregnancyUltrasoundService {

    /**
     * Record an ultrasound exam for a pregnancy.
     *
     * <p>Validations:
     * <ul>
     *   <li>{@code saWeeksAtExam >= 6} → 422 SA_TOO_EARLY.</li>
     *   <li>Pregnancy must exist (any status — ultrasounds can be recorded retroactively).</li>
     * </ul>
     *
     * <p>Side-effects when {@code correctsDueDate == true} AND {@code kind == T1_DATATION}:
     * <ul>
     *   <li>Extracts {@code eg} (estimated gestational age in days) from
     *       {@code body.biometryJson} if present; otherwise computes
     *       {@code eg = saWeeksAtExam * 7 + saDaysAtExam}.</li>
     *   <li>Sets {@code pregnancy.dueDate = performedAt.plusDays(280 - eg)}.</li>
     *   <li>Sets {@code pregnancy.dueDateSource = ECHO_T1}.</li>
     *   <li>Calls {@link PregnancyService#recomputePlanVisites(UUID)} to regenerate
     *       the 8-entry visit plan with the corrected due date.</li>
     * </ul>
     *
     * @param pregnancyId  target pregnancy
     * @param body         ultrasound data
     * @param actorUserId  authenticated user
     * @return persisted PregnancyUltrasound
     */
    PregnancyUltrasound record(UUID pregnancyId, RecordUltrasoundRequest body, UUID actorUserId);

    /**
     * Returns all ultrasounds for a pregnancy, ordered by examination date ascending.
     */
    List<PregnancyUltrasound> listByPregnancy(UUID pregnancyId);
}
