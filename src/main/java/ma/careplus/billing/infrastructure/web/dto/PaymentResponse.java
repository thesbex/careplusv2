package ma.careplus.billing.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.billing.domain.PaymentMode;

public record PaymentResponse(
        UUID id,
        BigDecimal amount,
        PaymentMode mode,
        String reference,
        OffsetDateTime paidAt
) {}
