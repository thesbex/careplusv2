package ma.careplus.billing.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import ma.careplus.billing.domain.InvoiceStatus;
import ma.careplus.billing.domain.PaymentMode;

/** Light row used by /search and /export. Distinct from {@link InvoiceResponse} (header + lines). */
public record InvoiceListRow(
        UUID id,
        String number,
        InvoiceStatus status,
        UUID patientId,
        String patientFullName,
        String patientPhone,
        String mutuelleName,
        BigDecimal totalAmount,
        BigDecimal discountAmount,
        BigDecimal netAmount,
        BigDecimal paidAmount,
        Set<PaymentMode> paymentModes,
        OffsetDateTime issuedAt,
        OffsetDateTime lastPaymentAt,
        OffsetDateTime createdAt) {}
