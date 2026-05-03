package ma.careplus.stock.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.identity.infrastructure.persistence.UserRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.stock.application.StockMovementService;
import ma.careplus.stock.domain.StockMovement;
import ma.careplus.stock.domain.StockMovementType;
import ma.careplus.stock.infrastructure.web.dto.PerformedByView;
import ma.careplus.stock.infrastructure.web.dto.StockMovementView;
import ma.careplus.stock.infrastructure.web.dto.StockMovementWriteRequest;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Stock movement endpoints.
 *
 * POST /api/stock/articles/{id}/movements — RBAC per type (see below)
 * GET  /api/stock/articles/{id}/movements — tous les rôles authentifiés (paginated)
 *
 * RBAC:
 * - IN:         SECRETAIRE / ASSISTANT / MEDECIN / ADMIN
 * - OUT:        ASSISTANT / MEDECIN / ADMIN  (SECRETAIRE → 403)
 * - ADJUSTMENT: SECRETAIRE / ASSISTANT / MEDECIN / ADMIN
 */
@RestController
@RequestMapping("/api/stock/articles/{articleId}/movements")
@Tag(name = "stock", description = "Module stock interne — mouvements")
public class StockMovementController {

    private final StockMovementService movementService;
    private final UserRepository userRepository;

    public StockMovementController(StockMovementService movementService,
                                   UserRepository userRepository) {
        this.movementService = movementService;
        this.userRepository = userRepository;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<?> recordMovement(
            @PathVariable UUID articleId,
            @Valid @RequestBody StockMovementWriteRequest req,
            Authentication auth) {

        // SECRETAIRE cannot do OUT
        if (req.type() == StockMovementType.OUT) {
            boolean isSecretaire = auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .anyMatch("ROLE_SECRETAIRE"::equals);
            if (isSecretaire) {
                throw new BusinessException("FORBIDDEN",
                        "La secrétaire ne peut pas enregistrer une sortie de stock.", 403);
            }
        }

        UUID userId = resolveUserId(auth);

        switch (req.type()) {
            case IN -> {
                StockMovement movement = movementService.recordIn(
                        articleId, req.quantity(), req.lotNumber(), req.expiresOn(), userId);
                StockMovementView view = toView(movement);
                return ResponseEntity.created(URI.create(
                        "/api/stock/articles/" + articleId + "/movements/" + movement.getId()))
                        .body(view);
            }
            case OUT -> {
                List<StockMovement> movements = movementService.recordOut(articleId, req.quantity(), userId);
                List<StockMovementView> views = movements.stream().map(this::toView).toList();
                // Returns 201 with list (may be multiple rows for FIFO split)
                return ResponseEntity.status(201).body(views);
            }
            case ADJUSTMENT -> {
                StockMovement movement = movementService.recordAdjustment(
                        articleId, req.quantity(), req.reason(), userId);
                StockMovementView view = toView(movement);
                return ResponseEntity.created(URI.create(
                        "/api/stock/articles/" + articleId + "/movements/" + movement.getId()))
                        .body(view);
            }
            default -> throw new BusinessException("INVALID_MOVEMENT_TYPE",
                    "Type de mouvement inconnu : " + req.type(), 400);
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public PageView<StockMovementView> listMovements(
            @PathVariable UUID articleId,
            @RequestParam(required = false) StockMovementType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        String typeStr = (type != null) ? type.name() : null;
        List<StockMovement> movements = movementService.listMovements(
                articleId, typeStr, from, to, PageRequest.of(page, size));
        long total = movementService.countMovements(articleId, typeStr, from, to);

        List<StockMovementView> views = movements.stream().map(this::toView).toList();
        return PageView.of(views, total, page, size);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private UUID resolveUserId(Authentication auth) {
        // The principal name is the user UUID (set by JwtAuthenticationFilter from JWT sub claim)
        return UUID.fromString(auth.getName());
    }

    private StockMovementView toView(StockMovement m) {
        String name = userRepository.findById(m.getPerformedBy())
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse("Inconnu");
        // For ADJUSTMENT on non-tracking articles, quantity is signed delta.
        // Always show absolute value in the view (sign is implicit from context).
        int displayQty = Math.abs(m.getQuantity());
        return new StockMovementView(
                m.getId(),
                m.getArticleId(),
                m.getLotId(),
                m.getType(),
                displayQty,
                m.getReason(),
                new PerformedByView(m.getPerformedBy(), name),
                m.getPerformedAt()
        );
    }
}
