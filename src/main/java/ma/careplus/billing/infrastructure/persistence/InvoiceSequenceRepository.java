package ma.careplus.billing.infrastructure.persistence;

import java.time.Year;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Atomic sequential number assignment for invoices.
 * Uses SELECT ... FOR UPDATE on billing_invoice_sequence to guarantee
 * strictly monotonic, gap-free numbering even under concurrent requests.
 * ADR-011: must run inside caller's transaction or a REQUIRES_NEW if called from
 * AFTER_COMMIT listener context.
 */
@Repository
public class InvoiceSequenceRepository {

    private final JdbcTemplate jdbc;

    public InvoiceSequenceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Returns the next formatted invoice number for the current year.
     * Format: YYYY-NNNNNN (e.g. 2026-000001).
     * Must be called inside an active transaction (caller's responsibility).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String nextInvoiceNumber() {
        int year = Year.now().getValue();

        // Upsert sequence row for this year, then lock it
        jdbc.update("""
                INSERT INTO billing_invoice_sequence (year, next_value)
                VALUES (?, 1)
                ON CONFLICT (year) DO NOTHING
                """, year);

        // Lock the row and read current value
        Long currentValue = jdbc.queryForObject(
                "SELECT next_value FROM billing_invoice_sequence WHERE year = ? FOR UPDATE",
                Long.class, year);

        if (currentValue == null) {
            currentValue = 1L;
        }

        // Increment
        jdbc.update("UPDATE billing_invoice_sequence SET next_value = ? WHERE year = ?",
                currentValue + 1, year);

        return String.format("%d-%06d", year, currentValue);
    }

    /**
     * Returns the next formatted credit note number for the current year.
     * Format: A + YYYY-NNNNNN (e.g. A2026-000001).
     * Uses the same sequence counter as invoices (next_value is shared per year).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String nextCreditNoteNumber() {
        int year = Year.now().getValue();

        jdbc.update("""
                INSERT INTO billing_invoice_sequence (year, next_value)
                VALUES (?, 1)
                ON CONFLICT (year) DO NOTHING
                """, year);

        Long currentValue = jdbc.queryForObject(
                "SELECT next_value FROM billing_invoice_sequence WHERE year = ? FOR UPDATE",
                Long.class, year);

        if (currentValue == null) {
            currentValue = 1L;
        }

        jdbc.update("UPDATE billing_invoice_sequence SET next_value = ? WHERE year = ?",
                currentValue + 1, year);

        return String.format("A%d-%06d", year, currentValue);
    }
}
