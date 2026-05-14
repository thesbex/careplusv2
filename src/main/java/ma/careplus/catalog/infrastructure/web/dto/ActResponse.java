package ma.careplus.catalog.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ActResponse(
        UUID id,
        String name,
        String description,
        Integer defaultDurationMinutes,
        String type,
        boolean active,
        /** V040 — billable code for the act (e.g. CONS_GEN). Useful to the onboarding wizard. */
        String code,
        /** V040 — default price in MAD before insurance/tiers. */
        BigDecimal defaultPrice,
        /** V041 — eligible for CNOPS tiers-payant. */
        boolean cnopsEligible,
        /** V041 — eligible for CNSS. */
        boolean cnssEligible,
        /** V041 — eligible for RAMED. */
        boolean ramedEligible
) {
    /** Back-compat constructor for callers that don't yet know about V040/V041. */
    public ActResponse(UUID id, String name, String description, Integer defaultDurationMinutes,
                       String type, boolean active) {
        this(id, name, description, defaultDurationMinutes, type, active,
                null, null, false, false, false);
    }
}

