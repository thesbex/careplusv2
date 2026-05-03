package ma.careplus.stock.application;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockLot;
import ma.careplus.stock.infrastructure.persistence.StockArticleRepository;
import ma.careplus.stock.infrastructure.persistence.StockLotRepository;
import ma.careplus.stock.infrastructure.persistence.StockSupplierRepository;
import ma.careplus.stock.infrastructure.web.dto.StockAlertCountView;
import ma.careplus.stock.infrastructure.web.dto.StockAlertsView;
import ma.careplus.stock.infrastructure.web.dto.StockArticleView;
import ma.careplus.stock.infrastructure.web.dto.StockLotWithArticleView;
import ma.careplus.stock.infrastructure.web.mapper.StockMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Alert service implementation — Étape 3.
 *
 * Performance note: uses native aggregate queries to avoid N+1 on count.
 * For listAlerts(), accepts moderate N+1 — cabinet GP has max 50-80 articles.
 *
 * Horizon for expiring-soon: 30 days (EXPIRY_HORIZON_DAYS).
 */
@Service
@Transactional(readOnly = true)
public class StockAlertServiceImpl implements StockAlertService {

    private static final int EXPIRY_HORIZON_DAYS = 30;

    private final StockArticleRepository articleRepo;
    private final StockLotRepository lotRepo;
    private final StockSupplierRepository supplierRepo;
    private final StockMovementService movementService;
    private final StockMapper mapper;

    public StockAlertServiceImpl(StockArticleRepository articleRepo,
                                  StockLotRepository lotRepo,
                                  StockSupplierRepository supplierRepo,
                                  StockMovementService movementService,
                                  StockMapper mapper) {
        this.articleRepo = articleRepo;
        this.lotRepo = lotRepo;
        this.supplierRepo = supplierRepo;
        this.movementService = movementService;
        this.mapper = mapper;
    }

    @Override
    public StockAlertCountView getAlertCount() {
        int lowStock = articleRepo.countLowStockArticles();
        int expiringSoon = lotRepo.countExpiringSoonLots(EXPIRY_HORIZON_DAYS);
        return new StockAlertCountView(lowStock, expiringSoon);
    }

    @Override
    public StockAlertsView listAlerts() {
        List<StockArticleView> lowStockViews = buildLowStockList();
        List<StockLotWithArticleView> expiringSoonViews = buildExpiringSoonList();
        return new StockAlertsView(lowStockViews, expiringSoonViews);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private List<StockArticleView> buildLowStockList() {
        return articleRepo.findLowStockArticles().stream()
                .map(this::enrichArticle)
                .toList();
    }

    private List<StockLotWithArticleView> buildExpiringSoonList() {
        return lotRepo.findExpiringSoonLots(EXPIRY_HORIZON_DAYS).stream()
                .map(this::toStockLotWithArticleView)
                .toList();
    }

    /**
     * Enriches a StockArticle entity into StockArticleView.
     * Replicates the same pattern as StockArticleController.enrich().
     */
    private StockArticleView enrichArticle(StockArticle article) {
        StockArticleView base = mapper.toArticleView(article);
        String supplierName = null;
        if (article.getSupplierId() != null) {
            supplierName = supplierRepo.findById(article.getSupplierId())
                    .map(s -> s.getName())
                    .orElse(null);
        }
        long currentQty = movementService.getCurrentQuantity(article.getId());
        LocalDate nearestExpiry = lotRepo.findNearestExpiry(article.getId());

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

    /**
     * Builds a StockLotWithArticleView from a lot by loading its parent article.
     * Moderate N+1 accepted (Étape 3 decision: max 80 lots in a GP cabinet).
     */
    private StockLotWithArticleView toStockLotWithArticleView(StockLot lot) {
        StockArticle article = articleRepo.findById(lot.getArticleId())
                .orElse(null);

        long daysUntilExpiry = (lot.getExpiresOn() != null)
                ? ChronoUnit.DAYS.between(LocalDate.now(), lot.getExpiresOn())
                : 0L;

        String articleCode = article != null ? article.getCode() : null;
        String articleLabel = article != null ? article.getLabel() : null;
        var articleCategory = article != null ? article.getCategory() : null;

        return new StockLotWithArticleView(
                lot.getId(),
                lot.getLotNumber(),
                lot.getExpiresOn(),
                lot.getQuantity(),
                daysUntilExpiry,
                lot.getArticleId(),
                articleCode,
                articleLabel,
                articleCategory
        );
    }
}
