package ma.careplus.clinical.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.domain.PrescriptionResultValue;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrescriptionResultValueRepository
        extends JpaRepository<PrescriptionResultValue, UUID> {

    List<PrescriptionResultValue> findByPrescriptionLineIdOrderBySortOrderAsc(UUID lineId);

    /** Toutes les valeurs d'un patient triées par date, pour le graphe d'évolution. */
    List<PrescriptionResultValue> findByPatientIdOrderByRecordedAtAsc(UUID patientId);

    void deleteByPrescriptionLineId(UUID lineId);
}
