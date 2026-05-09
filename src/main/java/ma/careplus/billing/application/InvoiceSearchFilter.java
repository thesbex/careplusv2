package ma.careplus.billing.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.billing.domain.InvoiceStatus;
import ma.careplus.billing.domain.PaymentMode;

/**
 * Filter values for {@link InvoiceSpecifications}. All fields nullable / empty-list-friendly.
 * {@code dateField} controls which timestamp the {@code from}/{@code to} range applies to:
 * {@code ISSUED} → {@code billing_invoice.issued_at}, {@code PAID} → EXISTS on
 * {@code billing_payment.received_at}.
 *
 * <p>{@code medecinId} : filtre multi-praticien. Sémantique « médecin de la facture » =
 * praticien de la consultation liée si {@code consultation_id} non null,
 * sinon praticien du RDV lié.
 */
public record InvoiceSearchFilter(
        DateField dateField,
        LocalDate from,
        LocalDate to,
        List<InvoiceStatus> statuses,
        List<PaymentMode> paymentModes,
        UUID patientId,
        BigDecimal amountMin,
        BigDecimal amountMax,
        UUID medecinId) {

    public enum DateField { ISSUED, PAID }

    public static InvoiceSearchFilter empty() {
        return new InvoiceSearchFilter(DateField.ISSUED, null, null, List.of(), List.of(), null, null, null, null);
    }
}
