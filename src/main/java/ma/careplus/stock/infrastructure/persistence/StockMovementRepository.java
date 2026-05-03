package ma.careplus.stock.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.stock.domain.StockMovement;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    boolean existsByArticleId(UUID articleId);

    /**
     * Compute current quantity for articles that do NOT track lots (tracks_lots=false).
     * IN adds, OUT subtracts, ADJUSTMENT adds directly (signed delta stored in quantity).
     */
    @Query("""
            SELECT COALESCE(SUM(CASE
                WHEN m.type = ma.careplus.stock.domain.StockMovementType.IN  THEN  m.quantity
                WHEN m.type = ma.careplus.stock.domain.StockMovementType.OUT THEN -m.quantity
                WHEN m.type = ma.careplus.stock.domain.StockMovementType.ADJUSTMENT THEN m.quantity
                ELSE 0
            END), 0)
            FROM StockMovement m
            WHERE m.articleId = :articleId
            """)
    long computeQuantityFromMovements(@Param("articleId") UUID articleId);

    /**
     * Paginated history of movements for an article, newest first.
     * All filter params optional (null = no filter).
     * Uses native SQL to avoid Postgres type-inference issue with nullable enum params.
     */
    @Query(value = """
            SELECT * FROM stock_movement m
            WHERE m.article_id = :articleId
              AND (CAST(:type AS TEXT) IS NULL OR m.type = CAST(:type AS TEXT))
              AND (CAST(:from AS TIMESTAMPTZ) IS NULL OR m.performed_at >= CAST(:from AS TIMESTAMPTZ))
              AND (CAST(:to AS TIMESTAMPTZ) IS NULL OR m.performed_at <= CAST(:to AS TIMESTAMPTZ))
            ORDER BY m.performed_at DESC, m.created_at DESC
            """,
            nativeQuery = true)
    List<StockMovement> findByArticleIdFiltered(
            @Param("articleId") UUID articleId,
            @Param("type") String type,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            Pageable pageable);

    @Query(value = """
            SELECT COUNT(*) FROM stock_movement m
            WHERE m.article_id = :articleId
              AND (CAST(:type AS TEXT) IS NULL OR m.type = CAST(:type AS TEXT))
              AND (CAST(:from AS TIMESTAMPTZ) IS NULL OR m.performed_at >= CAST(:from AS TIMESTAMPTZ))
              AND (CAST(:to AS TIMESTAMPTZ) IS NULL OR m.performed_at <= CAST(:to AS TIMESTAMPTZ))
            """,
            nativeQuery = true)
    long countByArticleIdFiltered(
            @Param("articleId") UUID articleId,
            @Param("type") String type,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);
}
