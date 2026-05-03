package ma.careplus.stock.application;

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
 * Public API for stock catalog (articles + suppliers) — Étape 1.
 * Does NOT include movement, lot, or alert logic (Étapes 2/3).
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
}
