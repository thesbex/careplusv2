package ma.careplus.catalog.infrastructure.web.dto;

import java.util.UUID;

public record ActResponse(
        UUID id,
        String name,
        String description,
        Integer defaultDurationMinutes,
        String type,
        boolean active
) {}
