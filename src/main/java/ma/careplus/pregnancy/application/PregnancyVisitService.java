package ma.careplus.pregnancy.application;

import java.util.UUID;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import ma.careplus.pregnancy.infrastructure.web.dto.RecordVisitRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.UpdateVisitRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Public API for obstetric visit recording — Étape 2 scope.
 *
 * <ul>
 *   <li>{@link #record} — saisie biométrique liée à une grossesse active.</li>
 *   <li>{@link #update} — correction d'une visite avant signature de la consultation.</li>
 *   <li>{@link #listByPregnancy} — liste paginée des visites.</li>
 * </ul>
 */
public interface PregnancyVisitService {

    /**
     * Record obstetric biometry for an active pregnancy.
     *
     * <p>Validations:
     * <ul>
     *   <li>Pregnancy must exist and be EN_COURS → 422 PREGNANCY_NOT_ACTIVE.</li>
     *   <li>Vital sign ranges (TA 60-220 / 30-140, weight 30-180, BCF 100-200, HU 5-50)
     *       → 422 VITALS_OUT_OF_RANGE (also enforced by bean validation on DTO).</li>
     * </ul>
     *
     * <p>Side-effects:
     * <ul>
     *   <li>Computes {@code saWeeks} + {@code saDays} from
     *       {@code (now() - pregnancy.lmpDate)}.</li>
     *   <li>If {@code body.appointmentId} matches a PLANIFIEE visit plan within
     *       tolerance ({@code |targetDate - today| <= toleranceDays}), links
     *       {@code visitPlanId} and marks the plan HONOREE.</li>
     * </ul>
     *
     * @param pregnancyId  target pregnancy
     * @param body         visit biometry
     * @param actorUserId  authenticated user (stored as recordedBy + createdBy)
     * @return persisted PregnancyVisit
     */
    PregnancyVisit record(UUID pregnancyId, RecordVisitRequest body, UUID actorUserId);

    /**
     * Update a visit record.
     *
     * <p>Only non-null fields are applied (patch semantics).
     * Rejected with 422 CONSULTATION_SIGNED if the linked consultation
     * ({@code visit.consultationId}) is in SIGNEE status.
     *
     * @param visitId      target visit id
     * @param body         partial update (null fields are ignored)
     * @param actorUserId  actor
     * @return updated PregnancyVisit
     */
    PregnancyVisit update(UUID visitId, UpdateVisitRequest body, UUID actorUserId);

    /**
     * Returns a paginated list of visits for a pregnancy, most-recent first.
     */
    Page<PregnancyVisit> listByPregnancy(UUID pregnancyId, Pageable pageable);
}
