package ma.careplus.hospitalization.application;

import java.util.List;
import java.util.UUID;
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

/**
 * Public API du module hospitalisation — référentiel lits (Slice A).
 * Gère le CRUD service → chambre → lit + le tableau des lits.
 */
public interface BedManagementService {

    // ── Services (wards) ───────────────────────────────────────────────
    List<WardView> listWards(boolean includeInactive);
    WardView createWard(CreateWardRequest req);
    WardView updateWard(UUID id, UpdateWardRequest req);
    void deactivateWard(UUID id);

    // ── Chambres (rooms) ───────────────────────────────────────────────
    /** Liste les chambres ; filtre optionnel par service. */
    List<RoomView> listRooms(UUID wardId, boolean includeInactive);
    RoomView createRoom(CreateRoomRequest req);
    RoomView updateRoom(UUID id, UpdateRoomRequest req);
    void deactivateRoom(UUID id);

    // ── Lits (beds) ────────────────────────────────────────────────────
    List<BedView> listBeds(UUID roomId, boolean includeInactive);
    BedView createBed(CreateBedRequest req);
    BedView updateBed(UUID id, UpdateBedRequest req);
    BedView updateBedStatus(UUID id, UpdateBedStatusRequest req);
    void deactivateBed(UUID id);

    // ── Tableau des lits ───────────────────────────────────────────────
    BedBoardView board();
}
