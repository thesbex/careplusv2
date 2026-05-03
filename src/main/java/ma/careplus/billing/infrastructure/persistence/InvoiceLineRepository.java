package ma.careplus.billing.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.billing.domain.InvoiceLine;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceLineRepository extends JpaRepository<InvoiceLine, UUID> {

    List<InvoiceLine> findByInvoiceIdOrderByPosition(UUID invoiceId);

    void deleteByInvoiceId(UUID invoiceId);
}
