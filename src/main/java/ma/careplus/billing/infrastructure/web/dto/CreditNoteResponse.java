package ma.careplus.billing.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreditNoteResponse(
        UUID creditNoteId,
        UUID originalInvoiceId,
        BigDecimal amount,
        String reason,
        OffsetDateTime issuedAt
) {}
