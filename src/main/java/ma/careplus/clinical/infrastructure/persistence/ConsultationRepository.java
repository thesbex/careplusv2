package ma.careplus.clinical.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.clinical.domain.Consultation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultationRepository extends JpaRepository<Consultation, UUID> {
    Optional<Consultation> findByAppointmentId(UUID appointmentId);
    List<Consultation> findByPatientIdOrderByStartedAtDesc(UUID patientId);
    List<Consultation> findByPractitionerIdOrderByStartedAtDesc(UUID practitionerId);
    List<Consultation> findByPractitionerIdAndStartedAtBetweenOrderByStartedAtDesc(
            UUID practitionerId, OffsetDateTime from, OffsetDateTime to);
}
