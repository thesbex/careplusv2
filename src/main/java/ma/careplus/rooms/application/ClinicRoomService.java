package ma.careplus.rooms.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.rooms.infrastructure.web.dto.CreateRoomRequest;
import ma.careplus.rooms.infrastructure.web.dto.RoomView;
import ma.careplus.rooms.infrastructure.web.dto.UpdateRoomRequest;

/**
 * Public API of the rooms module.
 * Controllers inject this interface — never the implementation directly.
 */
public interface ClinicRoomService {

    /** Lists rooms, ordered by name. Pass {@code includeInactive=true} to include deactivated rooms. */
    List<RoomView> list(boolean includeInactive);

    /** Gets a single room by id. Throws 404 if not found (regardless of active status). */
    RoomView get(UUID id);

    /** Creates a new active room. Throws 409 if another active room has the same name (case-insensitive). */
    RoomView create(CreateRoomRequest request);

    /**
     * Updates name, tags, and/or active flag on an existing room.
     * Throws 404 if not found. Throws 409 if the new name duplicates another active room.
     */
    RoomView update(UUID id, UpdateRoomRequest request);

    /**
     * Soft-deletes a room (sets active=false).
     * Linked appointments are preserved — room_id is kept on historical records.
     * Idempotent if already inactive.
     */
    void deactivate(UUID id);
}
