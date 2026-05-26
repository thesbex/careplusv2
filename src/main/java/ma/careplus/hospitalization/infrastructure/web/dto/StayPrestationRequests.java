package ma.careplus.hospitalization.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

/** Payload pour ajouter une prestation à un séjour. */
public final class StayPrestationRequests {

    private StayPrestationRequests() {}

    public record AddPrestationRequest(
            UUID actId,
            @NotBlank String label,
            @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
            @DecimalMin("0.01") BigDecimal quantity
    ) {}
}
