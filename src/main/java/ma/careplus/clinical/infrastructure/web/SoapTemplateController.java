package ma.careplus.clinical.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.application.SoapTemplateService;
import ma.careplus.clinical.infrastructure.web.dto.SoapTemplateView;
import ma.careplus.clinical.infrastructure.web.dto.SoapTemplateWriteRequest;
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
import org.springframework.web.bind.annotation.RestController;

/**
 * CRUD des modèles de consultation SOAP, privés au médecin (practitioner_id du JWT).
 */
@RestController
@RequestMapping("/api/soap-templates")
public class SoapTemplateController {

    private final SoapTemplateService service;

    public SoapTemplateController(SoapTemplateService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<SoapTemplateView> list(Authentication auth) {
        return service.list(currentPractitioner(auth));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public SoapTemplateView get(@PathVariable UUID id, Authentication auth) {
        return service.get(id, currentPractitioner(auth));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<SoapTemplateView> create(
            @Valid @RequestBody SoapTemplateWriteRequest req, Authentication auth) {
        SoapTemplateView created = service.create(currentPractitioner(auth), req);
        return ResponseEntity.created(URI.create("/api/soap-templates/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public SoapTemplateView update(
            @PathVariable UUID id, @Valid @RequestBody SoapTemplateWriteRequest req, Authentication auth) {
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
