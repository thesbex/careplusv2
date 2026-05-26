package ma.careplus.consent.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.consent.domain.ConsentTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsentTemplateRepository extends JpaRepository<ConsentTemplate, UUID> {

    /**
     * Liste tous les modèles non supprimés (actifs + inactifs) pour l'ADMIN
     * et la liste restreinte aux actifs pour le MEDECIN — le filtrage de
     * {@code active} est laissé au service.
     */
    @Query("""
            SELECT t FROM ConsentTemplate t
             WHERE t.deletedAt IS NULL
             ORDER BY t.type ASC, t.title ASC
            """)
    List<ConsentTemplate> findAllActive();

    /**
     * Même liste mais limitée aux modèles activés (pour les médecins).
     */
    @Query("""
            SELECT t FROM ConsentTemplate t
             WHERE t.deletedAt IS NULL
               AND t.active = TRUE
             ORDER BY t.type ASC, t.title ASC
            """)
    List<ConsentTemplate> findActiveOnly();

    @Query("""
            SELECT t FROM ConsentTemplate t
             WHERE t.id = :id
               AND t.deletedAt IS NULL
            """)
    Optional<ConsentTemplate> findActiveById(@Param("id") UUID id);
}
