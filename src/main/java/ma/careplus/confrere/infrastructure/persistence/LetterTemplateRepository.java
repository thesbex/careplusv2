package ma.careplus.confrere.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.confrere.domain.LetterTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LetterTemplateRepository extends JpaRepository<LetterTemplate, UUID> {

    /**
     * Liste tous les modèles non supprimés (actifs + inactifs) pour l'ADMIN
     * et la liste restreinte aux actifs pour le MEDECIN — le filtrage de
     * {@code active} est laissé au service.
     */
    @Query("""
            SELECT t FROM LetterTemplate t
             WHERE t.deletedAt IS NULL
             ORDER BY t.title ASC
            """)
    List<LetterTemplate> findAllActive();

    /**
     * Même liste mais limitée aux modèles activés (pour les médecins).
     */
    @Query("""
            SELECT t FROM LetterTemplate t
             WHERE t.deletedAt IS NULL
               AND t.active = TRUE
             ORDER BY t.title ASC
            """)
    List<LetterTemplate> findActiveOnly();

    /**
     * V065 — Liste limitée aux modèles visibles pour un médecin donné :
     * partagés (owner_user_id IS NULL) + ses modèles privés (owner_user_id = ?).
     * Toujours actifs et non-supprimés. Utilisé par le dialog ConfrereLetter
     * pour ne montrer au médecin que ce qui le concerne.
     */
    @Query("""
            SELECT t FROM LetterTemplate t
             WHERE t.deletedAt IS NULL
               AND t.active = TRUE
               AND (t.ownerUserId IS NULL OR t.ownerUserId = :userId)
             ORDER BY t.ownerUserId NULLS LAST, t.title ASC
            """)
    List<LetterTemplate> findVisibleForUser(@Param("userId") UUID userId);

    @Query("""
            SELECT t FROM LetterTemplate t
             WHERE t.id = :id
               AND t.deletedAt IS NULL
            """)
    Optional<LetterTemplate> findActiveById(@Param("id") UUID id);
}
