package ma.careplus.pregnancy.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.pregnancy.domain.PregnancyUltrasound;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PregnancyUltrasoundRepository extends JpaRepository<PregnancyUltrasound, UUID> {

    /** All ultrasounds for a pregnancy, ordered by examination date ascending. */
    List<PregnancyUltrasound> findByPregnancyIdOrderByPerformedAt(UUID pregnancyId);
}
