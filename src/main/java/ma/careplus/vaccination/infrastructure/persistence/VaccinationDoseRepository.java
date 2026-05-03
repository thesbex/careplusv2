package ma.careplus.vaccination.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccinationDose;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VaccinationDoseRepository extends JpaRepository<VaccinationDose, UUID> {

    List<VaccinationDose> findByPatientIdAndDeletedAtIsNull(UUID patientId);

    List<VaccinationDose> findByPatientIdAndVaccineIdAndDeletedAtIsNull(UUID patientId, UUID vaccineId);

    boolean existsByPatientIdAndVaccineIdAndDoseNumberAndDeletedAtIsNull(
            UUID patientId, UUID vaccineId, short doseNumber);
}
