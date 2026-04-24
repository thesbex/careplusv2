package ma.careplus.clinical.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record VitalSignsView(
        UUID id,
        UUID patientId,
        UUID appointmentId,
        UUID consultationId,
        Integer systolicMmhg,
        Integer diastolicMmhg,
        BigDecimal temperatureC,
        BigDecimal weightKg,
        BigDecimal heightCm,
        BigDecimal bmi,
        Integer heartRateBpm,
        Integer spo2Percent,
        BigDecimal glycemiaGPerL,
        OffsetDateTime recordedAt,
        UUID recordedBy,
        String notes
) {}
