package ma.careplus.clinical.infrastructure.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Bulk-replace : envoie l'ensemble des analytes pour une ligne de
 * prescription. Liste vide = efface tous les résultats (le client peut
 * effacer en passant {@code values: []}).
 */
public record ReplaceResultValuesRequest(
        @NotNull @Valid List<ResultValueInput> values
) {
    public record ResultValueInput(
            @NotEmpty @Size(max = 120) String analyte,
            @NotNull BigDecimal value,
            @Size(max = 40) String unit
    ) {}
}
