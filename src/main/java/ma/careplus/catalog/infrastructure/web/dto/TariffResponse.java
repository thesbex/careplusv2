package ma.careplus.catalog.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TariffResponse(
        UUID id,
        UUID actId,
        String tier,
        BigDecimal amount,
        LocalDate effectiveFrom,
        LocalDate effectiveTo
) {}
