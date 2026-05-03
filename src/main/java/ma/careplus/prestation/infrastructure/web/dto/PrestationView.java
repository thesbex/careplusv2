package ma.careplus.prestation.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.UUID;
import ma.careplus.prestation.domain.Prestation;

public record PrestationView(
        UUID id,
        String code,
        String label,
        BigDecimal defaultPrice,
        boolean active,
        int sortOrder
) {
    public static PrestationView of(Prestation p) {
        return new PrestationView(p.getId(), p.getCode(), p.getLabel(),
                p.getDefaultPrice(), p.isActive(), p.getSortOrder());
    }
}
