package ma.careplus.notification.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.notification.domain.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, UUID> {

    /** Modèle actif pour un (event_key, channel) donné — null si aucun. */
    @Query("""
            SELECT t FROM NotificationTemplate t
             WHERE t.eventKey = :eventKey
               AND t.channel = :channel
               AND t.active = TRUE
               AND t.deletedAt IS NULL
             ORDER BY t.updatedAt DESC
            """)
    List<NotificationTemplate> findActive(@Param("eventKey") String eventKey,
                                          @Param("channel") String channel);

    /** Liste de gestion : tout (actifs + inactifs) non supprimé pour l'ADMIN. */
    @Query("""
            SELECT t FROM NotificationTemplate t
             WHERE t.deletedAt IS NULL
             ORDER BY t.eventKey ASC, t.channel ASC
            """)
    List<NotificationTemplate> findAllManaged();

    @Query("""
            SELECT t FROM NotificationTemplate t
             WHERE t.id = :id AND t.deletedAt IS NULL
            """)
    Optional<NotificationTemplate> findActiveById(@Param("id") UUID id);
}
