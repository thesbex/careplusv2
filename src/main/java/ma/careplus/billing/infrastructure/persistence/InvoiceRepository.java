package ma.careplus.billing.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.billing.domain.Invoice;
import ma.careplus.billing.domain.InvoiceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID>, JpaSpecificationExecutor<Invoice> {

    Optional<Invoice> findByConsultationId(UUID consultationId);

    List<Invoice> findByStatus(InvoiceStatus status);

    List<Invoice> findByPatientId(UUID patientId);
}
