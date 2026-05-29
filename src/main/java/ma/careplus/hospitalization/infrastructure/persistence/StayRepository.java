package ma.careplus.hospitalization.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.hospitalization.domain.Stay;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StayRepository extends JpaRepository<Stay, UUID> {

    Optional<Stay> findByIdAndDeletedAtIsNull(UUID id);

    /** Worklist : séjours actifs (en cours d'hospitalisation), plus récent en premier. */
    List<Stay> findAllByStatusAndDeletedAtIsNullOrderByAdmittedAtDesc(String status);

    /** Liste par statuts (historique : SORTI/FACTURE/ANNULE, ou tous), plus récent en premier. */
    List<Stay> findAllByStatusInAndDeletedAtIsNullOrderByAdmittedAtDesc(Collection<String> statuses);

    List<Stay> findAllByPatientIdAndDeletedAtIsNullOrderByAdmittedAtDesc(UUID patientId);

    long countByStatusAndDeletedAtIsNull(String status);

    boolean existsByPatientIdAndStatusAndDeletedAtIsNull(UUID patientId, String status);
}
