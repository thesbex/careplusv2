package ma.careplus.hospitalization.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.hospitalization.application.StayService;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayQueueEntry;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.AdmitRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.DischargeRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.TransferRequest;
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
            "hasAnyRole('SECRETAIRE','INFIRMIER','MEDECIN','ADMIN')";
    private static final String DISCHARGE_ROLES = "hasAnyRole('MEDECIN','ADMIN')";
    private static final String BILL_ROLES = "hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')";

    private final StayService service;

    public StayController(StayService service) {
        this.service = service;
    }

    private static UUID actor(Authentication auth) {
        return UUID.fromString(auth.getName());
    }

    @GetMapping("/queue")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<StayQueueEntry>> queue() {
        return ResponseEntity.ok(service.listActive());
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
}
