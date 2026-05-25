package ma.careplus.hospitalization.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.application.BedManagementService;
import ma.careplus.hospitalization.infrastructure.web.dto.BedBoardView;
import ma.careplus.hospitalization.infrastructure.web.dto.BedRequests.CreateBedRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.BedRequests.UpdateBedRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.BedRequests.UpdateBedStatusRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.BedView;
import ma.careplus.hospitalization.infrastructure.web.dto.RoomRequests.CreateRoomRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.RoomRequests.UpdateRoomRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.RoomView;
import ma.careplus.hospitalization.infrastructure.web.dto.WardRequests.CreateWardRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.WardRequests.UpdateWardRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.WardView;
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
 * Référentiel d'hospitalisation : services (wards), chambres (rooms), lits (beds)
 * + tableau des lits. Slice A — paramétrage uniquement (pas encore de séjour).
 *
 * <pre>
 * Lecture (board, listes)  : SECRETAIRE / ASSISTANT / INFIRMIER / MEDECIN / ADMIN
 * Écriture (CRUD)          : MEDECIN / ADMIN   (gérer le référentiel des lits)
 * Statut manuel de lit     : SECRETAIRE / INFIRMIER / MEDECIN / ADMIN
 * </pre>
 */
@RestController
@RequestMapping("/api/hospitalization")
@Tag(name = "hospitalization", description = "Référentiel lits (services / chambres / lits) + tableau des lits")
public class HospitalizationController {

    private static final String READ_ROLES =
            "hasAnyRole('SECRETAIRE','ASSISTANT','INFIRMIER','MEDECIN','ADMIN')";
    private static final String MANAGE_ROLES = "hasAnyRole('MEDECIN','ADMIN')";
    private static final String BED_STATUS_ROLES =
            "hasAnyRole('SECRETAIRE','INFIRMIER','MEDECIN','ADMIN')";

    private final BedManagementService service;

    public HospitalizationController(BedManagementService service) {
        this.service = service;
    }

    // ── Tableau des lits ───────────────────────────────────────────────

    @GetMapping("/board")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<BedBoardView> board() {
        return ResponseEntity.ok(service.board());
    }

    // ── Services (wards) ───────────────────────────────────────────────

    @GetMapping("/wards")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<WardView>> listWards(
            @RequestParam(value = "includeInactive", defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(service.listWards(includeInactive));
    }

    @PostMapping("/wards")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<WardView> createWard(@Valid @RequestBody CreateWardRequest req) {
        WardView v = service.createWard(req);
        return ResponseEntity.created(URI.create("/api/hospitalization/wards/" + v.id())).body(v);
    }

    @PutMapping("/wards/{id}")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<WardView> updateWard(@PathVariable UUID id, @Valid @RequestBody UpdateWardRequest req) {
        return ResponseEntity.ok(service.updateWard(id, req));
    }

    @DeleteMapping("/wards/{id}")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<Void> deactivateWard(@PathVariable UUID id) {
        service.deactivateWard(id);
        return ResponseEntity.noContent().build();
    }

    // ── Chambres (rooms) ───────────────────────────────────────────────

    @GetMapping("/rooms")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<RoomView>> listRooms(
            @RequestParam(value = "wardId", required = false) UUID wardId,
            @RequestParam(value = "includeInactive", defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(service.listRooms(wardId, includeInactive));
    }

    @PostMapping("/rooms")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<RoomView> createRoom(@Valid @RequestBody CreateRoomRequest req) {
        RoomView v = service.createRoom(req);
        return ResponseEntity.created(URI.create("/api/hospitalization/rooms/" + v.id())).body(v);
    }

    @PutMapping("/rooms/{id}")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<RoomView> updateRoom(@PathVariable UUID id, @Valid @RequestBody UpdateRoomRequest req) {
        return ResponseEntity.ok(service.updateRoom(id, req));
    }

    @DeleteMapping("/rooms/{id}")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<Void> deactivateRoom(@PathVariable UUID id) {
        service.deactivateRoom(id);
        return ResponseEntity.noContent().build();
    }

    // ── Lits (beds) ────────────────────────────────────────────────────

    @GetMapping("/beds")
    @PreAuthorize(READ_ROLES)
    public ResponseEntity<List<BedView>> listBeds(
            @RequestParam(value = "roomId", required = false) UUID roomId,
            @RequestParam(value = "includeInactive", defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(service.listBeds(roomId, includeInactive));
    }

    @PostMapping("/beds")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<BedView> createBed(@Valid @RequestBody CreateBedRequest req) {
        BedView v = service.createBed(req);
        return ResponseEntity.created(URI.create("/api/hospitalization/beds/" + v.id())).body(v);
    }

    @PutMapping("/beds/{id}")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<BedView> updateBed(@PathVariable UUID id, @Valid @RequestBody UpdateBedRequest req) {
        return ResponseEntity.ok(service.updateBed(id, req));
    }

    /** Toggle d'état manuel du lit (LIBRE / RESERVE / NETTOYAGE / HORS_SERVICE). */
    @PutMapping("/beds/{id}/status")
    @PreAuthorize(BED_STATUS_ROLES)
    public ResponseEntity<BedView> updateBedStatus(
            @PathVariable UUID id, @Valid @RequestBody UpdateBedStatusRequest req) {
        return ResponseEntity.ok(service.updateBedStatus(id, req));
    }

    @DeleteMapping("/beds/{id}")
    @PreAuthorize(MANAGE_ROLES)
    public ResponseEntity<Void> deactivateBed(@PathVariable UUID id) {
        service.deactivateBed(id);
        return ResponseEntity.noContent().build();
    }
}
