package ma.careplus.pregnancy.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PregnancyRepository extends JpaRepository<Pregnancy, UUID> {

    /** All pregnancies for a patient, ordered most-recent first. */
    List<Pregnancy> findByPatientIdOrderByStartedAtDesc(UUID patientId);

    /** Pregnancies filtered by patient and status. */
    List<Pregnancy> findByPatientIdAndStatus(UUID patientId, PregnancyStatus status);

    /** Guard for duplicate active pregnancy at declaration. */
    boolean existsByPatientIdAndStatus(UUID patientId, PregnancyStatus status);

    /** Convenience: returns the unique active pregnancy for a patient (at most 1 EN_COURS enforced at service layer). */
    Optional<Pregnancy> findFirstByPatientIdAndStatus(UUID patientId, PregnancyStatus status);

    /** All pregnancies with a given status — used by alert service for countActiveAlerts batch. */
    List<Pregnancy> findByStatus(PregnancyStatus status);
}
