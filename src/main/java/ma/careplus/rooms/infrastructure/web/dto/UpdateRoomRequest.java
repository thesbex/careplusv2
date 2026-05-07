package ma.careplus.rooms.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Command DTO for updating an existing clinic room.
 * {@code active} allows reactivating a deactivated room via PUT.
 */
public record UpdateRoomRequest(
        @NotBlank @Size(max = 80) String name,
        List<String> capabilityTags,
        Boolean active
) {}
