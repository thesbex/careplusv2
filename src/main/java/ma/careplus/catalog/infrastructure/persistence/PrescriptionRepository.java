package ma.careplus.catalog.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.domain.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    List<Prescription> findByConsultationIdOrderByIssuedAtDesc(UUID consultationId);

    List<Prescription> findByPatientIdOrderByIssuedAtDesc(UUID patientId);
}
