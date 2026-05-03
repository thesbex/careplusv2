package ma.careplus.catalog.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.application.PrescriptionPdfService;
import ma.careplus.catalog.application.PrescriptionService;
import ma.careplus.catalog.domain.Prescription;
import ma.careplus.catalog.domain.PrescriptionLine;
import ma.careplus.catalog.infrastructure.web.dto.PrescriptionLineResponse;
import ma.careplus.catalog.infrastructure.web.dto.PrescriptionRequest;
import ma.careplus.catalog.infrastructure.web.dto.PrescriptionResponse;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Prescription HTTP endpoints (J6):
 *   POST /api/consultations/{consultationId}/prescriptions  — MEDECIN
 *   GET  /api/consultations/{consultationId}/prescriptions  — MEDECIN, SECRETAIRE, ASSISTANT
 *   GET  /api/prescriptions/{id}                           — MEDECIN, SECRETAIRE, ASSISTANT
 *   GET  /api/prescriptions/{id}/pdf                       — MEDECIN
 */
@RestController
@Tag(name = "prescriptions", description = "Prescription management + PDF generation")
public class PrescriptionController {

    private final PrescriptionService prescriptionService;
    private final PrescriptionPdfService pdfService;

    public PrescriptionController(PrescriptionService prescriptionService,
                                   PrescriptionPdfService pdfService) {
        this.prescriptionService = prescriptionService;
        this.pdfService = pdfService;
    }

    @PostMapping("/api/consultations/{consultationId}/prescriptions")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<PrescriptionResponse> createPrescription(
            @PathVariable UUID consultationId,
            @Valid @RequestBody PrescriptionRequest req,
            Authentication auth) {
        UUID createdBy = UUID.fromString(auth.getName());
        Prescription prescription = prescriptionService.createPrescription(consultationId, req, createdBy);
        List<PrescriptionLine> lines = prescriptionService.getLinesForPrescription(prescription.getId());
        return ResponseEntity.created(URI.create("/api/prescriptions/" + prescription.getId()))
                .body(toResponse(prescription, lines));
    }

    @GetMapping("/api/consultations/{consultationId}/prescriptions")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<PrescriptionResponse> getPrescriptionsForConsultation(
            @PathVariable UUID consultationId) {
        return prescriptionService.getPrescriptionsByConsultation(consultationId).stream()
                .map(p -> toResponse(p, prescriptionService.getLinesForPrescription(p.getId())))
                .toList();
    }

    @GetMapping("/api/patients/{patientId}/prescriptions")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<PrescriptionResponse> getPrescriptionsForPatient(@PathVariable UUID patientId) {
        return prescriptionService.getPrescriptionsByPatient(patientId).stream()
                .map(p -> toResponse(p, prescriptionService.getLinesForPrescription(p.getId())))
                .toList();
    }

    @GetMapping("/api/prescriptions/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public PrescriptionResponse getPrescription(@PathVariable UUID id) {
        Prescription p = prescriptionService.getPrescription(id);
        return toResponse(p, prescriptionService.getLinesForPrescription(id));
    }

    @GetMapping("/api/prescriptions/{id}/pdf")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<byte[]> getPdf(@PathVariable UUID id) {
        byte[] pdf = pdfService.generateOrdonnancePdf(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(
                ContentDisposition.inline()
                        .filename("ordonnance-" + id + ".pdf")
                        .build());
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private PrescriptionResponse toResponse(Prescription p, List<PrescriptionLine> lines) {
        List<PrescriptionLineResponse> lineResponses = lines.stream()
                .map(this::toLineResponse)
                .toList();
        return new PrescriptionResponse(
                p.getId(),
                p.getConsultationId(),
                p.getPatientId(),
                p.getType() != null ? p.getType().name() : null,
                p.getIssuedAt(),
                lineResponses,
                p.isAllergyOverride());
    }

    private PrescriptionLineResponse toLineResponse(PrescriptionLine line) {
        return new PrescriptionLineResponse(
                line.getId(),
                line.getMedicationId(),
                line.getLabTestId(),
                line.getImagingExamId(),
                line.getFreeText(),
                line.getDosage(),
                line.getFrequency(),
                line.getDuration(),
                line.getRoute(),
                line.getTiming(),
                line.getQuantity(),
                line.getInstructions(),
                line.getSortOrder(),
                line.getResultDocumentId());
    }
}
