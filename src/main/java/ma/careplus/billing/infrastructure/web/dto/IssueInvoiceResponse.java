package ma.careplus.billing.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record IssueInvoiceResponse(
        UUID id,
        String number,
        BigDecimal netAmount,
        OffsetDateTime issuedAt,
        String pdfUrl
) {}
