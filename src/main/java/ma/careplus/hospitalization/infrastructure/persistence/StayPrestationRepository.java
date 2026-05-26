package ma.careplus.hospitalization.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.domain.StayPrestation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StayPrestationRepository extends JpaRepository<StayPrestation, UUID> {

    /** Toutes les prestations d'un séjour, triées par date de réalisation. */
    List<StayPrestation> findAllByStayIdOrderByPerformedAtAsc(UUID stayId);
}
