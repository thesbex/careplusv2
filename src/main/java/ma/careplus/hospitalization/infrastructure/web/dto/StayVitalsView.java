package ma.careplus.hospitalization.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Constantes saisies pendant un séjour (vue locale hospitalisation). */
public record StayVitalsView(
        UUID id,
        Integer systolicMmhg,
        Integer diastolicMmhg,
        BigDecimal temperatureC,
        BigDecimal weightKg,
        Integer heartRateBpm,
        Integer spo2Percent,
        BigDecimal glycemiaGPerL,
        String notes,
        OffsetDateTime recordedAt) {}
