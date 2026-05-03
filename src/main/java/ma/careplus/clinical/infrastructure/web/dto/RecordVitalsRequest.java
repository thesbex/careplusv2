package ma.careplus.clinical.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;

/**
 * Bornes volontairement larges : on rejette les fautes de frappe, pas les
 * lectures cliniquement extrêmes (choc, hypothermie, désaturation profonde,
 * hyperglycémie sévère). Un patient en détresse vitale doit pouvoir être
 * enregistré tel quel — c'est précisément à ce moment-là qu'on a besoin
 * d'un dossier fidèle.
 */
public record RecordVitalsRequest(
        @Min(20) @Max(300) Integer systolicMmhg,
        @Min(10) @Max(250) Integer diastolicMmhg,
        @DecimalMin("20.0") @DecimalMax("46.0") BigDecimal temperatureC,
        @DecimalMin("0.2") @DecimalMax("500.0") BigDecimal weightKg,
        @DecimalMin("20.0") @DecimalMax("260.0") BigDecimal heightCm,
        @Min(10) @Max(300) Integer heartRateBpm,
        @Min(0) @Max(100) Integer spo2Percent,
        @DecimalMin("0.1") @DecimalMax("15.0") BigDecimal glycemiaGPerL,
        String notes
) {}
