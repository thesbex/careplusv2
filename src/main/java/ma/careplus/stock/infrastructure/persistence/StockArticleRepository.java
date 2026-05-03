package ma.careplus.stock.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockArticleCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;


public interface StockArticleRepository extends JpaRepository<StockArticle, UUID> {

    Optional<StockArticle> findByCode(String code);

    boolean existsByCodeAndActiveTrue(String code);

    boolean existsByCode(String code);

    /**
     * Paginated list with optional filters.
     * Uses native SQL to avoid Hibernate type-inference issues with nullable parameters.
     */
    @Query(value = """
            SELECT * FROM stock_article a
            WHERE (CAST(:category AS TEXT) IS NULL OR a.category = :category)
              AND (CAST(:supplierId AS TEXT) IS NULL OR a.supplier_id = CAST(:supplierId AS UUID))
              AND (:includeInactive = TRUE OR a.active = TRUE)
              AND (CAST(:q AS TEXT) IS NULL
                   OR LOWER(a.label) LIKE LOWER('%' || CAST(:q AS TEXT) || '%')
                   OR LOWER(a.code)  LIKE LOWER('%' || CAST(:q AS TEXT) || '%'))
            ORDER BY a.code ASC
            """,
            countQuery = """
            SELECT COUNT(*) FROM stock_article a
            WHERE (CAST(:category AS TEXT) IS NULL OR a.category = :category)
              AND (CAST(:supplierId AS TEXT) IS NULL OR a.supplier_id = CAST(:supplierId AS UUID))
              AND (:includeInactive = TRUE OR a.active = TRUE)
              AND (CAST(:q AS TEXT) IS NULL
                   OR LOWER(a.label) LIKE LOWER('%' || CAST(:q AS TEXT) || '%')
                   OR LOWER(a.code)  LIKE LOWER('%' || CAST(:q AS TEXT) || '%'))
            """,
            nativeQuery = true)
    Page<StockArticle> findWithFilters(
            @Param("category") String category,
            @Param("supplierId") String supplierId,
            @Param("includeInactive") boolean includeInactive,
            @Param("q") String q,
            Pageable pageable);

    /**
     * All active articles for a given supplier.
     */
    List<StockArticle> findBySupplierId(UUID supplierId);

    // ── Alert queries (Étape 3) ───────────────────────────────────────────────

    /**
     * Count of active articles whose current stock is below min_threshold.
     * Uses native query to join movement aggregates efficiently.
     * Articles with min_threshold = 0 are excluded (no alert threshold defined).
     *
     * For tracks_lots=false: currentQty = SUM from stock_movement
     * For tracks_lots=true: currentQty = SUM of ACTIVE lot quantities
     */
    @Query(value = """
            SELECT COUNT(*) FROM stock_article a
            WHERE a.active = TRUE
              AND a.min_threshold > 0
              AND (
                CASE
                  WHEN a.tracks_lots = TRUE THEN
                    COALESCE((SELECT SUM(l.quantity) FROM stock_lot l
                              WHERE l.article_id = a.id AND l.status = 'ACTIVE'), 0)
                  ELSE
                    COALESCE((SELECT SUM(CASE
                                WHEN m.type = 'IN' THEN m.quantity
                                WHEN m.type = 'OUT' THEN -m.quantity
                                WHEN m.type = 'ADJUSTMENT' THEN m.quantity
                                ELSE 0 END)
                              FROM stock_movement m WHERE m.article_id = a.id), 0)
                END
              ) < a.min_threshold
            """,
            nativeQuery = true)
    int countLowStockArticles();

    /**
     * Active articles below threshold, with their current stock computed inline.
     * min_threshold = 0 excluded. Returns full article rows.
     */
    @Query(value = """
            SELECT * FROM stock_article a
            WHERE a.active = TRUE
              AND a.min_threshold > 0
              AND (
                CASE
                  WHEN a.tracks_lots = TRUE THEN
                    COALESCE((SELECT SUM(l.quantity) FROM stock_lot l
                              WHERE l.article_id = a.id AND l.status = 'ACTIVE'), 0)
                  ELSE
                    COALESCE((SELECT SUM(CASE
                                WHEN m.type = 'IN' THEN m.quantity
                                WHEN m.type = 'OUT' THEN -m.quantity
                                WHEN m.type = 'ADJUSTMENT' THEN m.quantity
                                ELSE 0 END)
                              FROM stock_movement m WHERE m.article_id = a.id), 0)
                END
              ) < a.min_threshold
            ORDER BY a.code ASC
            """,
            nativeQuery = true)
    List<StockArticle> findLowStockArticles();
}
