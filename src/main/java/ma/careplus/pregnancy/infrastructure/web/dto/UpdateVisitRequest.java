package ma.careplus.pregnancy.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import ma.careplus.pregnancy.domain.Presentation;

/**
 * Request body for {@code PUT /api/pregnancies/visits/{visitId}}.
 *
 * <p>All fields are optional — only non-null values are applied (patch semantics).
 * Update is rejected with 422 CONSULTATION_SIGNED if the linked consultation
 * is already in SIGNEE status.
 */
public record UpdateVisitRequest(
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
