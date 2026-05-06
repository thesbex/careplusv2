package ma.careplus.clinical.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Vue lecture des constantes cliniques.
 *
 * V030 (B1, 2026-05-06) : expose respiratoryRateBpm, abdominalPerimeterCm,
 * headCircumferenceCm. Avant ce fix, le DTO de réponse oubliait ces 3 champs,
 * donc le frontend (PatientContextCard, SummaryPanel, VitalsEvolutionPanel) ne
 * pouvait pas les afficher même quand ils étaient saisis.
 */
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
        Integer respiratoryRateBpm,
        Integer spo2Percent,
        BigDecimal glycemiaGPerL,
        BigDecimal abdominalPerimeterCm,
        BigDecimal headCircumferenceCm,
        OffsetDateTime recordedAt,
        UUID recordedBy,
        String notes
) {}
