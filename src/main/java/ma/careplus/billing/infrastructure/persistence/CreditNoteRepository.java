package ma.careplus.billing.infrastructure.persistence;

import java.util.UUID;
import ma.careplus.billing.domain.CreditNote;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditNoteRepository extends JpaRepository<CreditNote, UUID> {
}
