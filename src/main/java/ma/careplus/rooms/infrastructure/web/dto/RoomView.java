package ma.careplus.rooms.infrastructure.web.dto;

import java.util.List;
import java.util.UUID;

/**
 * Read-side projection of a clinic room.
 */
public record RoomView(
        UUID id,
        String name,
        List<String> capabilityTags,
        boolean active
) {}
