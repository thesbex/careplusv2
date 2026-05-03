package ma.careplus.scheduling.infrastructure.web.dto;

import java.util.UUID;

public record AppointmentReasonView(
        UUID id,
        String code,
        String label,
        int durationMinutes,
        String colorHex
) {}
