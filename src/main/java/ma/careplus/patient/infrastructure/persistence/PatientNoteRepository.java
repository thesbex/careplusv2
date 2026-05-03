package ma.careplus.patient.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.patient.domain.PatientNote;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientNoteRepository extends JpaRepository<PatientNote, UUID> {
    List<PatientNote> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
