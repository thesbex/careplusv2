package ma.careplus.stock.application;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockLot;
import ma.careplus.stock.domain.StockLotStatus;
import ma.careplus.stock.domain.StockMovement;
import ma.careplus.stock.domain.StockMovementType;
import ma.careplus.stock.infrastructure.persistence.StockArticleRepository;
import ma.careplus.stock.infrastructure.persistence.StockLotRepository;
import ma.careplus.stock.infrastructure.persistence.StockMovementRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class StockMovementServiceImpl implements StockMovementService {

    private final StockArticleRepository articleRepo;
    private final StockLotRepository lotRepo;
    private final StockMovementRepository movementRepo;

    public StockMovementServiceImpl(StockArticleRepository articleRepo,
                                    StockLotRepository lotRepo,
                                    StockMovementRepository movementRepo) {
        this.articleRepo = articleRepo;
        this.lotRepo = lotRepo;
        this.movementRepo = movementRepo;
    }

    // ── IN ────────────────────────────────────────────────────────────────────

    @Override
    public StockMovement recordIn(UUID articleId, int quantity,
                                  String lotNumber, LocalDate expiresOn,
                                  UUID performedByUserId) {
        StockArticle article = requireArticle(articleId);

        if (article.isTracksLots()) {
            // lotNumber + expiresOn are required
            if (lotNumber == null || lotNumber.isBlank() || expiresOn == null) {
                throw new BusinessException("LOT_REQUIRED",
                        "lotNumber et expiresOn sont obligatoires pour les médicaments.", 400);
            }

            // Create or increment lot
            StockLot lot = lotRepo.findByArticleIdAndLotNumber(articleId, lotNumber)
                    .orElseGet(() -> {
                        StockLot newLot = new StockLot();
                        newLot.setArticleId(articleId);
                        newLot.setLotNumber(lotNumber);
                        newLot.setExpiresOn(expiresOn);
                        newLot.setQuantity(0);
                        newLot.setStatus(StockLotStatus.ACTIVE);
                        return newLot;
                    });

            // If lot was EXHAUSTED, reactivate it on new stock reception
            if (lot.getStatus() == StockLotStatus.EXHAUSTED) {
                lot.setStatus(StockLotStatus.ACTIVE);
            }
            lot.setQuantity(lot.getQuantity() + quantity);
            if (lot.getExpiresOn() == null) {
                lot.setExpiresOn(expiresOn);
            }
            StockLot savedLot = lotRepo.save(lot);

            return movementRepo.save(buildMovement(articleId, savedLot.getId(),
                    StockMovementType.IN, quantity, null, performedByUserId));
        } else {
            // Non-tracking article: just an IN row, lot_id null
            return movementRepo.save(buildMovement(articleId, null,
                    StockMovementType.IN, quantity, null, performedByUserId));
        }
    }

    // ── OUT ───────────────────────────────────────────────────────────────────

    @Override
    public List<StockMovement> recordOut(UUID articleId, int quantity, UUID performedByUserId) {
        StockArticle article = requireArticle(articleId);

        if (article.isTracksLots()) {
            // FIFO: consume from ACTIVE lots ordered by expires_on ASC, created_at ASC
            long totalAvailable = lotRepo.sumActiveQuantity(articleId);
            if (totalAvailable < quantity) {
                throw new BusinessException("INSUFFICIENT_STOCK",
                        "Stock insuffisant : disponible=" + totalAvailable
                                + ", demandé=" + quantity + ".", 422);
            }

            List<StockLot> activeLots = lotRepo
                    .findByArticleIdAndStatusOrderByExpiresOnAscCreatedAtAsc(articleId, StockLotStatus.ACTIVE);

            List<StockMovement> movements = new ArrayList<>();
            int remaining = quantity;

            for (StockLot lot : activeLots) {
                if (remaining <= 0) break;

                int taken = Math.min(lot.getQuantity(), remaining);
                lot.setQuantity(lot.getQuantity() - taken);
                if (lot.getQuantity() == 0) {
                    lot.setStatus(StockLotStatus.EXHAUSTED);
                }
                lotRepo.save(lot);

                movements.add(movementRepo.save(buildMovement(articleId, lot.getId(),
                        StockMovementType.OUT, taken, null, performedByUserId)));
                remaining -= taken;
            }

            return movements;
        } else {
            // Non-tracking article: check computed quantity
            long currentQty = movementRepo.computeQuantityFromMovements(articleId);
            if (currentQty < quantity) {
                throw new BusinessException("INSUFFICIENT_STOCK",
                        "Stock insuffisant : disponible=" + currentQty
                                + ", demandé=" + quantity + ".", 422);
            }
            return List.of(movementRepo.save(buildMovement(articleId, null,
                    StockMovementType.OUT, quantity, null, performedByUserId)));
        }
    }

    // ── ADJUSTMENT ────────────────────────────────────────────────────────────

    @Override
    public StockMovement recordAdjustment(UUID articleId, int newQuantity, String reason,
                                          UUID performedByUserId) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException("REASON_REQUIRED",
                    "Le motif est obligatoire pour un ajustement.", 400);
        }
        StockArticle article = requireArticle(articleId);

        long currentQty = getCurrentQuantity(articleId);
        int delta = newQuantity - (int) currentQty;
        int absQty = Math.abs(delta);

        if (delta == 0) {
            // No change — still create a movement row for audit (qty=0)
            return movementRepo.save(buildMovement(articleId, null,
                    StockMovementType.ADJUSTMENT, 0, reason, performedByUserId));
        }

        if (article.isTracksLots()) {
            if (delta < 0) {
                // Decrease: apply to oldest ACTIVE lot
                List<StockLot> activeLots = lotRepo
                        .findByArticleIdAndStatusOrderByExpiresOnAscCreatedAtAsc(articleId, StockLotStatus.ACTIVE);

                // We apply the full |delta| to the first lot that has enough,
                // or spread across lots (simplified: apply to first lot found)
                int toRemove = absQty;
                UUID adjustedLotId = null;
                for (StockLot lot : activeLots) {
                    if (toRemove <= 0) break;
                    int removed = Math.min(lot.getQuantity(), toRemove);
                    lot.setQuantity(lot.getQuantity() - removed);
                    if (lot.getQuantity() == 0) {
                        lot.setStatus(StockLotStatus.EXHAUSTED);
                    }
                    lotRepo.save(lot);
                    if (adjustedLotId == null) adjustedLotId = lot.getId();
                    toRemove -= removed;
                }
                return movementRepo.save(buildMovement(articleId, adjustedLotId,
                        StockMovementType.ADJUSTMENT, absQty, reason, performedByUserId));
            } else {
                // Increase: apply to oldest ACTIVE lot, or create an adjustment lot
                List<StockLot> activeLots = lotRepo
                        .findByArticleIdAndStatusOrderByExpiresOnAscCreatedAtAsc(articleId, StockLotStatus.ACTIVE);

                StockLot targetLot;
                if (!activeLots.isEmpty()) {
                    targetLot = activeLots.get(0);
                    targetLot.setQuantity(targetLot.getQuantity() + delta);
                    targetLot = lotRepo.save(targetLot);
                } else {
                    // No active lot — create an adjustment lot
                    String adjLotNumber = "ADJ-" + LocalDate.now();
                    targetLot = lotRepo.findByArticleIdAndLotNumber(articleId, adjLotNumber)
                            .orElseGet(() -> {
                                StockLot newLot = new StockLot();
                                newLot.setArticleId(articleId);
                                newLot.setLotNumber(adjLotNumber);
                                // Adjustment lot expiry: 1 year from today by convention
                                newLot.setExpiresOn(LocalDate.now().plusYears(1));
                                newLot.setQuantity(0);
                                newLot.setStatus(StockLotStatus.ACTIVE);
                                return newLot;
                            });
                    targetLot.setQuantity(targetLot.getQuantity() + delta);
                    targetLot = lotRepo.save(targetLot);
                }
                return movementRepo.save(buildMovement(articleId, targetLot.getId(),
                        StockMovementType.ADJUSTMENT, absQty, reason, performedByUserId));
            }
        } else {
            // Non-tracking: store signed delta directly so computeQuantityFromMovements works correctly
            return movementRepo.save(buildMovement(articleId, null,
                    StockMovementType.ADJUSTMENT, delta, reason, performedByUserId));
        }
    }

    // ── getCurrentQuantity ────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public long getCurrentQuantity(UUID articleId) {
        StockArticle article = requireArticle(articleId);
        if (article.isTracksLots()) {
            return lotRepo.sumActiveQuantity(articleId);
        } else {
            return movementRepo.computeQuantityFromMovements(articleId);
        }
    }

    // ── Movement history ──────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<StockMovement> listMovements(UUID articleId,
                                             String typeFilter,
                                             OffsetDateTime from,
                                             OffsetDateTime to,
                                             Pageable pageable) {
        requireArticle(articleId);
        return movementRepo.findByArticleIdFiltered(articleId, typeFilter, from, to, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public long countMovements(UUID articleId,
                               String typeFilter,
                               OffsetDateTime from,
                               OffsetDateTime to) {
        requireArticle(articleId);
        return movementRepo.countByArticleIdFiltered(articleId, typeFilter, from, to);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private StockArticle requireArticle(UUID articleId) {
        return articleRepo.findById(articleId)
                .orElseThrow(() -> new NotFoundException("STOCK_ARTICLE_NOT_FOUND",
                        "Article introuvable : " + articleId));
    }

    private StockMovement buildMovement(UUID articleId, UUID lotId,
                                        StockMovementType type, int quantity,
                                        String reason, UUID performedBy) {
        StockMovement m = new StockMovement();
        m.setArticleId(articleId);
        m.setLotId(lotId);
        m.setType(type);
        m.setQuantity(quantity);
        m.setReason(reason);
        m.setPerformedBy(performedBy);
        m.setPerformedAt(OffsetDateTime.now());
        return m;
    }
}
