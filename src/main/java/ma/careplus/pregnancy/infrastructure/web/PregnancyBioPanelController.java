package ma.careplus.pregnancy.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import ma.careplus.pregnancy.application.PregnancyBioPanelService;
import ma.careplus.pregnancy.application.PregnancyBioPanelService.BioPanelTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bio panel template endpoint — Étape 3.
 *
 * GET /api/pregnancies/{id}/bio-panel-template?trimester=T1 — MEDECIN/ADMIN
 *
 * Returns a pre-filled prescription template for T1/T2/T3 biological workup
 * per the PSGA (Programme de Surveillance de la Grossesse et de l'Accouchement).
 */
@RestController
@Tag(name = "pregnancy", description = "Module suivi prénatal — bilan biologique")
public class PregnancyBioPanelController {

    private final PregnancyBioPanelService bioPanelService;

    public PregnancyBioPanelController(PregnancyBioPanelService bioPanelService) {
        this.bioPanelService = bioPanelService;
    }

    @GetMapping("/api/pregnancies/{id}/bio-panel-template")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(
            summary = "Modèle bilan prénatal",
            description = "Retourne la liste de prescriptions biologiques recommandées "
                    + "pour le trimestre demandé (T1/T2/T3) selon le programme PSGA. "
                    + "422 INVALID_TRIMESTER si le trimestre est invalide.")
    public ResponseEntity<BioPanelTemplate> getBioPanelTemplate(
            @PathVariable UUID id,
            @RequestParam String trimester,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        BioPanelTemplate template = bioPanelService.buildTemplate(id, trimester, actorId);
        return ResponseEntity.ok(template);
    }
}
