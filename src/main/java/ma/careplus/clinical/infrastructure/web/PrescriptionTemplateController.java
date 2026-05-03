package ma.careplus.clinical.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.application.PrescriptionTemplateService;
import ma.careplus.clinical.infrastructure.web.dto.PrescriptionTemplateView;
import ma.careplus.clinical.infrastructure.web.dto.PrescriptionTemplateWriteRequest;
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

/**
 * QA6-2 + QA6-3 — CRUD des modèles de prescription privés au médecin.
 * Le {@code practitionerId} est dérivé du JWT à chaque requête : un médecin
 * ne peut jamais lire ni modifier un modèle d'un confrère, même par accident.
 */
@RestController
@RequestMapping("/api/prescription-templates")
public class PrescriptionTemplateController {

    private final PrescriptionTemplateService service;

    public PrescriptionTemplateController(PrescriptionTemplateService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<PrescriptionTemplateView> list(@RequestParam String type, Authentication auth) {
        return service.list(currentPractitioner(auth), type);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public PrescriptionTemplateView get(@PathVariable UUID id, Authentication auth) {
        return service.get(id, currentPractitioner(auth));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<PrescriptionTemplateView> create(
            @Valid @RequestBody PrescriptionTemplateWriteRequest req,
            Authentication auth) {
        PrescriptionTemplateView created = service.create(currentPractitioner(auth), req);
        return ResponseEntity.created(URI.create("/api/prescription-templates/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public PrescriptionTemplateView update(
            @PathVariable UUID id,
            @Valid @RequestBody PrescriptionTemplateWriteRequest req,
            Authentication auth) {
        return service.update(id, currentPractitioner(auth), req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        service.delete(id, currentPractitioner(auth));
        return ResponseEntity.noContent().build();
    }

    private static UUID currentPractitioner(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
