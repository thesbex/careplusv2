package ma.careplus.clinical.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.domain.VitalSigns;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VitalSignsRepository extends JpaRepository<VitalSigns, UUID> {
    List<VitalSigns> findByPatientIdOrderByRecordedAtDesc(UUID patientId);
    List<VitalSigns> findByAppointmentIdOrderByRecordedAtDesc(UUID appointmentId);
}
