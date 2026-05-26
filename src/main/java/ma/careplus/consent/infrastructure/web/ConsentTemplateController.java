package ma.careplus.consent.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.consent.application.ConsentTemplateService;
import ma.careplus.consent.infrastructure.web.dto.ConsentTemplateView;
import ma.careplus.consent.infrastructure.web.dto.ConsentTemplateWriteRequest;
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
 * CRUD des modèles de consentement.
 * <pre>
 *   GET    /api/consent-templates          MEDECIN+ADMIN (liste active pour MEDECIN, tout pour ADMIN)
 *   GET    /api/consent-templates/{id}     MEDECIN+ADMIN
 *   POST   /api/consent-templates          ADMIN
 *   PUT    /api/consent-templates/{id}     ADMIN
 *   DELETE /api/consent-templates/{id}     ADMIN (soft-delete)
 * </pre>
 * QA9-13.
 */
@RestController
@RequestMapping("/api/consent-templates")
@Tag(name = "Consentement", description = "Bibliothèque de modèles de consentement (admin-managed).")
public class ConsentTemplateController {

    private final ConsentTemplateService service;

    public ConsentTemplateController(ConsentTemplateService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<ConsentTemplateView> list(Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return service.list(isAdmin);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ConsentTemplateView get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConsentTemplateView> create(
            @Valid @RequestBody ConsentTemplateWriteRequest req,
            Authentication auth) {
        UUID createdBy = UUID.fromString(auth.getName());
        ConsentTemplateView created = service.create(req, createdBy);
        return ResponseEntity
                .created(URI.create("/api/consent-templates/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ConsentTemplateView update(
            @PathVariable UUID id,
            @Valid @RequestBody ConsentTemplateWriteRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
