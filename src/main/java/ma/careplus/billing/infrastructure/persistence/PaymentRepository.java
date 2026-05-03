package ma.careplus.billing.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.billing.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByInvoiceIdOrderByReceivedAtDesc(UUID invoiceId);
}
