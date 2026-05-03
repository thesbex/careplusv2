package ma.careplus.pregnancy.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PregnancyVisitRepository extends JpaRepository<PregnancyVisit, UUID> {

    /** Paginated list of visits for a pregnancy, most-recent first. */
    Page<PregnancyVisit> findByPregnancyIdOrderByRecordedAtDesc(UUID pregnancyId, Pageable pageable);

    /** Returns the single most-recent visit for a pregnancy (used in Étape 3 alert queries). */
    Optional<PregnancyVisit> findFirstByPregnancyIdOrderByRecordedAtDesc(UUID pregnancyId);
}
