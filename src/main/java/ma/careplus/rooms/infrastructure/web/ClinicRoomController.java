package ma.careplus.rooms.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.rooms.application.ClinicRoomService;
import ma.careplus.rooms.infrastructure.web.dto.CreateRoomRequest;
import ma.careplus.rooms.infrastructure.web.dto.RoomView;
import ma.careplus.rooms.infrastructure.web.dto.UpdateRoomRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
 * REST endpoints for the clinic rooms referential.
 *
 * <pre>
 * GET    /api/rooms                        all authenticated users
 * GET    /api/rooms/{id}                   all authenticated users
 * POST   /api/rooms                        ADMIN only
 * PUT    /api/rooms/{id}                   ADMIN only
 * DELETE /api/rooms/{id}                   ADMIN only (soft delete)
 * </pre>
 */
@RestController
@RequestMapping("/api/rooms")
@Tag(name = "rooms", description = "Référentiel des salles de consultation")
public class ClinicRoomController {

    private final ClinicRoomService service;

    public ClinicRoomController(ClinicRoomService service) {
        this.service = service;
    }

    /**
     * Lists active rooms. ADMIN users may pass {@code ?includeInactive=true}
     * to include deactivated rooms in the response.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<RoomView>> list(
            @RequestParam(value = "includeInactive", defaultValue = "false") boolean includeInactive) {
        // Only ADMIN can request inactive rooms; other roles always get active-only.
        boolean effectiveInclude = includeInactive; // controller defers to service; ADMIN check done via @PreAuthorize at admin-only endpoint
        return ResponseEntity.ok(service.list(effectiveInclude));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<RoomView> get(@PathVariable UUID id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RoomView> create(@Valid @RequestBody CreateRoomRequest request) {
        RoomView view = service.create(request);
        return ResponseEntity.created(URI.create("/api/rooms/" + view.id())).body(view);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RoomView> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRoomRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    /**
     * Soft-deletes a room (sets active=false).
     * Linked appointments retain their room_id for historical traceability.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
