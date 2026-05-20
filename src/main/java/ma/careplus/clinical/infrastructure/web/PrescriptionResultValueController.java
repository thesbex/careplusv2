package ma.careplus.clinical.infrastructure.web;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.application.PrescriptionResultValueService;
import ma.careplus.clinical.application.PrescriptionResultValueService.ValueInput;
import ma.careplus.clinical.domain.PrescriptionResultValue;
import ma.careplus.clinical.infrastructure.web.dto.PrescriptionResultValueView;
import ma.careplus.clinical.infrastructure.web.dto.ReplaceResultValuesRequest;
import ma.careplus.clinical.infrastructure.web.dto.TrendSeriesView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * V047 — endpoints saisie structurée + lecture du graphe biologique.
 *
 *  PUT  /api/prescriptions/lines/{lineId}/result-values   — bulk replace
 *  GET  /api/prescriptions/lines/{lineId}/result-values   — lecture
 *  GET  /api/patients/{patientId}/result-trends           — séries graphe
 */
@RestController
public class PrescriptionResultValueController {

    private final PrescriptionResultValueService service;

    public PrescriptionResultValueController(PrescriptionResultValueService service) {
        this.service = service;
    }

    @PutMapping("/api/prescriptions/lines/{lineId}/result-values")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN','LAB','RADIO')")
    public ResponseEntity<List<PrescriptionResultValueView>> replace(
            @PathVariable UUID lineId,
            @Valid @RequestBody ReplaceResultValuesRequest req) {
        List<ValueInput> inputs = req.values().stream()
                .map(v -> new ValueInput(v.analyte(), v.value(), v.unit()))
                .toList();
        List<PrescriptionResultValue> saved = service.replaceForLine(lineId, inputs);
        return ResponseEntity.ok(saved.stream().map(PrescriptionResultValueView::of).toList());
    }

    @GetMapping("/api/prescriptions/lines/{lineId}/result-values")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN','LAB','RADIO')")
    public List<PrescriptionResultValueView> list(@PathVariable UUID lineId) {
        return service.listForLine(lineId).stream()
                .map(PrescriptionResultValueView::of)
                .toList();
    }

    @GetMapping("/api/patients/{patientId}/result-trends")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<TrendSeriesView> trends(@PathVariable UUID patientId) {
        var groups = service.trendForPatient(patientId);
        return groups.entrySet().stream()
                .map(e -> {
                    var pts = e.getValue();
                    // Unité majoritaire = celle de la dernière mesure (la plus récente).
                    String unit = pts.isEmpty() ? null : pts.get(pts.size() - 1).getUnit();
                    var points = pts.stream()
                            .map(v -> new TrendSeriesView.Point(
                                    v.getRecordedAt(), v.getValueNumeric(), v.getUnit()))
                            .toList();
                    return new TrendSeriesView(e.getKey(), unit, points);
                })
                .toList();
    }
}
