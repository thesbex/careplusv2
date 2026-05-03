package ma.careplus.identity.infrastructure.persistence;

import java.util.UUID;
import ma.careplus.identity.domain.AuditLogEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, UUID> {
    // Append-only. No custom queries needed in MVP.
}
