package ma.careplus.billing.application;

import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import ma.careplus.billing.domain.Invoice;
import ma.careplus.billing.domain.Payment;
import ma.careplus.billing.domain.PaymentMode;
import org.springframework.data.jpa.domain.Specification;

/**
 * Builds a JPA {@link Specification} from an {@link InvoiceSearchFilter}.
 *
 * <p>Predicates are AND-combined. Empty/null fields contribute no predicate.
 *
 * <p>The {@code dateField=PAID} branch and the {@code paymentModes} filter both translate
 * to {@code EXISTS} subqueries on {@code billing_payment} so a single invoice with multiple
 * payments matches exactly once.
 *
 * <p>Date bounds are inclusive in the user-facing semantic ("Du 1er au 30 avril").
 * Implemented as {@code [from 00:00, to+1day 00:00)} in TZ Africa/Casablanca.
 */
public final class InvoiceSpecifications {

    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");

    private InvoiceSpecifications() {}

    public static Specification<Invoice> build(InvoiceSearchFilter f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // ── Plage de dates ───────────────────────────────────────────────
            if (f.from() != null || f.to() != null) {
                if (f.dateField() == InvoiceSearchFilter.DateField.PAID) {
                    Subquery<Long> sub = query.subquery(Long.class);
                    Root<Payment> p = sub.from(Payment.class);
                    List<Predicate> subPreds = new ArrayList<>();
                    subPreds.add(cb.equal(p.get("invoiceId"), root.get("id")));
                    if (f.from() != null) {
                        subPreds.add(cb.greaterThanOrEqualTo(p.get("receivedAt"), startOfDay(f.from())));
                    }
                    if (f.to() != null) {
                        subPreds.add(cb.lessThan(p.get("receivedAt"), startOfDay(f.to().plusDays(1))));
                    }
                    sub.select(cb.literal(1L)).where(subPreds.toArray(Predicate[]::new));
                    predicates.add(cb.exists(sub));
                } else {
                    if (f.from() != null) {
                        predicates.add(cb.greaterThanOrEqualTo(root.get("issuedAt"), startOfDay(f.from())));
                    }
                    if (f.to() != null) {
                        predicates.add(cb.lessThan(root.get("issuedAt"), startOfDay(f.to().plusDays(1))));
                    }
                }
            }

            // ── Statuts (multi) ──────────────────────────────────────────────
            if (f.statuses() != null && !f.statuses().isEmpty()) {
                predicates.add(root.get("status").in(f.statuses()));
            }

            // ── Modes de paiement (multi) ────────────────────────────────────
            if (f.paymentModes() != null && !f.paymentModes().isEmpty()) {
                Subquery<Long> sub = query.subquery(Long.class);
                Root<Payment> p = sub.from(Payment.class);
                sub.select(cb.literal(1L)).where(
                        cb.equal(p.get("invoiceId"), root.get("id")),
                        p.<PaymentMode>get("mode").in(f.paymentModes()));
                predicates.add(cb.exists(sub));
            }

            // ── Patient ──────────────────────────────────────────────────────
            if (f.patientId() != null) {
                predicates.add(cb.equal(root.get("patientId"), f.patientId()));
            }

            // ── Montant net ──────────────────────────────────────────────────
            if (f.amountMin() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("netAmount"), f.amountMin()));
            }
            if (f.amountMax() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("netAmount"), f.amountMax()));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static OffsetDateTime startOfDay(LocalDate d) {
        return d.atStartOfDay(CASA).toOffsetDateTime();
    }
}
