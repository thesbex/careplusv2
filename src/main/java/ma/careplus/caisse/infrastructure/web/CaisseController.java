package ma.careplus.caisse.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import ma.careplus.caisse.application.CaisseService;
import ma.careplus.caisse.infrastructure.web.dto.CaisseSummaryResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Caisse quotidienne (variante A — agrégation à la volée).
 * Permission : SECRETAIRE / MEDECIN / ADMIN (cf. matrice « Close cash register »).
 */
@RestController
@RequestMapping("/api/caisse")
@Tag(name = "caisse", description = "Tableau de bord caisse quotidienne")
public class CaisseController {

    private final CaisseService caisseService;

    public CaisseController(CaisseService caisseService) {
        this.caisseService = caisseService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public ResponseEntity<CaisseSummaryResponse> summary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(caisseService.summarize(date));
    }
}
