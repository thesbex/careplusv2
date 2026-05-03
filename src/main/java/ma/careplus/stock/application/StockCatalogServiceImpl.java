package ma.careplus.stock.application;

import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockArticleCategory;
import ma.careplus.stock.domain.StockSupplier;
import ma.careplus.stock.infrastructure.persistence.StockArticleRepository;
import ma.careplus.stock.infrastructure.persistence.StockLotRepository;
import ma.careplus.stock.infrastructure.persistence.StockMovementRepository;
import ma.careplus.stock.infrastructure.persistence.StockSupplierRepository;
import ma.careplus.stock.infrastructure.web.dto.StockArticleWriteRequest;
import ma.careplus.stock.infrastructure.web.dto.StockSupplierWriteRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class StockCatalogServiceImpl implements StockCatalogService {

    private final StockSupplierRepository supplierRepo;
    private final StockArticleRepository articleRepo;
    private final StockMovementRepository movementRepo;
    private final StockLotRepository lotRepo;
    private final EntityManager entityManager;
    // Lazy-style: StockMovementService is injected here to avoid circular deps
    // (StockMovementServiceImpl depends on StockArticleRepository, not StockCatalogService)
    private final StockMovementService movementService;

    public StockCatalogServiceImpl(StockSupplierRepository supplierRepo,
                                   StockArticleRepository articleRepo,
                                   StockMovementRepository movementRepo,
                                   StockLotRepository lotRepo,
                                   EntityManager entityManager,
                                   StockMovementService movementService) {
        this.supplierRepo = supplierRepo;
        this.articleRepo = articleRepo;
        this.movementRepo = movementRepo;
        this.lotRepo = lotRepo;
        this.entityManager = entityManager;
        this.movementService = movementService;
    }

    // ── Suppliers ─────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<StockSupplier> listSuppliers(boolean includeInactive) {
        if (includeInactive) {
            return supplierRepo.findAllByOrderByNameAsc();
        }
        return supplierRepo.findAllByActiveTrueOrderByNameAsc();
    }

    @Override
    @Transactional(readOnly = true)
    public StockSupplier getSupplier(UUID id) {
        return supplierRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("STOCK_SUPPLIER_NOT_FOUND",
                        "Fournisseur introuvable : " + id));
    }

    @Override
    public StockSupplier createSupplier(StockSupplierWriteRequest req) {
        StockSupplier s = new StockSupplier();
        s.setName(req.name());
        s.setPhone(req.phone());
        s.setActive(true);
        return supplierRepo.save(s);
    }

    @Override
    public StockSupplier updateSupplier(UUID id, StockSupplierWriteRequest req) {
        StockSupplier s = supplierRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("STOCK_SUPPLIER_NOT_FOUND",
                        "Fournisseur introuvable : " + id));
        s.setName(req.name());
        s.setPhone(req.phone());
        return supplierRepo.save(s);
    }

    @Override
    public void deactivateSupplier(UUID id) {
        StockSupplier s = supplierRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("STOCK_SUPPLIER_NOT_FOUND",
                        "Fournisseur introuvable : " + id));
        s.setActive(false);
        supplierRepo.save(s);
    }

    // ── Articles ──────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<StockArticle> listArticles(StockArticleCategory category,
                                           UUID supplierId,
                                           String q,
                                           boolean includeInactive,
                                           Pageable pageable) {
        String qParam = (q == null || q.isBlank()) ? null : q.trim();
        String categoryParam = (category == null) ? null : category.name();
        String supplierParam = (supplierId == null) ? null : supplierId.toString();
        return articleRepo.findWithFilters(categoryParam, supplierParam, includeInactive, qParam, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public StockArticle getArticle(UUID id) {
        return articleRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("STOCK_ARTICLE_NOT_FOUND",
                        "Article introuvable : " + id));
    }

    @Override
    public StockArticle createArticle(StockArticleWriteRequest req) {
        // 409 CODE_DUPLICATE if active article with same code already exists
        if (articleRepo.existsByCodeAndActiveTrue(req.code())) {
            throw new BusinessException("CODE_DUPLICATE",
                    "Un article actif avec le code « " + req.code() + " » existe déjà.", 409);
        }
        // Validate supplier exists if provided
        if (req.supplierId() != null && !supplierRepo.existsById(req.supplierId())) {
            throw new NotFoundException("STOCK_SUPPLIER_NOT_FOUND",
                    "Fournisseur introuvable : " + req.supplierId());
        }
        StockArticle a = new StockArticle();
        a.setCode(req.code());
        a.setLabel(req.label());
        a.setCategory(req.category());
        a.setUnit(req.unit());
        a.setMinThreshold(req.minThreshold());
        a.setSupplierId(req.supplierId());
        a.setLocation(req.location());
        a.setActive(true);
        StockArticle saved = articleRepo.saveAndFlush(a);
        // Refresh to read the GENERATED ALWAYS AS column (tracks_lots)
        entityManager.refresh(saved);
        return saved;
    }

    @Override
    public StockArticle updateArticle(UUID id, StockArticleWriteRequest req) {
        StockArticle a = articleRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("STOCK_ARTICLE_NOT_FOUND",
                        "Article introuvable : " + id));

        // 422 CATEGORY_LOCKED if category changes after movements exist
        if (!a.getCategory().equals(req.category())
                && movementRepo.existsByArticleId(id)) {
            throw new BusinessException("CATEGORY_LOCKED",
                    "La catégorie ne peut pas être modifiée : des mouvements existent pour cet article.", 422);
        }

        // Check code uniqueness on other active rows
        if (!a.getCode().equals(req.code()) && articleRepo.existsByCodeAndActiveTrue(req.code())) {
            throw new BusinessException("CODE_DUPLICATE",
                    "Un article actif avec le code « " + req.code() + " » existe déjà.", 409);
        }

        // Validate supplier exists if provided
        if (req.supplierId() != null && !supplierRepo.existsById(req.supplierId())) {
            throw new NotFoundException("STOCK_SUPPLIER_NOT_FOUND",
                    "Fournisseur introuvable : " + req.supplierId());
        }

        a.setCode(req.code());
        a.setLabel(req.label());
        a.setCategory(req.category());
        a.setUnit(req.unit());
        a.setMinThreshold(req.minThreshold());
        a.setSupplierId(req.supplierId());
        a.setLocation(req.location());
        StockArticle saved = articleRepo.saveAndFlush(a);
        entityManager.refresh(saved);
        return saved;
    }

    @Override
    public void deactivateArticle(UUID id) {
        StockArticle a = articleRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("STOCK_ARTICLE_NOT_FOUND",
                        "Article introuvable : " + id));
        a.setActive(false);
        articleRepo.save(a);
    }

    @Override
    @Transactional(readOnly = true)
    public long getCurrentQuantity(UUID articleId) {
        return movementService.getCurrentQuantity(articleId);
    }

    @Override
    @Transactional(readOnly = true)
    public LocalDate getNearestExpiry(UUID articleId) {
        StockArticle a = articleRepo.findById(articleId).orElse(null);
        if (a == null || !a.isTracksLots()) return null;
        return lotRepo.findNearestExpiry(articleId);
    }
}
