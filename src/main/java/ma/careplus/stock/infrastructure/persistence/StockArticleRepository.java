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
}
