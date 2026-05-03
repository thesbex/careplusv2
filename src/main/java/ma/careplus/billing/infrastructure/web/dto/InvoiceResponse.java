package ma.careplus.billing.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.billing.domain.InvoiceStatus;

public record InvoiceResponse(
        UUID id,
        UUID patientId,
        UUID consultationId,
        InvoiceStatus status,
        String number,
        BigDecimal totalAmount,
        BigDecimal discountAmount,
        BigDecimal netAmount,
        List<InvoiceLineResponse> lines,
        List<PaymentResponse> payments,
        String mutuelleInsuranceName,
        OffsetDateTime issuedAt,
        OffsetDateTime createdAt
) {}
