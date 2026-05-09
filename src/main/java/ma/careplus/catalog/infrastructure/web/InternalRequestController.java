package ma.careplus.catalog.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.application.InternalRequestService;
import ma.careplus.catalog.application.InternalRequestService.QueueRowMeta;
import ma.careplus.catalog.application.InternalRequestService.Service;
import ma.careplus.catalog.domain.PrescriptionLine;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * V038 — endpoints queue traitements internes (LAB / RADIO).
 *
 * Accès :
 *   • GET /api/internal-requests : LAB+RADIO+MEDECIN+ADMIN. Filtré par service
 *     et statut. Le médecin voit l'état d'avancement de SES propres demandes
 *     (pas filtré pour lui en v1 — toutes les demandes sont visibles).
 *   • POST /{id}/claim : LAB ou RADIO seulement, et uniquement si le rôle
 *     correspond au service de la ligne (LAB ne peut pas claim une ligne
 *     IMAGING). Le médecin peut aussi claim ses propres demandes (utile en
 *     mode solo où il fait l'analyse lui-même).
 *   • POST /{id}/cancel : MEDECIN ou ADMIN seulement.
 */
@RestController
@Tag(name = "internal-requests",
        description = "V038 — traitement interne LAB / IMAGING (queue + transitions)")
public class InternalRequestController {

    private final InternalRequestService service;

    public InternalRequestController(InternalRequestService service) {
        this.service = service;
    }

    public record QueueItemResponse(
            UUID lineId,
            UUID prescriptionId,
            String testName,
            String patientName,
            String doctorName,
            String status,
            OffsetDateTime assignedAt,
            UUID claimedBy
    ) {}

    @GetMapping("/api/internal-requests")
    @PreAuthorize("hasAnyRole('LAB','RADIO','MEDECIN','ADMIN')")
    public List<QueueItemResponse> list(
            @RequestParam("service") String serviceParam,
            @RequestParam(name = "status", defaultValue = "PENDING") String status) {
        Service svc = parseService(serviceParam);
        List<PrescriptionLine> lines = service.listByServiceAndStatus(svc, status);
        return lines.stream().map(this::toResponse).toList();
    }

    @PostMapping("/api/internal-requests/{lineId}/claim")
    @PreAuthorize("hasAnyRole('LAB','RADIO','MEDECIN','ADMIN')")
    public QueueItemResponse claim(@PathVariable UUID lineId, Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        // Vérification croisée : le rôle de l'appelant doit matcher le service
        // de la ligne. Un LAB ne peut pas claim une ligne IMAGING (et vice-versa).
        // MEDECIN/ADMIN sont autorisés sur tout (mode solo / supervision).
        PrescriptionLine claimed = service.claim(lineId, userId);
        Service svc = InternalRequestService.serviceOf(claimed);
        if (!hasMatchingRoleOrPrivileged(auth, svc)) {
            // Rollback transactionnel : on lève BusinessException qui sera
            // mappée 403 PERMISSION_DENIED. La transaction est annulée par
            // Spring → le claim ne persiste pas.
            throw new BusinessException(
                    "INT-WRONG-SERVICE",
                    "Vous ne pouvez pas prendre en charge une demande de l'autre service.",
                    HttpStatus.FORBIDDEN.value());
        }
        return toResponse(claimed);
    }

    @PostMapping("/api/internal-requests/{lineId}/cancel")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public QueueItemResponse cancel(@PathVariable UUID lineId) {
        return toResponse(service.cancel(lineId));
    }

    private QueueItemResponse toResponse(PrescriptionLine line) {
        QueueRowMeta meta = service.fetchQueueRowMeta(line);
        String testName = service.fetchTestName(line);
        return new QueueItemResponse(
                line.getId(),
                meta.prescriptionId(),
                testName,
                meta.patientName(),
                meta.doctorName(),
                line.getInternalStatus(),
                line.getInternalAssignedAt(),
                line.getInternalClaimedBy());
    }

    private static Service parseService(String s) {
        try {
            return Service.valueOf(s.toUpperCase());
        } catch (Exception e) {
            throw new BusinessException(
                    "INT-INVALID-SERVICE",
                    "Service invalide. Attendu : LAB ou RADIO.",
                    HttpStatus.BAD_REQUEST.value());
        }
    }

    /** True si l'utilisateur a un rôle compatible avec le service ciblé. */
    private static boolean hasMatchingRoleOrPrivileged(Authentication auth, Service svc) {
        if (auth == null) return false;
        boolean hasMedOrAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_MEDECIN".equals(a.getAuthority())
                        || "ROLE_ADMIN".equals(a.getAuthority()));
        if (hasMedOrAdmin) return true;
        if (svc == Service.LAB) {
            return auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_LAB".equals(a.getAuthority()));
        }
        if (svc == Service.RADIO) {
            return auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_RADIO".equals(a.getAuthority()));
        }
        return false;
    }
}
