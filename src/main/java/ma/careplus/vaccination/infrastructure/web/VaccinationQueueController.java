package ma.careplus.vaccination.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import ma.careplus.vaccination.application.VaccinationQueueService;
import ma.careplus.vaccination.domain.VaccinationCalendarStatus;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import ma.careplus.vaccination.infrastructure.web.dto.QueueFilters;
import ma.careplus.vaccination.infrastructure.web.dto.VaccinationQueueEntry;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cross-patient vaccination worklist.
 *
 * GET /api/vaccinations/queue — all authenticated roles (Q5 + Q8 of design).
 */
@RestController
@RequestMapping("/api/vaccinations/queue")
@Tag(name = "vaccination", description = "Module vaccination enfant — worklist transversale")
public class VaccinationQueueController {

    private final VaccinationQueueService queueService;

    public VaccinationQueueController(VaccinationQueueService queueService) {
        this.queueService = queueService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(
            summary = "Worklist vaccinations",
            description = "Liste paginée des doses dues (OVERDUE/DUE_SOON par défaut) "
                    + "pour tous les patients pédiatriques. Tri urgence DESC.")
    public ResponseEntity<PageView<VaccinationQueueEntry>> queue(
            @RequestParam(required = false) VaccinationCalendarStatus status,
            @RequestParam(required = false) String vaccineCode,
            @RequestParam(required = false) UUID practitionerId,
            @RequestParam(required = false) Integer ageGroupMinMonths,
            @RequestParam(required = false) Integer ageGroupMaxMonths,
            @RequestParam(required = false) Integer upcomingHorizonDays,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        QueueFilters filters = new QueueFilters(
                status,
                vaccineCode,
                practitionerId,
                ageGroupMinMonths,
                ageGroupMaxMonths,
                upcomingHorizonDays,
                page,
                size);

        return ResponseEntity.ok(queueService.queue(filters));
    }
}
