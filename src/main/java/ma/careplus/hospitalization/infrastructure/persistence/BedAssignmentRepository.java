package ma.careplus.hospitalization.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.hospitalization.domain.BedAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BedAssignmentRepository extends JpaRepository<BedAssignment, UUID> {

    /** Affectation courante d'un lit (to_at IS NULL) — sert au calcul d'occupation. */
    Optional<BedAssignment> findByBedIdAndToAtIsNull(UUID bedId);

    /** Affectation courante d'un séjour. */
    Optional<BedAssignment> findByStayIdAndToAtIsNull(UUID stayId);

    /** Toutes les affectations d'un séjour (historique ADT + calcul des journées). */
    List<BedAssignment> findAllByStayIdOrderByFromAtAsc(UUID stayId);

    /** Toutes les affectations courantes (board occupancy). */
    List<BedAssignment> findAllByToAtIsNull();
}
