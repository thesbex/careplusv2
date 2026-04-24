package ma.careplus.patient.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.patient.domain.Antecedent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AntecedentRepository extends JpaRepository<Antecedent, UUID> {
    List<Antecedent> findByPatientIdOrderByOccurredOnDescCreatedAtDesc(UUID patientId);
}
