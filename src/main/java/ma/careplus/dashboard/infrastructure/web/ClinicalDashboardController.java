package ma.careplus.dashboard.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import ma.careplus.dashboard.application.ClinicalDashboardService;
import ma.careplus.dashboard.infrastructure.web.dto.ClinicalDashboardView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Clinical KPI endpoint for the F1 Dashboard.
 *
 * <p>GET /api/dashboard/clinical — returns patient + consultation aggregates
 * for the calling practitioner (today / week / month) and cabinet-wide KPIs.
 */
@RestController
@RequestMapping("/api/dashboard/clinical")
@Tag(name = "dashboard", description = "F1 Dashboard — read-only KPI aggregates")
public class ClinicalDashboardController {

    private final ClinicalDashboardService service;

    public ClinicalDashboardController(ClinicalDashboardService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(
            summary = "Dashboard clinique",
            description = "KPI cliniques : patients actifs, activité du praticien (jour/semaine/mois), "
                    + "âge moyen, top pathologies CIM-10 (parsing diagnoses), série quotidienne 7 j / 30 j.")
    public ResponseEntity<ClinicalDashboardView> get(Authentication auth) {
        UUID practitionerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(service.getClinicalDashboard(practitionerId));
    }
}
