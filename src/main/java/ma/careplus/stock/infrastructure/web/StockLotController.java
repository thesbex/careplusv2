package ma.careplus.stock.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import ma.careplus.stock.application.StockLotService;
import ma.careplus.stock.domain.StockLot;
import ma.careplus.stock.domain.StockLotStatus;
import ma.careplus.stock.infrastructure.web.dto.StockLotView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Stock lot endpoints.
 *
 * GET /api/stock/articles/{id}/lots           — tous rôles
 * PUT /api/stock/lots/{lotId}/inactivate       — MEDECIN / ADMIN
 */
@RestController
@Tag(name = "stock", description = "Module stock interne — lots")
public class StockLotController {

    private final StockLotService lotService;

    public StockLotController(StockLotService lotService) {
        this.lotService = lotService;
    }

    @GetMapping("/api/stock/articles/{articleId}/lots")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<StockLotView>> listLots(
            @PathVariable UUID articleId,
            @RequestParam(required = false) StockLotStatus status) {

        List<StockLot> lots = lotService.listLotsForArticle(articleId, status);
        List<StockLotView> views = lots.stream().map(StockLotView::from).toList();
        return ResponseEntity.ok(views);
    }

    @PutMapping("/api/stock/lots/{lotId}/inactivate")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<StockLotView> inactivateLot(
            @PathVariable UUID lotId) {
        StockLot lot = lotService.inactivateLot(lotId, null);
        return ResponseEntity.ok(StockLotView.from(lot));
    }
}
