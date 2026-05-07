package ma.careplus.rooms.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.rooms.domain.ClinicRoom;
import ma.careplus.rooms.infrastructure.persistence.ClinicRoomRepository;
import ma.careplus.rooms.infrastructure.web.dto.CreateRoomRequest;
import ma.careplus.rooms.infrastructure.web.dto.RoomView;
import ma.careplus.rooms.infrastructure.web.dto.UpdateRoomRequest;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ClinicRoomServiceImpl implements ClinicRoomService {

    private final ClinicRoomRepository repository;

    public ClinicRoomServiceImpl(ClinicRoomRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomView> list(boolean includeInactive) {
        List<ClinicRoom> rooms = includeInactive
                ? repository.findAll().stream()
                        .sorted(java.util.Comparator.comparing(ClinicRoom::getName,
                                String.CASE_INSENSITIVE_ORDER))
                        .toList()
                : repository.findAllByActiveTrueOrderByNameAsc();
        return rooms.stream().map(this::toView).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RoomView get(UUID id) {
        ClinicRoom room = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("ROOM_NOT_FOUND",
                        "Salle introuvable : " + id));
        return toView(room);
    }

    @Override
    public RoomView create(CreateRoomRequest request) {
        if (repository.existsByNameIgnoreCaseAndActiveTrue(request.name())) {
            throw new BusinessException("ROOM_NAME_DUPLICATE",
                    "Une salle active porte déjà ce nom : " + request.name(), 409);
        }
        ClinicRoom room = new ClinicRoom();
        room.setName(request.name());
        room.setCapabilityTags(request.capabilityTags());
        room.setActive(true);
        return toView(repository.save(room));
    }

    @Override
    public RoomView update(UUID id, UpdateRoomRequest request) {
        ClinicRoom room = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("ROOM_NOT_FOUND",
                        "Salle introuvable : " + id));

        // Uniqueness check: only conflict if another ACTIVE room (not itself) has the same name
        if (!room.getName().equalsIgnoreCase(request.name())
                && repository.existsByNameIgnoreCaseAndActiveTrue(request.name())) {
            throw new BusinessException("ROOM_NAME_DUPLICATE",
                    "Une salle active porte déjà ce nom : " + request.name(), 409);
        }

        room.setName(request.name());
        room.setCapabilityTags(request.capabilityTags());
        if (request.active() != null) {
            room.setActive(request.active());
        }
        return toView(room);
    }

    @Override
    public void deactivate(UUID id) {
        ClinicRoom room = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("ROOM_NOT_FOUND",
                        "Salle introuvable : " + id));
        room.setActive(false);
        // JPA dirty-checking persists automatically within the transaction
    }

    // ── Mapping ────────────────────────────────────────────────────

    private RoomView toView(ClinicRoom room) {
        return new RoomView(
                room.getId(),
                room.getName(),
                room.getCapabilityTags() != null ? room.getCapabilityTags() : List.of(),
                room.isActive());
    }
}
