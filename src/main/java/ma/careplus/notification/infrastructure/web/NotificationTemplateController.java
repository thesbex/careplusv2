package ma.careplus.notification.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.notification.application.NotificationTemplateService;
import ma.careplus.notification.infrastructure.web.dto.NotificationTemplateView;
import ma.careplus.notification.infrastructure.web.dto.NotificationTemplateWriteRequest;
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
 * CRUD des modèles de notification (contenu paramétrable des messages).
 * Réservé à l'ADMIN.
 */
@RestController
@RequestMapping("/api/notification-templates")
@Tag(name = "Notifications", description = "Modèles de messages de notification (admin-managed).")
@PreAuthorize("hasRole('ADMIN')")
public class NotificationTemplateController {

    private final NotificationTemplateService service;

    public NotificationTemplateController(NotificationTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationTemplateView> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public NotificationTemplateView get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    public ResponseEntity<NotificationTemplateView> create(
            @Valid @RequestBody NotificationTemplateWriteRequest req, Authentication auth) {
        UUID createdBy = UUID.fromString(auth.getName());
        NotificationTemplateView created = service.create(req, createdBy);
        return ResponseEntity.created(URI.create("/api/notification-templates/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public NotificationTemplateView update(
            @PathVariable UUID id, @Valid @RequestBody NotificationTemplateWriteRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
