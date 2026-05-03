package ma.careplus.caisse.infrastructure.web.dto;

import java.math.BigDecimal;
import ma.careplus.billing.domain.PaymentMode;

public record CaisseModeAmount(
        PaymentMode mode,
        BigDecimal amount,
        long count
) {}
