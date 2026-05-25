package ma.careplus.hospitalization.application;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.hospitalization.domain.Bed;
import ma.careplus.hospitalization.domain.Room;
import ma.careplus.hospitalization.domain.Ward;
import ma.careplus.hospitalization.infrastructure.persistence.BedRepository;
import ma.careplus.hospitalization.infrastructure.persistence.RoomRepository;
import ma.careplus.hospitalization.infrastructure.persistence.WardRepository;
import ma.careplus.hospitalization.infrastructure.web.dto.BedBoardView;
import ma.careplus.hospitalization.infrastructure.web.dto.BedBoardView.RoomBoard;
import ma.careplus.hospitalization.infrastructure.web.dto.BedBoardView.WardBoard;
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
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BedManagementServiceImpl implements BedManagementService {

    private final WardRepository wardRepo;
    private final RoomRepository roomRepo;
    private final BedRepository bedRepo;

    public BedManagementServiceImpl(WardRepository wardRepo, RoomRepository roomRepo, BedRepository bedRepo) {
        this.wardRepo = wardRepo;
        this.roomRepo = roomRepo;
        this.bedRepo = bedRepo;
    }

    // ── Services (wards) ───────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<WardView> listWards(boolean includeInactive) {
        List<Ward> wards = includeInactive
                ? wardRepo.findAll().stream()
                        .sorted(java.util.Comparator.comparing(Ward::getLabelFr, String.CASE_INSENSITIVE_ORDER))
                        .toList()
                : wardRepo.findAllByActiveTrueOrderByLabelFrAsc();
        return wards.stream().map(this::toView).toList();
    }

    @Override
    public WardView createWard(CreateWardRequest req) {
        if (wardRepo.existsByCodeIgnoreCaseAndActiveTrue(req.code())) {
            throw new BusinessException("WARD_CODE_DUPLICATE",
                    "Un service actif porte déjà ce code : " + req.code(), 409);
        }
        Ward w = new Ward();
        w.setCode(req.code());
        w.setLabelFr(req.labelFr());
        w.setActive(true);
        return toView(wardRepo.save(w));
    }

    @Override
    public WardView updateWard(UUID id, UpdateWardRequest req) {
        Ward w = wardRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("WARD_NOT_FOUND", "Service introuvable : " + id));
        if (!w.getCode().equalsIgnoreCase(req.code())
                && wardRepo.existsByCodeIgnoreCaseAndActiveTrue(req.code())) {
            throw new BusinessException("WARD_CODE_DUPLICATE",
                    "Un service actif porte déjà ce code : " + req.code(), 409);
        }
        w.setCode(req.code());
        w.setLabelFr(req.labelFr());
        if (req.active() != null) w.setActive(req.active());
        return toView(w);
    }

    @Override
    public void deactivateWard(UUID id) {
        Ward w = wardRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("WARD_NOT_FOUND", "Service introuvable : " + id));
        if (roomRepo.existsByWardIdAndActiveTrue(id)) {
            throw new BusinessException("WARD_HAS_ROOMS",
                    "Impossible de désactiver un service contenant des chambres actives.", 409);
        }
        w.setActive(false);
    }

    // ── Chambres (rooms) ───────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<RoomView> listRooms(UUID wardId, boolean includeInactive) {
        List<Room> rooms;
        if (wardId != null) {
            rooms = roomRepo.findAllByWardIdAndActiveTrueOrderByCodeAsc(wardId);
        } else if (includeInactive) {
            rooms = roomRepo.findAll().stream()
                    .sorted(java.util.Comparator.comparing(Room::getCode, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        } else {
            rooms = roomRepo.findAllByActiveTrueOrderByCodeAsc();
        }
        return rooms.stream().map(this::toView).toList();
    }

    @Override
    public RoomView createRoom(CreateRoomRequest req) {
        requireActiveWard(req.wardId());
        if (roomRepo.existsByCodeIgnoreCaseAndActiveTrue(req.code())) {
            throw new BusinessException("ROOM_CODE_DUPLICATE",
                    "Une chambre active porte déjà ce code : " + req.code(), 409);
        }
        Room r = new Room();
        r.setWardId(req.wardId());
        r.setCode(req.code());
        r.setLabelFr(req.labelFr());
        r.setRoomClass(req.roomClass());
        r.setDailyRate(req.dailyRate());
        r.setActive(true);
        return toView(roomRepo.save(r));
    }

    @Override
    public RoomView updateRoom(UUID id, UpdateRoomRequest req) {
        Room r = roomRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("ROOM_NOT_FOUND", "Chambre introuvable : " + id));
        if (!r.getCode().equalsIgnoreCase(req.code())
                && roomRepo.existsByCodeIgnoreCaseAndActiveTrue(req.code())) {
            throw new BusinessException("ROOM_CODE_DUPLICATE",
                    "Une chambre active porte déjà ce code : " + req.code(), 409);
        }
        r.setCode(req.code());
        r.setLabelFr(req.labelFr());
        r.setRoomClass(req.roomClass());
        r.setDailyRate(req.dailyRate());
        if (req.active() != null) r.setActive(req.active());
        return toView(r);
    }

    @Override
    public void deactivateRoom(UUID id) {
        Room r = roomRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("ROOM_NOT_FOUND", "Chambre introuvable : " + id));
        if (bedRepo.existsByRoomIdAndActiveTrue(id)) {
            throw new BusinessException("ROOM_HAS_BEDS",
                    "Impossible de désactiver une chambre contenant des lits actifs.", 409);
        }
        r.setActive(false);
    }

    // ── Lits (beds) ────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<BedView> listBeds(UUID roomId, boolean includeInactive) {
        List<Bed> beds;
        if (roomId != null) {
            beds = bedRepo.findAllByRoomIdAndActiveTrueOrderByCodeAsc(roomId);
        } else if (includeInactive) {
            beds = bedRepo.findAll().stream()
                    .sorted(java.util.Comparator.comparing(Bed::getCode, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        } else {
            beds = bedRepo.findAllByActiveTrueOrderByCodeAsc();
        }
        return beds.stream().map(this::toView).toList();
    }

    @Override
    public BedView createBed(CreateBedRequest req) {
        requireActiveRoom(req.roomId());
        if (bedRepo.existsByRoomIdAndCodeIgnoreCaseAndActiveTrue(req.roomId(), req.code())) {
            throw new BusinessException("BED_CODE_DUPLICATE",
                    "Un lit actif de cette chambre porte déjà ce code : " + req.code(), 409);
        }
        Bed b = new Bed();
        b.setRoomId(req.roomId());
        b.setCode(req.code());
        b.setStatus("LIBRE");
        b.setActive(true);
        return toView(bedRepo.save(b));
    }

    @Override
    public BedView updateBed(UUID id, UpdateBedRequest req) {
        Bed b = bedRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("BED_NOT_FOUND", "Lit introuvable : " + id));
        if (!b.getCode().equalsIgnoreCase(req.code())
                && bedRepo.existsByRoomIdAndCodeIgnoreCaseAndActiveTrue(b.getRoomId(), req.code())) {
            throw new BusinessException("BED_CODE_DUPLICATE",
                    "Un lit actif de cette chambre porte déjà ce code : " + req.code(), 409);
        }
        b.setCode(req.code());
        if (req.active() != null) b.setActive(req.active());
        return toView(b);
    }

    @Override
    public BedView updateBedStatus(UUID id, UpdateBedStatusRequest req) {
        Bed b = bedRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("BED_NOT_FOUND", "Lit introuvable : " + id));
        // OCCUPE est dérivé d'un séjour actif (Slice B) — jamais posé à la main.
        // Le DTO restreint déjà aux statuts manuels, garde défensive ici.
        if ("OCCUPE".equals(req.status())) {
            throw new BusinessException("BED_STATUS_DERIVED",
                    "Le statut OCCUPE est déterminé par l'occupation, pas modifiable manuellement.", 422);
        }
        b.setStatus(req.status());
        return toView(b);
    }

    @Override
    public void deactivateBed(UUID id) {
        Bed b = bedRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("BED_NOT_FOUND", "Lit introuvable : " + id));
        b.setActive(false);
    }

    // ── Tableau des lits ───────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public BedBoardView board() {
        List<Ward> wards = wardRepo.findAllByActiveTrueOrderByLabelFrAsc();
        // Bulk-load active rooms + beds once, group in memory (évite N+1 — pattern ADR-026).
        Map<UUID, List<Room>> roomsByWard = roomRepo.findAllByActiveTrueOrderByCodeAsc().stream()
                .collect(Collectors.groupingBy(Room::getWardId));
        Map<UUID, List<Bed>> bedsByRoom = bedRepo.findAllByActiveTrueOrderByCodeAsc().stream()
                .collect(Collectors.groupingBy(Bed::getRoomId));

        List<WardBoard> wardBoards = wards.stream().map(w -> {
            List<RoomBoard> roomBoards = roomsByWard.getOrDefault(w.getId(), List.of()).stream()
                    .map(r -> new RoomBoard(
                            r.getId(), r.getCode(), r.getLabelFr(), r.getRoomClass(), r.getDailyRate(),
                            bedsByRoom.getOrDefault(r.getId(), List.of()).stream().map(this::toView).toList()))
                    .toList();
            return new WardBoard(w.getId(), w.getCode(), w.getLabelFr(), roomBoards);
        }).toList();
        return new BedBoardView(wardBoards);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private void requireActiveWard(UUID wardId) {
        Ward w = wardRepo.findById(wardId)
                .orElseThrow(() -> new NotFoundException("WARD_NOT_FOUND", "Service introuvable : " + wardId));
        if (!w.isActive()) {
            throw new BusinessException("WARD_INACTIVE",
                    "Service désactivé : impossible d'y rattacher une chambre.", 409);
        }
    }

    private void requireActiveRoom(UUID roomId) {
        Room r = roomRepo.findById(roomId)
                .orElseThrow(() -> new NotFoundException("ROOM_NOT_FOUND", "Chambre introuvable : " + roomId));
        if (!r.isActive()) {
            throw new BusinessException("ROOM_INACTIVE",
                    "Chambre désactivée : impossible d'y rattacher un lit.", 409);
        }
    }

    private WardView toView(Ward w) {
        return new WardView(w.getId(), w.getCode(), w.getLabelFr(), w.isActive());
    }

    private RoomView toView(Room r) {
        return new RoomView(r.getId(), r.getWardId(), r.getCode(), r.getLabelFr(),
                r.getRoomClass(), r.getDailyRate(), r.isActive());
    }

    private BedView toView(Bed b) {
        return new BedView(b.getId(), b.getRoomId(), b.getCode(), b.getStatus(), b.isActive());
    }
}
