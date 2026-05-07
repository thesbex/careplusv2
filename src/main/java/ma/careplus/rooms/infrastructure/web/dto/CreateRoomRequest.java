package ma.careplus.rooms.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Command DTO for creating a new clinic room.
 */
public record CreateRoomRequest(
        @NotBlank @Size(max = 80) String name,
        List<String> capabilityTags
) {}
