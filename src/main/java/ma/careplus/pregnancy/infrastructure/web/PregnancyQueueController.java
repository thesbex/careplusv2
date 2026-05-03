package ma.careplus.pregnancy.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import ma.careplus.pregnancy.application.PregnancyQueueService;
import ma.careplus.pregnancy.application.PregnancyQueueService.PregnancyQueueEntry;
import ma.careplus.pregnancy.application.PregnancyQueueService.QueueFilters;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pregnancy worklist endpoint — Étape 3.
 *
 * GET /api/pregnancies/queue — paged, SA-sorted worklist of EN_COURS pregnancies (all roles)
 */
@RestController
@RequestMapping("/api/pregnancies/queue")
@Tag(name = "pregnancy", description = "Module suivi prénatal — worklist transversale")
public class PregnancyQueueController {

    private final PregnancyQueueService queueService;

    public PregnancyQueueController(PregnancyQueueService queueService) {
        this.queueService = queueService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(
            summary = "Worklist grossesses",
            description = "Liste paginée des grossesses EN_COURS triées par SA décroissante. "
                    + "Filtres : trimestre (T1/T2/T3), withAlerts, q (nom patiente).")
    public ResponseEntity<PageView<PregnancyQueueEntry>> queue(
            @RequestParam(required = false) String trimester,
            @RequestParam(required = false) Boolean withAlerts,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        QueueFilters filters = new QueueFilters(trimester, withAlerts, q, page, size);
        return ResponseEntity.ok(queueService.queue(filters));
    }
}
