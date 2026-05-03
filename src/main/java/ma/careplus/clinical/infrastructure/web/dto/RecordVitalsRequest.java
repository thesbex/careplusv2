package ma.careplus.clinical.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;

public record RecordVitalsRequest(
        @Min(40) @Max(260) Integer systolicMmhg,
        @Min(20) @Max(180) Integer diastolicMmhg,
        @DecimalMin("30.0") @DecimalMax("45.0") BigDecimal temperatureC,
        @DecimalMin("0.5") @DecimalMax("400.0") BigDecimal weightKg,
        @DecimalMin("20.0") @DecimalMax("260.0") BigDecimal heightCm,
        @Min(20) @Max(260) Integer heartRateBpm,
        @Min(50) @Max(100) Integer spo2Percent,
        @DecimalMin("0.2") @DecimalMax("8.0") BigDecimal glycemiaGPerL,
        String notes
) {}
