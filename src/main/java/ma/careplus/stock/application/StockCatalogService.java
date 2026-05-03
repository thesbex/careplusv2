package ma.careplus.stock.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockArticleCategory;
import ma.careplus.stock.domain.StockSupplier;
import ma.careplus.stock.infrastructure.web.dto.StockArticleWriteRequest;
import ma.careplus.stock.infrastructure.web.dto.StockSupplierWriteRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Public API for stock catalog (articles + suppliers).
 * Étape 2 additions: getCurrentQuantity + getNearestExpiry.
 */
public interface StockCatalogService {

    // ── Suppliers ─────────────────────────────────────────────────────────────

    List<StockSupplier> listSuppliers(boolean includeInactive);

    StockSupplier getSupplier(UUID id);

    StockSupplier createSupplier(StockSupplierWriteRequest req);

    StockSupplier updateSupplier(UUID id, StockSupplierWriteRequest req);

    /** Soft-delete: active=false. */
    void deactivateSupplier(UUID id);

    // ── Articles ──────────────────────────────────────────────────────────────

    Page<StockArticle> listArticles(StockArticleCategory category,
                                    UUID supplierId,
                                    String q,
                                    boolean includeInactive,
                                    Pageable pageable);

    StockArticle getArticle(UUID id);

    StockArticle createArticle(StockArticleWriteRequest req);

    /**
     * Update article.
     * Guard: 422 CATEGORY_LOCKED if category changes after movements exist.
     */
    StockArticle updateArticle(UUID id, StockArticleWriteRequest req);

    /** Soft-delete: active=false. */
    void deactivateArticle(UUID id);

    // ── Computed fields (delegates to StockMovementService / StockLotRepository) ─

    /**
     * Current stock quantity for an article.
     * Delegates to StockMovementService.getCurrentQuantity().
     */
    long getCurrentQuantity(UUID articleId);

    /**
     * Nearest expiry date among ACTIVE lots of a MEDICAMENT_INTERNE article.
     * Returns null if the article does not track lots or has no active lots.
     */
    LocalDate getNearestExpiry(UUID articleId);
}
