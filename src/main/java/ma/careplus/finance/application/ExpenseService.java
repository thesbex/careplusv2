package ma.careplus.finance.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.finance.domain.Expense;
import ma.careplus.finance.domain.ExpenseCategory;
import ma.careplus.finance.infrastructure.web.dto.ExpenseRequest;
import ma.careplus.finance.infrastructure.web.dto.ExpenseResponse;
import ma.careplus.finance.infrastructure.web.dto.MonthlyTotalResponse;

/**
 * Public application interface for the finance/expense module.
 * Controller injects this interface, not the implementation.
 */
public interface ExpenseService {

    /**
     * List non-deleted expenses ordered by expense_date DESC.
     *
     * @param category optional category filter
     * @param from     optional lower bound on expense_date (inclusive)
     * @param to       optional upper bound on expense_date (inclusive)
     */
    List<Expense> list(ExpenseCategory category, LocalDate from, LocalDate to);

    /**
     * Paiements de salaire (module RH) exposés comme lignes de charge virtuelles
     * (catégorie SALAIRE, {@code source = "HR"}, lecture seule). Permet de les
     * retrouver dans la page Charges alors qu'ils sont saisis dans Personnel.
     *
     * @param from borne inférieure optionnelle sur paid_at (incluse)
     * @param to   borne supérieure optionnelle sur paid_at (incluse)
     */
    List<ExpenseResponse> salaryPaymentsAsExpenses(LocalDate from, LocalDate to);

    /**
     * Create a new expense. The {@code createdBy} is the authenticated user's id.
     */
    Expense create(ExpenseRequest request, UUID createdBy);

    /**
     * Update an existing expense.
     *
     * @throws ma.careplus.shared.error.NotFoundException if not found or soft-deleted
     */
    Expense update(UUID id, ExpenseRequest request);

    /**
     * Soft-delete an expense (sets deleted_at = now()).
     *
     * @throws ma.careplus.shared.error.NotFoundException if not found or already deleted
     */
    void delete(UUID id);

    /**
     * Monthly totals for a given calendar year.
     * Returns only months that have at least one non-deleted expense.
     */
    List<MonthlyTotalResponse> monthlySummary(int year);
}
