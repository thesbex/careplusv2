package ma.careplus.catalog.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.application.CatalogService;
import ma.careplus.catalog.domain.Act;
import ma.careplus.catalog.domain.Medication;
import ma.careplus.catalog.domain.Tariff;
import ma.careplus.catalog.infrastructure.web.dto.ActRequest;
import ma.careplus.catalog.infrastructure.web.dto.ActResponse;
import ma.careplus.catalog.infrastructure.web.dto.MedicationResponse;
import ma.careplus.catalog.infrastructure.web.dto.TariffRequest;
import ma.careplus.catalog.infrastructure.web.dto.TariffResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Catalog HTTP endpoints (J6):
 *   GET    /api/catalog/acts                     — all roles
 *   POST   /api/catalog/acts                     — MEDECIN, ADMIN
 *   PUT    /api/catalog/acts/{id}                — MEDECIN, ADMIN
 *   DELETE /api/catalog/acts/{id}                — MEDECIN, ADMIN (soft: deactivate)
 *   POST   /api/catalog/acts/{id}/tariffs        — MEDECIN, ADMIN
 *   GET    /api/catalog/acts/{id}/tariffs        — all roles
 *   GET    /api/catalog/medications?q=           — all roles
 */
@RestController
@RequestMapping("/api/catalog")
@Tag(name = "catalog", description = "Acts, tariffs, medications reference data")
public class CatalogController {

    private final CatalogService catalogService;
    private final JdbcTemplate jdbc;

    public CatalogController(CatalogService catalogService, JdbcTemplate jdbc) {
        this.catalogService = catalogService;
        this.jdbc = jdbc;
    }

    public record InsuranceView(UUID id, String code, String name, String kind) {}

    @GetMapping("/insurances")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<InsuranceView> listInsurances() {
        return jdbc.query(
                "SELECT id, code, name, kind FROM catalog_insurance "
                        + "WHERE active = TRUE ORDER BY kind, name",
                (rs, i) -> new InsuranceView(
                        (UUID) rs.getObject("id"),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getString("kind")));
    }

    public record LabTestView(UUID id, String code, String name, String category) {}

    @GetMapping("/lab-tests")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<LabTestView> searchLabTests(
            @RequestParam(required = false, defaultValue = "") String q) {
        String trimmed = q == null ? "" : q.trim();
        if (trimmed.isEmpty()) {
            return jdbc.query(
                    "SELECT id, code, name, category FROM catalog_lab_test "
                            + "WHERE active = TRUE ORDER BY name LIMIT 20",
                    (rs, i) -> new LabTestView(
                            (UUID) rs.getObject("id"),
                            rs.getString("code"),
                            rs.getString("name"),
                            rs.getString("category")));
        }
        String like = "%" + trimmed + "%";
        return jdbc.query(
                "SELECT id, code, name, category FROM catalog_lab_test "
                        + "WHERE active = TRUE AND (name ILIKE ? OR code ILIKE ?) "
                        + "ORDER BY name LIMIT 20",
                (rs, i) -> new LabTestView(
                        (UUID) rs.getObject("id"),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getString("category")),
                like, like);
    }

    public record ImagingExamView(UUID id, String code, String name, String modality) {}

    @GetMapping("/imaging-exams")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<ImagingExamView> searchImagingExams(
            @RequestParam(required = false, defaultValue = "") String q) {
        String trimmed = q == null ? "" : q.trim();
        if (trimmed.isEmpty()) {
            return jdbc.query(
                    "SELECT id, code, name, modality FROM catalog_imaging_exam "
                            + "WHERE active = TRUE ORDER BY modality, name LIMIT 20",
                    (rs, i) -> new ImagingExamView(
                            (UUID) rs.getObject("id"),
                            rs.getString("code"),
                            rs.getString("name"),
                            rs.getString("modality")));
        }
        String like = "%" + trimmed + "%";
        return jdbc.query(
                "SELECT id, code, name, modality FROM catalog_imaging_exam "
                        + "WHERE active = TRUE AND (name ILIKE ? OR code ILIKE ?) "
                        + "ORDER BY modality, name LIMIT 20",
                (rs, i) -> new ImagingExamView(
                        (UUID) rs.getObject("id"),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getString("modality")),
                like, like);
    }

    // ── Acts ──────────────────────────────────────────────────────────────────

    @GetMapping("/acts")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<ActResponse> getActs() {
        return catalogService.getActs().stream().map(this::toActResponse).toList();
    }

    @PostMapping("/acts")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<ActResponse> createAct(@Valid @RequestBody ActRequest req,
                                                  Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        Act act = catalogService.createAct(req, actorId);
        return ResponseEntity.created(URI.create("/api/catalog/acts/" + act.getId()))
                .body(toActResponse(act));
    }

    @PutMapping("/acts/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ActResponse updateAct(@PathVariable UUID id,
                                  @Valid @RequestBody ActRequest req,
                                  Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        return toActResponse(catalogService.updateAct(id, req, actorId));
    }

    @DeleteMapping("/acts/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> deactivateAct(@PathVariable UUID id, Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        catalogService.deactivateAct(id, actorId);
        return ResponseEntity.noContent().build();
    }

    // ── Tariffs ───────────────────────────────────────────────────────────────

    @PostMapping("/acts/{id}/tariffs")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<TariffResponse> addTariff(@PathVariable UUID id,
                                                     @Valid @RequestBody TariffRequest req,
                                                     Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        Tariff tariff = catalogService.addTariff(id, req, actorId);
        return ResponseEntity.created(URI.create("/api/catalog/acts/" + id + "/tariffs/" + tariff.getId()))
                .body(toTariffResponse(tariff));
    }

    @GetMapping("/acts/{id}/tariffs")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<TariffResponse> getTariffs(@PathVariable UUID id) {
        return catalogService.getTariffsForAct(id).stream().map(this::toTariffResponse).toList();
    }

    // ── Medications ───────────────────────────────────────────────────────────

    @GetMapping("/medications")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<MedicationResponse> searchMedications(
            @RequestParam(required = false, defaultValue = "") String q) {
        return catalogService.searchMedications(q).stream().map(this::toMedicationResponse).toList();
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private ActResponse toActResponse(Act act) {
        return new ActResponse(
                act.getId(),
                act.getName(),
                null,  // description not in Act entity (not in V001 schema)
                null,  // defaultDurationMinutes not in Act entity
                act.getType(),
                act.isActive());
    }

    private TariffResponse toTariffResponse(Tariff t) {
        return new TariffResponse(
                t.getId(), t.getActId(), t.getTier(),
                t.getAmount(), t.getEffectiveFrom(), t.getEffectiveTo());
    }

    private MedicationResponse toMedicationResponse(Medication m) {
        return new MedicationResponse(
                m.getId(),
                m.getCommercialName(),
                m.getDci(),
                m.getForm(),
                m.getDosage());
    }
}
