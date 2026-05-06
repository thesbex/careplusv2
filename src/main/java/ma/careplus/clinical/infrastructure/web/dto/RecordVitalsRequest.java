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
 *
 * V030 (B1, 2026-05-06) : ajout de respiratoryRateBpm, abdominalPerimeterCm,
 * headCircumferenceCm. Le formulaire les exposait déjà ; le DTO les omettait
 * silencieusement → données perdues à la persistance.
 */
public record RecordVitalsRequest(
        @Min(20) @Max(300) Integer systolicMmhg,
        @Min(10) @Max(250) Integer diastolicMmhg,
        @DecimalMin("20.0") @DecimalMax("46.0") BigDecimal temperatureC,
        @DecimalMin("0.2") @DecimalMax("500.0") BigDecimal weightKg,
        @DecimalMin("20.0") @DecimalMax("260.0") BigDecimal heightCm,
        @Min(10) @Max(300) Integer heartRateBpm,
        /**
         * Fréquence respiratoire (cycles/min). Plage 0 – 100 : on n'exclut pas
         * les apnées documentées (FR=0 sur un patient à ventiler) ni les
         * tachypnées extrêmes du nourrisson en détresse.
         */
        @Min(0) @Max(100) Integer respiratoryRateBpm,
        @Min(0) @Max(100) Integer spo2Percent,
        @DecimalMin("0.1") @DecimalMax("15.0") BigDecimal glycemiaGPerL,
        /** Périmètre abdominal en cm. Plage très large (0 – 300). */
        @DecimalMin("0.0") @DecimalMax("300.0") BigDecimal abdominalPerimeterCm,
        /**
         * Périmètre crânien en cm. Pédiatrie : nourrisson 30 → adulte 65.
         * Plage 20 – 80 pour rejeter les fautes de frappe sans bloquer les
         * cas extrêmes documentés (microcéphalie, macrocéphalie).
         */
        @DecimalMin("20.0") @DecimalMax("80.0") BigDecimal headCircumferenceCm,
        String notes
) {}
