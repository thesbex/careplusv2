package ma.careplus.finance.infrastructure.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.finance.domain.Expense;
import ma.careplus.finance.domain.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data JPA repository for {@link Expense}.
 * All queries exclude soft-deleted rows (deleted_at IS NULL).
 */
public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    /** Find non-deleted expense by id. */
    @Query("SELECT e FROM Expense e WHERE e.id = :id AND e.deletedAt IS NULL")
    Optional<Expense> findActiveById(@Param("id") UUID id);

    /**
     * List non-deleted expenses with optional filters.
     * All parameters are nullable — null means "no filter on that column".
     */
    @Query("""
            SELECT e FROM Expense e
            WHERE e.deletedAt IS NULL
              AND (:category IS NULL OR e.category = :category)
              AND (:from     IS NULL OR e.expenseDate >= :from)
              AND (:to       IS NULL OR e.expenseDate <= :to)
            ORDER BY e.expenseDate DESC
            """)
    List<Expense> findAllActive(
            @Param("category") ExpenseCategory category,
            @Param("from")     LocalDate from,
            @Param("to")       LocalDate to);

    /**
     * Monthly totals for a given calendar year (only non-deleted rows).
     * Returns Object[] rows: [month (int), total (BigDecimal)].
     */
    @Query(value = """
            SELECT EXTRACT(MONTH FROM expense_date)::INT AS month,
                   COALESCE(SUM(amount), 0)               AS total
            FROM   finance_expense
            WHERE  deleted_at IS NULL
              AND  EXTRACT(YEAR FROM expense_date) = :year
            GROUP  BY EXTRACT(MONTH FROM expense_date)
            ORDER  BY month
            """, nativeQuery = true)
    List<Object[]> monthlyTotals(@Param("year") int year);
}
