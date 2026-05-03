package ma.careplus.stock.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.stock.domain.StockLot;
import ma.careplus.stock.domain.StockLotStatus;
import ma.careplus.stock.infrastructure.persistence.StockLotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class StockLotServiceImpl implements StockLotService {

    private final StockLotRepository lotRepo;

    public StockLotServiceImpl(StockLotRepository lotRepo) {
        this.lotRepo = lotRepo;
    }

    @Override
    public StockLot inactivateLot(UUID lotId, UUID performedByUserId) {
        StockLot lot = lotRepo.findById(lotId)
                .orElseThrow(() -> new NotFoundException("STOCK_LOT_NOT_FOUND",
                        "Lot introuvable : " + lotId));

        if (lot.getStatus() == StockLotStatus.EXHAUSTED) {
            throw new BusinessException("LOT_EXHAUSTED",
                    "Un lot épuisé ne peut pas être inactivé.", 409);
        }

        // Idempotent: already INACTIVE → no-op
        if (lot.getStatus() != StockLotStatus.INACTIVE) {
            lot.setStatus(StockLotStatus.INACTIVE);
            lot = lotRepo.save(lot);
        }

        return lot;
    }

    @Override
    @Transactional(readOnly = true)
    public List<StockLot> listLotsForArticle(UUID articleId, StockLotStatus statusFilter) {
        return lotRepo.findByArticleIdWithOptionalStatus(articleId, statusFilter);
    }
}
