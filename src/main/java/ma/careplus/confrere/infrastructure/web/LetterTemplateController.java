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
 *   POST   /api/confrere-letter-templates          MEDECIN (privé) + ADMIN (portée libre)
 *   PUT    /api/confrere-letter-templates/{id}     MEDECIN (ses modèles) + ADMIN
 *   DELETE /api/confrere-letter-templates/{id}     MEDECIN (ses modèles) + ADMIN (soft-delete)
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
        if (isAdmin) {
            // L'ADMIN voit tout (cabinet-wide + privés de chaque médecin) pour la gestion.
            return service.list(true);
        }
        // V065 — le MEDECIN ne voit que les modèles partagés + ses modèles privés.
        UUID userId = UUID.fromString(auth.getName());
        return service.listVisibleForUser(userId);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public LetterTemplateView get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<LetterTemplateView> create(
            @Valid @RequestBody LetterTemplateWriteRequest req,
            Authentication auth) {
        LetterTemplateView created = service.create(req, UUID.fromString(auth.getName()), isAdmin(auth));
        return ResponseEntity
                .created(URI.create("/api/confrere-letter-templates/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public LetterTemplateView update(
            @PathVariable UUID id,
            @Valid @RequestBody LetterTemplateWriteRequest req,
            Authentication auth) {
        return service.update(id, req, UUID.fromString(auth.getName()), isAdmin(auth));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        service.delete(id, UUID.fromString(auth.getName()), isAdmin(auth));
        return ResponseEntity.noContent().build();
    }

    private static boolean isAdmin(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
