package ma.careplus.pregnancy.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.util.UUID;
import ma.careplus.pregnancy.domain.Presentation;

/**
 * Request body for {@code POST /api/pregnancies/{pregnancyId}/visits}.
 *
 * <p>Vital-sign ranges validated here mirror the OMS thresholds enforced
 * in the service layer (bean validation is the first gate):
 * <ul>
 *   <li>TA systolique : 60–220 mmHg</li>
 *   <li>TA diastolique : 30–140 mmHg</li>
 *   <li>Poids : 30–180 kg</li>
 *   <li>BCF : 100–200 bpm</li>
 *   <li>HU : 5–50 cm</li>
 * </ul>
 *
 * <p>All vital fields are optional because different fields are relevant at
 * different gestational ages (BCF from SA 12, HU from SA 20, MAF from SA 24,
 * presentation from SA 32).
 *
 * @param appointmentId optional — if present and matches a PLANIFIEE visit plan
 *                      within the tolerance window, the plan entry is marked HONOREE.
 * @param consultationId optional — links this visit record to an open consultation.
 * @param urineDipJson optional — JSONB string:
 *     {@code {"glucose":bool,"protein":bool,"leuco":bool,"nitrites":bool,"ketones":bool,"blood":bool}}.
 */
public record RecordVisitRequest(
        UUID appointmentId,
        UUID consultationId,
        @DecimalMin("30.0") @DecimalMax("180.0")
        BigDecimal weightKg,
        @Min(60) @Max(220)
        Integer bpSystolic,
        @Min(30) @Max(140)
        Integer bpDiastolic,
        String urineDipJson,
        @DecimalMin("5.0") @DecimalMax("50.0")
        BigDecimal fundalHeightCm,
        @Min(100) @Max(200)
        Integer fetalHeartRateBpm,
        Boolean fetalMovementsPerceived,
        Presentation presentation,
        String notes
) {}
