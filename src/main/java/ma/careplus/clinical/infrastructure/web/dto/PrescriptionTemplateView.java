package ma.careplus.clinical.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PrescriptionTemplateView(
        UUID id,
        String name,
        String type,
        List<Map<String, Object>> lines,
        int lineCount,
        OffsetDateTime updatedAt) {}
