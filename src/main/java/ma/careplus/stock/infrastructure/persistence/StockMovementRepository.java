package ma.careplus.stock.infrastructure.persistence;

import java.util.UUID;
import ma.careplus.stock.domain.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    boolean existsByArticleId(UUID articleId);

    /**
     * Compute current quantity for articles that do NOT track lots.
     * IN adds, OUT subtracts, ADJUSTMENT: handled separately (net delta stored as quantity with type).
     * For simplicity Étape 1: quantity from movements is not yet used (returns 0 as placeholder).
     * Étape 2 will use this for non-lot articles.
     */
    @Query("""
            SELECT COALESCE(SUM(CASE
                WHEN m.type = ma.careplus.stock.domain.StockMovementType.IN  THEN  m.quantity
                WHEN m.type = ma.careplus.stock.domain.StockMovementType.OUT THEN -m.quantity
                ELSE 0
            END), 0)
            FROM StockMovement m
            WHERE m.articleId = :articleId
            """)
    long computeQuantityFromMovements(@Param("articleId") UUID articleId);
}
