package ma.careplus.prestation.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.prestation.application.PrestationService;
import ma.careplus.prestation.domain.ConsultationPrestation;
import ma.careplus.prestation.domain.Prestation;
import ma.careplus.prestation.infrastructure.persistence.PrestationRepository;
import ma.careplus.prestation.infrastructure.web.dto.AddPrestationRequest;
import ma.careplus.prestation.infrastructure.web.dto.ConsultationPrestationView;
import ma.careplus.prestation.infrastructure.web.dto.PrestationRequest;
import ma.careplus.prestation.infrastructure.web.dto.PrestationView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints prestations (V016) :
 *   GET    /api/catalog/prestations
 *   POST   /api/catalog/prestations               — admin
 *   PUT    /api/catalog/prestations/{id}          — admin
 *   DELETE /api/catalog/prestations/{id}          — admin (désactive, garde l'historique)
 *
 *   GET    /api/consultations/{id}/prestations
 *   POST   /api/consultations/{id}/prestations    — ajoute une prestation à la consultation
 *   DELETE /api/consultations/{id}/prestations/{linkId}
 *
 * RBAC : la mutation du catalogue est ADMIN/MEDECIN seulement
 * (cohérent avec la perm PRESTATION_ADMIN seedée en V016 :
 * TRUE pour ADMIN/MEDECIN, FALSE pour SECRETAIRE/ASSISTANT).
 * L'ajout sur consultation suit la même règle que les autres
 * mutations cliniques (ASSISTANT/MEDECIN/ADMIN).
 */
@RestController
public class PrestationController {

    private final PrestationService service;
    private final PrestationRepository repository;

    public PrestationController(PrestationService service, PrestationRepository repository) {
        this.service = service;
        this.repository = repository;
    }

    // ── Catalogue ─────────────────────────────────────────────────────────

    @GetMapping("/api/catalog/prestations")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<PrestationView> list(
            @RequestParam(value = "includeInactive", defaultValue = "false") boolean includeInactive) {
        return service.listAll(includeInactive).stream().map(PrestationView::of).toList();
    }

    @GetMapping("/api/catalog/prestations/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public PrestationView get(@PathVariable UUID id) {
        return repository.findById(id).map(PrestationView::of)
                .orElseThrow(() -> new ma.careplus.shared.error.BusinessException(
                        "PRESTATION_NOT_FOUND", "Prestation introuvable.", 404));
    }

    @PostMapping("/api/catalog/prestations")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<PrestationView> create(@Valid @RequestBody PrestationRequest req) {
        Prestation saved = service.create(req);
        return ResponseEntity.created(URI.create("/api/catalog/prestations/" + saved.getId()))
                .body(PrestationView.of(saved));
    }

    @PutMapping("/api/catalog/prestations/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public PrestationView update(@PathVariable UUID id, @Valid @RequestBody PrestationRequest req) {
        return PrestationView.of(service.update(id, req));
    }

    @DeleteMapping("/api/catalog/prestations/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    // ── Consultation × prestation ─────────────────────────────────────────

    @GetMapping("/api/consultations/{consultationId}/prestations")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<ConsultationPrestationView> listForConsultation(@PathVariable UUID consultationId) {
        return service.listForConsultation(consultationId);
    }

    @PostMapping("/api/consultations/{consultationId}/prestations")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<ConsultationPrestationView> addToConsultation(
            @PathVariable UUID consultationId,
            @Valid @RequestBody AddPrestationRequest req) {
        ConsultationPrestation link = service.addToConsultation(consultationId, req);
        Prestation p = repository.findById(link.getPrestationId()).orElseThrow();
        return ResponseEntity.created(URI.create(
                "/api/consultations/" + consultationId + "/prestations/" + link.getId()))
                .body(ConsultationPrestationView.of(link, p.getCode(), p.getLabel()));
    }

    @DeleteMapping("/api/consultations/{consultationId}/prestations/{linkId}")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Void> removeFromConsultation(
            @PathVariable UUID consultationId,
            @PathVariable UUID linkId) {
        service.removeFromConsultation(consultationId, linkId);
        return ResponseEntity.noContent().build();
    }
}
