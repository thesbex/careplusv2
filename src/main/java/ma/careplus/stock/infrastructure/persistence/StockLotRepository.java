package ma.careplus.stock.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.stock.domain.StockLot;
import ma.careplus.stock.domain.StockLotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockLotRepository extends JpaRepository<StockLot, UUID> {

    List<StockLot> findByArticleIdOrderByExpiresOnAsc(UUID articleId);

    List<StockLot> findByArticleIdAndStatusOrderByExpiresOnAscCreatedAtAsc(
            UUID articleId, StockLotStatus status);

    Optional<StockLot> findByArticleIdAndLotNumber(UUID articleId, String lotNumber);

    boolean existsByArticleIdAndLotNumber(UUID articleId, String lotNumber);

    /**
     * Sum of quantities for ACTIVE lots of a given article.
     * Used for currentQuantity calculation on MEDICAMENT_INTERNE.
     */
    @Query("SELECT COALESCE(SUM(l.quantity), 0) FROM StockLot l "
            + "WHERE l.articleId = :articleId AND l.status = 'ACTIVE'")
    long sumActiveQuantity(@Param("articleId") UUID articleId);

    /**
     * List lots for an article with optional status filter (null = all statuses).
     * Ordered by expires_on ASC.
     */
    @Query("""
            SELECT l FROM StockLot l
            WHERE l.articleId = :articleId
              AND (:status IS NULL OR l.status = :status)
            ORDER BY l.expiresOn ASC, l.createdAt ASC
            """)
    List<StockLot> findByArticleIdWithOptionalStatus(
            @Param("articleId") UUID articleId,
            @Param("status") StockLotStatus status);

    /**
     * Nearest expiry date among ACTIVE lots for an article.
     * Returns null if no active lots.
     */
    @Query("SELECT MIN(l.expiresOn) FROM StockLot l "
            + "WHERE l.articleId = :articleId AND l.status = 'ACTIVE'")
    java.time.LocalDate findNearestExpiry(@Param("articleId") UUID articleId);

    // ── Alert queries (Étape 3) ───────────────────────────────────────────────

    /**
     * Count of ACTIVE lots expiring within the given horizon (days), whose article is active.
     */
    @Query(value = """
            SELECT COUNT(*) FROM stock_lot l
            JOIN stock_article a ON a.id = l.article_id
            WHERE l.status = 'ACTIVE'
              AND a.active = TRUE
              AND l.expires_on IS NOT NULL
              AND l.expires_on <= CURRENT_DATE + CAST(:horizonDays AS INTEGER)
            """,
            nativeQuery = true)
    int countExpiringSoonLots(@Param("horizonDays") int horizonDays);

    /**
     * ACTIVE lots expiring within the given horizon (days), whose article is active.
     * Ordered by expires_on ASC.
     */
    @Query(value = """
            SELECT l.* FROM stock_lot l
            JOIN stock_article a ON a.id = l.article_id
            WHERE l.status = 'ACTIVE'
              AND a.active = TRUE
              AND l.expires_on IS NOT NULL
              AND l.expires_on <= CURRENT_DATE + CAST(:horizonDays AS INTEGER)
            ORDER BY l.expires_on ASC
            """,
            nativeQuery = true)
    List<StockLot> findExpiringSoonLots(@Param("horizonDays") int horizonDays);
}
