package ma.careplus.vaccination.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.vaccination.application.VaccinationCatalogService;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineCatalogView;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineCatalogWriteRequest;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineScheduleDoseView;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineScheduleDoseWriteRequest;
import ma.careplus.vaccination.infrastructure.web.mapper.VaccinationMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Vaccination catalog and schedule endpoints.
 *
 * GET  /api/vaccinations/catalog             — tous les rôles authentifiés
 * POST /api/vaccinations/catalog             — MEDECIN / ADMIN
 * PUT  /api/vaccinations/catalog/{id}        — MEDECIN / ADMIN
 * DELETE /api/vaccinations/catalog/{id}      — MEDECIN / ADMIN (soft: active=false)
 *
 * GET  /api/vaccinations/schedule            — tous
 * GET  /api/vaccinations/schedule?vaccineId= — tous
 * POST /api/vaccinations/schedule            — MEDECIN / ADMIN
 * PUT  /api/vaccinations/schedule/{id}       — MEDECIN / ADMIN
 * DELETE /api/vaccinations/schedule/{id}     — MEDECIN / ADMIN
 */
@RestController
@RequestMapping("/api/vaccinations")
@Tag(name = "vaccination", description = "Module vaccination enfant — référentiel PNI")
public class VaccinationCatalogController {

    private final VaccinationCatalogService catalogService;
    private final VaccinationMapper mapper;

    public VaccinationCatalogController(VaccinationCatalogService catalogService,
                                         VaccinationMapper mapper) {
        this.catalogService = catalogService;
        this.mapper = mapper;
    }

    // ── Vaccine catalog ───────────────────────────────────────────────────────

    @GetMapping("/catalog")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<VaccineCatalogView> listCatalog() {
        return catalogService.listCatalog().stream()
                .map(mapper::toCatalogView)
                .toList();
    }

    @PostMapping("/catalog")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<VaccineCatalogView> createCatalog(
            @Valid @RequestBody VaccineCatalogWriteRequest req) {
        VaccineCatalogView view = mapper.toCatalogView(catalogService.createCatalog(req));
        return ResponseEntity.created(URI.create("/api/vaccinations/catalog/" + view.id()))
                .body(view);
    }

    @PutMapping("/catalog/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<VaccineCatalogView> updateCatalog(
            @PathVariable UUID id,
            @Valid @RequestBody VaccineCatalogWriteRequest req) {
        VaccineCatalogView view = mapper.toCatalogView(catalogService.updateCatalog(id, req));
        return ResponseEntity.ok(view);
    }

    @DeleteMapping("/catalog/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> deactivateCatalog(@PathVariable UUID id) {
        catalogService.deactivateCatalog(id);
        return ResponseEntity.noContent().build();
    }

    // ── Vaccine schedule ──────────────────────────────────────────────────────

    @GetMapping("/schedule")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<VaccineScheduleDoseView> listSchedule(
            @RequestParam(required = false) UUID vaccineId) {
        if (vaccineId != null) {
            return catalogService.listScheduleByVaccine(vaccineId).stream()
                    .map(mapper::toScheduleView)
                    .toList();
        }
        return catalogService.listSchedule().stream()
                .map(mapper::toScheduleView)
                .toList();
    }

    @PostMapping("/schedule")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<VaccineScheduleDoseView> createSchedule(
            @Valid @RequestBody VaccineScheduleDoseWriteRequest req) {
        VaccineScheduleDoseView view = mapper.toScheduleView(catalogService.createSchedule(req));
        return ResponseEntity.created(URI.create("/api/vaccinations/schedule/" + view.id()))
                .body(view);
    }

    @PutMapping("/schedule/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<VaccineScheduleDoseView> updateSchedule(
            @PathVariable UUID id,
            @Valid @RequestBody VaccineScheduleDoseWriteRequest req) {
        VaccineScheduleDoseView view = mapper.toScheduleView(catalogService.updateSchedule(id, req));
        return ResponseEntity.ok(view);
    }

    @DeleteMapping("/schedule/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> deleteSchedule(@PathVariable UUID id) {
        catalogService.deleteSchedule(id);
        return ResponseEntity.noContent().build();
    }
}
