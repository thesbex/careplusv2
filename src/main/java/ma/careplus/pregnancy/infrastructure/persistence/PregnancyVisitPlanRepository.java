package ma.careplus.pregnancy.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.pregnancy.domain.PregnancyVisitPlan;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PregnancyVisitPlanRepository extends JpaRepository<PregnancyVisitPlan, UUID> {

    /** Full visit plan for a pregnancy, ordered by target SA ascending. */
    List<PregnancyVisitPlan> findByPregnancyIdOrderByTargetSaWeeks(UUID pregnancyId);

    /** Delete all plan entries for a pregnancy (used on lmpDate change). */
    void deleteByPregnancyId(UUID pregnancyId);
}
