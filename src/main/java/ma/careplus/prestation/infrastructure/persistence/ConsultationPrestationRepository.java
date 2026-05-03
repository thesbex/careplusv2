package ma.careplus.prestation.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.prestation.domain.ConsultationPrestation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultationPrestationRepository extends JpaRepository<ConsultationPrestation, UUID> {

    List<ConsultationPrestation> findByConsultationIdOrderByCreatedAtAsc(UUID consultationId);

    void deleteByConsultationId(UUID consultationId);
}
