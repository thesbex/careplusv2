package ma.careplus.confrere.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.confrere.application.LetterTemplateService;
import ma.careplus.confrere.infrastructure.web.dto.LetterTemplateView;
import ma.careplus.confrere.infrastructure.web.dto.LetterTemplateWriteRequest;
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
 * CRUD des modèles de courrier confrère.
 * <pre>
 *   GET    /api/confrere-letter-templates          MEDECIN+ADMIN (liste active pour MEDECIN, tout pour ADMIN)
 *   GET    /api/confrere-letter-templates/{id}     MEDECIN+ADMIN
 *   POST   /api/confrere-letter-templates          ADMIN
 *   PUT    /api/confrere-letter-templates/{id}     ADMIN
 *   DELETE /api/confrere-letter-templates/{id}     ADMIN (soft-delete)
 * </pre>
 */
@RestController
@RequestMapping("/api/confrere-letter-templates")
@Tag(name = "Courrier confrère", description = "Bibliothèque de modèles de courrier confrère (admin-managed).")
public class LetterTemplateController {

    private final LetterTemplateService service;

    public LetterTemplateController(LetterTemplateService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<LetterTemplateView> list(Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return service.list(isAdmin);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public LetterTemplateView get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LetterTemplateView> create(
            @Valid @RequestBody LetterTemplateWriteRequest req,
            Authentication auth) {
        UUID createdBy = UUID.fromString(auth.getName());
        LetterTemplateView created = service.create(req, createdBy);
        return ResponseEntity
                .created(URI.create("/api/confrere-letter-templates/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public LetterTemplateView update(
            @PathVariable UUID id,
            @Valid @RequestBody LetterTemplateWriteRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
