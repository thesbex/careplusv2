package ma.careplus.pregnancy.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.pregnancy.application.PregnancyAlertService;
import ma.careplus.pregnancy.application.PregnancyAlertService.PregnancyAlertView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pregnancy alert endpoints — Étape 3.
 *
 * GET /api/pregnancies/{id}/alerts         — list active alerts for one pregnancy (all roles)
 * GET /api/pregnancies/alerts/count        — count pregnancies with ≥ 1 alert (sidebar badge)
 */
@RestController
@Tag(name = "pregnancy", description = "Module suivi prénatal — alertes obstétricales")
public class PregnancyAlertController {

    private final PregnancyAlertService alertService;

    public PregnancyAlertController(PregnancyAlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping("/api/pregnancies/{id}/alerts")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(
            summary = "Alertes grossesse",
            description = "Évalue les 7 règles hardcodées pour la grossesse donnée. "
                    + "Retourne une liste vide si aucune alerte.")
    public ResponseEntity<List<PregnancyAlertView>> listAlerts(@PathVariable UUID id) {
        return ResponseEntity.ok(alertService.queryAlertsForPregnancy(id));
    }

    @GetMapping("/api/pregnancies/alerts/count")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(
            summary = "Compteur alertes sidebar",
            description = "Nombre de grossesses EN_COURS ayant au moins 1 alerte active. "
                    + "Conçu pour le badge sidebar (polling 30 s).")
    public ResponseEntity<Map<String, Integer>> countActiveAlerts() {
        int count = alertService.countActiveAlerts();
        return ResponseEntity.ok(Map.of("withActiveAlerts", count));
    }
}
