package ma.careplus.hospitalization.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.application.StayPrestationService;
import ma.careplus.hospitalization.infrastructure.web.dto.StayPrestationRequests.AddPrestationRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayPrestationView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Prestations de séjour : actes/services supplémentaires facturés en sus du prix de journée.
 *
 * <pre>
 * POST   /api/hospitalization/stays/{stayId}/prestations            ajouter une prestation
 * GET    /api/hospitalization/stays/{stayId}/prestations            lister les prestations
 * DELETE /api/hospitalization/stays/{stayId}/prestations/{id}       supprimer (si non facturé)
 * </pre>
 */
@RestController
@RequestMapping("/api/hospitalization/stays/{stayId}/prestations")
@Tag(name = "hospitalization-stays", description = "Prestations de séjour hospitalier")
public class StayPrestationController {

    /** Même RBAC que les actions de gestion de séjour dans StayController. */
    private static final String MANAGE_ROLES =
            "hasAnyRole('SECRETAIRE','INFIRMIER','MEDECIN','ADMIN')";
    private static final String READ_ROLES =
            "hasAnyRole('SECRETAIRE','ASSISTANT','INFIRMIER','MEDECIN','ADMIN')";

    private final StayPrestationService service;

    public StayPrestationController(StayPrestationService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<StayPrestationView> add(
            @PathVariable UUID stayId,
            @Valid @RequestBody AddPrestationRequest req,
            Authentication auth) {
        StayPrestationView view = service.add(stayId, req, actor(auth));
        return ResponseEntity
                .created(URI.create("/api/hospitalization/stays/" + stayId + "/prestations/" + view.id()))
                .body(view);
    }

    @GetMapping
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<StayPrestationView>> list(@PathVariable UUID stayId) {
        return ResponseEntity.ok(service.list(stayId));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<Void> delete(
            @PathVariable UUID stayId,
            @PathVariable UUID id,
            Authentication auth) {
        service.delete(stayId, id);
        return ResponseEntity.noContent().build();
    }

    private static UUID actor(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
