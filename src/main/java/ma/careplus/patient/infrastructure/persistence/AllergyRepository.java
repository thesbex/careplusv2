package ma.careplus.patient.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.patient.domain.Allergy;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AllergyRepository extends JpaRepository<Allergy, UUID> {
    List<Allergy> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
