package ma.careplus.hospitalization.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.clinical.application.VitalsService;
import ma.careplus.clinical.domain.VitalSigns;
import ma.careplus.clinical.infrastructure.web.dto.RecordVitalsRequest;
import ma.careplus.hospitalization.application.StayService;
import ma.careplus.hospitalization.application.StaySummaryPdfService;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayQueueEntry;
import ma.careplus.hospitalization.infrastructure.web.dto.StayVitalsView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.AdmitRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.DischargeRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.TransferRequest;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cycle de vie des séjours hospitaliers (Slice B+D).
 *
 * <pre>
 * GET    /api/hospitalization/stays/queue       worklist (rôles soignants)
 * GET    /api/hospitalization/stays/{id}        détail + aperçu facturation
 * POST   /api/hospitalization/stays/admit       admettre (bureau des admissions)
 * POST   /api/hospitalization/stays/{id}/transfer   transférer de lit
 * POST   /api/hospitalization/stays/{id}/discharge  sortie médicale (MEDECIN/ADMIN)
 * POST   /api/hospitalization/stays/{id}/cancel      annuler l'admission
 * POST   /api/hospitalization/stays/{id}/invoice     générer la facture de séjour
 * </pre>
 */
@RestController
@RequestMapping("/api/hospitalization/stays")
@Tag(name = "hospitalization-stays", description = "Séjours hospitaliers : admission / transfert / sortie / facturation")
public class StayController {

    private static final String READ_ROLES =
            "hasAnyRole('SECRETAIRE','ASSISTANT','INFIRMIER','MEDECIN','ADMIN')";
    private static final String ADMIT_ROLES =
            "hasAnyRole('SECRETAIRE','INFIRMIER','RECEPTIONNISTE','MEDECIN','ADMIN')";
    private static final String DISCHARGE_ROLES = "hasAnyRole('MEDECIN','ADMIN')";
    private static final String BILL_ROLES = "hasAnyRole('SECRETAIRE','RECEPTIONNISTE','MEDECIN','ADMIN')";

    private final StayService service;
    private final VitalsService vitalsService;
    private final StaySummaryPdfService pdfService;

    public StayController(StayService service, VitalsService vitalsService, StaySummaryPdfService pdfService) {
        this.service = service;
        this.vitalsService = vitalsService;
        this.pdfService = pdfService;
    }

    private static StayVitalsView toVitalsView(VitalSigns v) {
        return new StayVitalsView(v.getId(), v.getSystolicMmhg(), v.getDiastolicMmhg(),
                v.getTemperatureC(), v.getWeightKg(), v.getHeartRateBpm(), v.getSpo2Percent(),
                v.getGlycemiaGPerL(), v.getNotes(), v.getRecordedAt());
    }

    private static UUID actor(Authentication auth) {
        return UUID.fromString(auth.getName());
    }

    /**
     * Worklist. Sans paramètre → séjours EN_COURS (défaut historique). Avec
     * {@code statuses} (CSV : EN_COURS,SORTI,FACTURE,ANNULE) → permet de revenir
     * sur l'historique des séjours clôturés depuis la page Hospitalisation.
     */
    @GetMapping("/queue")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<StayQueueEntry>> queue(
            @RequestParam(value = "statuses", required = false) String statuses,
            Authentication auth) {
        if (statuses == null || statuses.isBlank()) {
            return ResponseEntity.ok(service.listActive(auth));
        }
        java.util.Set<String> set = java.util.Arrays.stream(statuses.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(String::toUpperCase)
                .collect(java.util.stream.Collectors.toSet());
        return ResponseEntity.ok(service.listByStatuses(set, auth));
    }

    /** Séjours d'un patient (onglet dossier). */
    @GetMapping
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<StayDetailView>> byPatient(@RequestParam("patientId") UUID patientId) {
        return ResponseEntity.ok(service.listForPatient(patientId));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<StayDetailView> get(@PathVariable UUID id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping("/admit")
    @PreAuthorize(ADMIT_ROLES)
    public ResponseEntity<StayDetailView> admit(@Valid @RequestBody AdmitRequest req, Authentication auth) {
        StayDetailView v = service.admit(req, actor(auth));
        return ResponseEntity.created(URI.create("/api/hospitalization/stays/" + v.id())).body(v);
    }

    @PostMapping("/{id}/transfer")
    @PreAuthorize(ADMIT_ROLES)
    public ResponseEntity<StayDetailView> transfer(
            @PathVariable UUID id, @Valid @RequestBody TransferRequest req, Authentication auth) {
        return ResponseEntity.ok(service.transfer(id, req, actor(auth)));
    }

    @PostMapping("/{id}/discharge")
    @PreAuthorize(DISCHARGE_ROLES)
    public ResponseEntity<StayDetailView> discharge(
            @PathVariable UUID id, @Valid @RequestBody DischargeRequest req, Authentication auth) {
        return ResponseEntity.ok(service.discharge(id, req, actor(auth)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(ADMIT_ROLES)
    public ResponseEntity<Void> cancel(@PathVariable UUID id, Authentication auth) {
        service.cancel(id, actor(auth));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/invoice")
    @PreAuthorize(BILL_ROLES)
    public ResponseEntity<Map<String, UUID>> invoice(@PathVariable UUID id, Authentication auth) {
        UUID invoiceId = service.generateInvoice(id, actor(auth));
        return ResponseEntity.ok(Map.of("invoiceId", invoiceId));
    }

    // ── Constantes au lit (Slice C) ────────────────────────────────────

    /** Saisie de constantes rattachées au séjour (soins au lit). */
    @PostMapping("/{id}/vitals")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<StayVitalsView> recordVitals(
            @PathVariable UUID id, @Valid @RequestBody RecordVitalsRequest req, Authentication auth) {
        StayDetailView stay = service.get(id); // 404 si séjour inconnu + résout le patient
        VitalSigns v = vitalsService.recordForStay(id, stay.patientId(), actor(auth), req);
        return ResponseEntity.ok(toVitalsView(v));
    }

    @GetMapping("/{id}/vitals")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<StayVitalsView>> listVitals(@PathVariable UUID id) {
        return ResponseEntity.ok(vitalsService.forStay(id).stream().map(StayController::toVitalsView).toList());
    }

    // ── Compte-rendu d'hospitalisation PDF (Slice C) ───────────────────

    @GetMapping("/{id}/summary-pdf")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<byte[]> summaryPdf(@PathVariable UUID id) {
        byte[] pdf = pdfService.generate(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"compte-rendu-hospitalisation.pdf\"")
                .body(pdf);
    }
}
