package ma.careplus.prestation.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Ajoute une prestation à une consultation. Si `unitPrice` est null on
 * snape le `default_price` du catalogue ; sinon on prend la valeur
 * fournie (le médecin peut la surcharger ponctuellement).
 */
public record AddPrestationRequest(
        @NotNull UUID prestationId,
        /** Override optionnel du tarif. Null = on prend defaultPrice. */
        @DecimalMin("0.0") BigDecimal unitPrice,
        @Min(1) Integer quantity,
        String notes
) {}
