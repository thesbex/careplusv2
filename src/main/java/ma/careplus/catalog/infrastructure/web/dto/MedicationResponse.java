package ma.careplus.catalog.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record MedicationResponse(
        UUID id,
        String name,
        String molecule,
        String form,
        String strength,
        /**
         * V057 — prix de cession en interne (NULL = pas de prix → non facturable
         * en interne). Exposé au type-ahead pour avertir le prescripteur quand
         * « fournir en interne » est coché sur un médicament sans prix défini.
         */
        BigDecimal internalPrice
) {}
