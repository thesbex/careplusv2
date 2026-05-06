package ma.careplus.dashboard.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import ma.careplus.dashboard.application.AgendaDashboardService;
import ma.careplus.dashboard.infrastructure.web.dto.AgendaDashboardView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * F1 Dashboard — agenda KPIs.
 *
 * <p>Read-only aggregate over scheduling + patient data. Accessible to every
 * authenticated cabinet role (the dashboard is the landing page after login).
 */
@RestController
@RequestMapping("/api/dashboard/agenda")
@Tag(name = "dashboard", description = "F1 Dashboard — agenda counters & charge horaire")
public class AgendaDashboardController {

    private final AgendaDashboardService service;

    public AgendaDashboardController(AgendaDashboardService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(
            summary = "Agenda dashboard",
            description = "Compteurs RDV jour/semaine, taux de remplissage, no-shows, "
                    + "annulations, nouveaux patients du mois et histogramme charge horaire 08–19h.")
    public ResponseEntity<AgendaDashboardView> getAgendaDashboard() {
        return ResponseEntity.ok(service.getAgendaDashboard());
    }
}
