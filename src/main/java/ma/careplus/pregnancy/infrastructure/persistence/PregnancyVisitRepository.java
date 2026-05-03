package ma.careplus.pregnancy.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PregnancyVisitRepository extends JpaRepository<PregnancyVisit, UUID> {

    /** Paginated list of visits for a pregnancy, most-recent first. */
    Page<PregnancyVisit> findByPregnancyIdOrderByRecordedAtDesc(UUID pregnancyId, Pageable pageable);

    /** Returns the single most-recent visit for a pregnancy (used in Étape 3 alert queries). */
    Optional<PregnancyVisit> findFirstByPregnancyIdOrderByRecordedAtDesc(UUID pregnancyId);

    /**
     * Counts visits recorded after the given cutoff (used for NO_VISIT_T3 alert rule).
     * A non-zero result means the patient had at least one visit in the recent window.
     */
    @Query("SELECT COUNT(v) FROM PregnancyVisit v WHERE v.pregnancyId = :pregnancyId AND v.recordedAt >= :after")
    long countByPregnancyIdAndRecordedAtAfter(@Param("pregnancyId") UUID pregnancyId,
                                               @Param("after") OffsetDateTime after);
}
