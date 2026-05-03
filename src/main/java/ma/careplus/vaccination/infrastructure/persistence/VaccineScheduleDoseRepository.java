package ma.careplus.vaccination.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccineScheduleDose;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VaccineScheduleDoseRepository extends JpaRepository<VaccineScheduleDose, UUID> {

    List<VaccineScheduleDose> findAllByOrderByTargetAgeDaysAsc();

    List<VaccineScheduleDose> findByVaccineIdOrderByDoseNumberAsc(UUID vaccineId);

    boolean existsByVaccineIdAndDoseNumber(UUID vaccineId, short doseNumber);
}
