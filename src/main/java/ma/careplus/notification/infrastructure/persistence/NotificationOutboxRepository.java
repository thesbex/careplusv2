package ma.careplus.notification.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.notification.domain.NotificationOutbox;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, UUID> {

    boolean existsByDedupeKey(String dedupeKey);

    Optional<NotificationOutbox> findByDedupeKey(String dedupeKey);

    /** File des envois à (re)tenter : PENDING ou FAILED sous le plafond d'essais. */
    @Query("""
            SELECT o FROM NotificationOutbox o
             WHERE o.status IN ('PENDING', 'FAILED')
               AND o.attempts < :maxAttempts
             ORDER BY o.createdAt ASC
            """)
    List<NotificationOutbox> findRetryable(@Param("maxAttempts") int maxAttempts);
}
