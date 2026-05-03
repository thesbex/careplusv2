package ma.careplus.vaccination.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.vaccination.application.VaccinationBookletPdfService;
import ma.careplus.vaccination.application.VaccinationService;
import ma.careplus.vaccination.infrastructure.web.dto.DeferDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.RecordDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.UpdateDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.VaccinationCalendarEntry;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Patient-level vaccination calendar and dose management.
 *
 * Base path: /api/patients/{patientId}/vaccinations
 *
 * GET    /                — tous les rôles authentifiés — calendrier matérialisé
 * POST   /                — MEDECIN/ASSISTANT/ADMIN — saisir une dose ADMINISTERED
 * PUT    /{doseId}        — MEDECIN/ADMIN — modifier une dose
 * POST   /{doseId}/defer  — MEDECIN/ASSISTANT/ADMIN — reporter (DEFERRED)
 * POST   /{doseId}/skip   — MEDECIN/ADMIN — sauter (SKIPPED)
 * DELETE /{doseId}        — MEDECIN/ADMIN — soft-delete
 */
@RestController
@RequestMapping("/api/patients/{patientId}/vaccinations")
@Tag(name = "vaccination", description = "Module vaccination enfant — dossier patient")
public class PatientVaccinationController {

    private final VaccinationService vaccinationService;
    private final VaccinationBookletPdfService bookletPdfService;
    private final PatientRepository patientRepository;

    public PatientVaccinationController(VaccinationService vaccinationService,
                                         VaccinationBookletPdfService bookletPdfService,
                                         PatientRepository patientRepository) {
        this.vaccinationService = vaccinationService;
        this.bookletPdfService = bookletPdfService;
        this.patientRepository = patientRepository;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<VaccinationCalendarEntry>> getCalendar(
            @PathVariable UUID patientId) {
        return ResponseEntity.ok(vaccinationService.materializeCalendar(patientId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ASSISTANT','ADMIN')")
    public ResponseEntity<VaccinationCalendarEntry> recordDose(
            @PathVariable UUID patientId,
            @Valid @RequestBody RecordDoseRequest request) {
        VaccinationCalendarEntry entry = vaccinationService.recordDose(patientId, request);
        return ResponseEntity.created(
                URI.create("/api/patients/" + patientId + "/vaccinations/" + entry.id()))
                .body(entry);
    }

    @PutMapping("/{doseId}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<VaccinationCalendarEntry> updateDose(
            @PathVariable UUID patientId,
            @PathVariable UUID doseId,
            @Valid @RequestBody UpdateDoseRequest request) {
        return ResponseEntity.ok(vaccinationService.updateDose(patientId, doseId, request));
    }

    @PostMapping("/{doseId}/defer")
    @PreAuthorize("hasAnyRole('MEDECIN','ASSISTANT','ADMIN')")
    public ResponseEntity<VaccinationCalendarEntry> deferDose(
            @PathVariable UUID patientId,
            @PathVariable UUID doseId,
            @Valid @RequestBody DeferDoseRequest request) {
        return ResponseEntity.ok(vaccinationService.deferDose(patientId, doseId, request));
    }

    @PostMapping("/{doseId}/skip")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<VaccinationCalendarEntry> skipDose(
            @PathVariable UUID patientId,
            @PathVariable UUID doseId) {
        return ResponseEntity.ok(vaccinationService.skipDose(patientId, doseId));
    }

    @DeleteMapping("/{doseId}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> softDelete(
            @PathVariable UUID patientId,
            @PathVariable UUID doseId) {
        vaccinationService.softDelete(patientId, doseId);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/patients/{patientId}/vaccinations/booklet
     * Returns a PDF carnet de vaccination for the patient.
     * If no doses ADMINISTERED → empty booklet (200, not 404).
     * 404 if patient unknown.
     */
    @GetMapping("/booklet")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<byte[]> booklet(@PathVariable UUID patientId) {
        byte[] pdfBytes = bookletPdfService.generate(patientId);

        // Resolve patient name for Content-Disposition filename
        // (best-effort: service already validated the patient exists)
        String filename = resolveFilename(patientId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(
                ContentDisposition.inline().filename(filename).build());
        headers.setContentLength(pdfBytes.length);

        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }

    private String resolveFilename(UUID patientId) {
        return patientRepository.findById(patientId)
                .map(p -> "carnet-vaccination-"
                        + sanitize(p.getLastName()) + "-"
                        + sanitize(p.getFirstName()) + ".pdf")
                .orElse("carnet-vaccination-" + patientId + ".pdf");
    }

    private static String sanitize(String name) {
        if (name == null) return "";
        return name.toLowerCase()
                .replaceAll("[^a-z0-9]", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }
}
