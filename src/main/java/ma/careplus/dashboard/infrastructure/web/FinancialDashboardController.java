package ma.careplus.dashboard.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import ma.careplus.dashboard.application.FinancialDashboardService;
import ma.careplus.dashboard.infrastructure.web.dto.FinancialDashboardView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * F1 Dashboard — financial section.
 *
 * <p>CA (chiffre d'affaires) + impayés + breakdown par acte. Accès restreint
 * MEDECIN/ADMIN — le CA est une donnée sensible que l'équipe administrative
 * (SECRETAIRE, ASSISTANT) ne doit pas consulter par défaut.
 */
@RestController
@RequestMapping("/api/dashboard/financial")
@Tag(name = "dashboard", description = "F1 Dashboard — KPI cabinet")
public class FinancialDashboardController {

    private final FinancialDashboardService service;

    public FinancialDashboardController(FinancialDashboardService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<FinancialDashboardView> getFinancialDashboard() {
        return ResponseEntity.ok(service.getFinancialDashboard());
    }
}
