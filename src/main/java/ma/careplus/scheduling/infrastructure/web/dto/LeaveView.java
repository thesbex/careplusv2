package ma.careplus.scheduling.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.UUID;

public record LeaveView(
        UUID id,
        LocalDate startDate,
        LocalDate endDate,
        String reason
) {}
