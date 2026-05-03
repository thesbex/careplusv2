package ma.careplus.catalog.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.domain.PrescriptionLine;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrescriptionLineRepository extends JpaRepository<PrescriptionLine, UUID> {

    List<PrescriptionLine> findByPrescriptionIdOrderBySortOrderAsc(UUID prescriptionId);
}
