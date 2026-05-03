package ma.careplus.stock.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import ma.careplus.stock.application.StockAlertService;
import ma.careplus.stock.infrastructure.web.dto.StockAlertCountView;
import ma.careplus.stock.infrastructure.web.dto.StockAlertsView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Stock alert endpoints — Étape 3.
 *
 * GET /api/stock/alerts/count — aggregate badge counts (all authenticated roles, polling 30s)
 * GET /api/stock/alerts       — detailed alert lists (all authenticated roles)
 */
@RestController
@RequestMapping("/api/stock/alerts")
@Tag(name = "stock", description = "Module stock interne — alertes")
public class StockAlertController {

    private final StockAlertService alertService;

    public StockAlertController(StockAlertService alertService) {
        this.alertService = alertService;
    }

    /**
     * Returns aggregate counts for sidebar badge.
     * Designed for polling every 30s — uses a fast native COUNT query.
     */
    @GetMapping("/count")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<StockAlertCountView> getAlertCount() {
        return ResponseEntity.ok(alertService.getAlertCount());
    }

    /**
     * Returns detailed alert lists:
     * - lowStock: articles below minThreshold with currentQuantity computed.
     * - expiringSoon: ACTIVE lots expiring within 30 days.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<StockAlertsView> listAlerts() {
        return ResponseEntity.ok(alertService.listAlerts());
    }
}
