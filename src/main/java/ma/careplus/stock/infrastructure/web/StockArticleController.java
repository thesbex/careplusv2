package ma.careplus.stock.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import ma.careplus.stock.application.StockCatalogService;
import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockArticleCategory;
import ma.careplus.stock.infrastructure.persistence.StockSupplierRepository;
import ma.careplus.stock.infrastructure.web.dto.StockArticleView;
import ma.careplus.stock.infrastructure.web.dto.StockArticleWriteRequest;
import ma.careplus.stock.infrastructure.web.mapper.StockMapper;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Stock article endpoints.
 *
 * GET    /api/stock/articles          — tous les rôles authentifiés (paginé)
 * GET    /api/stock/articles/{id}     — tous les rôles authentifiés
 * POST   /api/stock/articles          — MEDECIN / ADMIN
 * PUT    /api/stock/articles/{id}     — MEDECIN / ADMIN
 * DELETE /api/stock/articles/{id}     — MEDECIN / ADMIN (soft: active=false)
 */
@RestController
@RequestMapping("/api/stock/articles")
@Tag(name = "stock", description = "Module stock interne — articles")
public class StockArticleController {

    private final StockCatalogService catalogService;
    private final StockMapper mapper;
    private final StockSupplierRepository supplierRepo;

    public StockArticleController(StockCatalogService catalogService,
                                   StockMapper mapper,
                                   StockSupplierRepository supplierRepo) {
        this.catalogService = catalogService;
        this.mapper = mapper;
        this.supplierRepo = supplierRepo;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public PageView<StockArticleView> listArticles(
            @RequestParam(required = false) StockArticleCategory category,
            @RequestParam(required = false) UUID supplierId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<StockArticle> resultPage = catalogService.listArticles(
                category, supplierId, q, includeInactive, PageRequest.of(page, size));

        java.util.List<StockArticleView> content = resultPage.getContent().stream()
                .map(this::enrich)
                .toList();

        return PageView.of(content, resultPage.getTotalElements(), page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<StockArticleView> getArticle(@PathVariable UUID id) {
        StockArticle article = catalogService.getArticle(id);
        return ResponseEntity.ok(enrich(article));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<StockArticleView> createArticle(
            @Valid @RequestBody StockArticleWriteRequest req) {
        StockArticle article = catalogService.createArticle(req);
        StockArticleView view = enrich(article);
        return ResponseEntity.created(URI.create("/api/stock/articles/" + view.id()))
                .body(view);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<StockArticleView> updateArticle(
            @PathVariable UUID id,
            @Valid @RequestBody StockArticleWriteRequest req) {
        StockArticle article = catalogService.updateArticle(id, req);
        return ResponseEntity.ok(enrich(article));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> deactivateArticle(@PathVariable UUID id) {
        catalogService.deactivateArticle(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Enriches the base MapStruct view with computed fields:
     * - supplierName: resolved from supplierRepo if supplierId is present.
     * - currentQuantity: computed via StockCatalogService (delegates to StockMovementService).
     * - nearestExpiry: nearest active lot expiry for MEDICAMENT_INTERNE.
     *
     * Note: supplierRepo injection in controller is an accepted exception (same-module access,
     * consistent with Étape 1 convention exception).
     */
    private StockArticleView enrich(StockArticle article) {
        StockArticleView base = mapper.toArticleView(article);
        String supplierName = null;
        if (article.getSupplierId() != null) {
            supplierName = supplierRepo.findById(article.getSupplierId())
                    .map(s -> s.getName())
                    .orElse(null);
        }
        long currentQty = catalogService.getCurrentQuantity(article.getId());
        java.time.LocalDate nearestExpiry = catalogService.getNearestExpiry(article.getId());

        return new StockArticleView(
                base.id(),
                base.code(),
                base.label(),
                base.category(),
                base.unit(),
                base.minThreshold(),
                base.supplierId(),
                supplierName,
                base.location(),
                base.active(),
                base.tracksLots(),
                currentQty,
                nearestExpiry,
                base.version(),
                base.createdAt(),
                base.updatedAt()
        );
    }
}
