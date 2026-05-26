package ma.careplus.finance.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.finance.domain.Expense;
import ma.careplus.finance.domain.ExpenseCategory;
import ma.careplus.finance.domain.ExpensePeriodicity;
import ma.careplus.finance.infrastructure.persistence.ExpenseRepository;
import ma.careplus.finance.infrastructure.web.dto.ExpenseRequest;
import ma.careplus.finance.infrastructure.web.dto.MonthlyTotalResponse;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation of {@link ExpenseService}.
 * All mutations are transactional; reads are read-only.
 */
@Service
@Transactional
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;

    public ExpenseServiceImpl(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Expense> list(ExpenseCategory category, LocalDate from, LocalDate to) {
        return expenseRepository.findAllActive(category, from, to);
    }

    @Override
    public Expense create(ExpenseRequest req, UUID createdBy) {
        Expense expense = new Expense();
        applyRequest(expense, req);
        expense.setCreatedBy(createdBy);
        return expenseRepository.save(expense);
    }

    @Override
    public Expense update(UUID id, ExpenseRequest req) {
        Expense expense = expenseRepository.findActiveById(id)
                .orElseThrow(() -> new NotFoundException(
                        "EXPENSE_NOT_FOUND", "Dépense introuvable : " + id));
        applyRequest(expense, req);
        return expense; // @Transactional flushes on commit
    }

    @Override
    public void delete(UUID id) {
        Expense expense = expenseRepository.findActiveById(id)
                .orElseThrow(() -> new NotFoundException(
                        "EXPENSE_NOT_FOUND", "Dépense introuvable : " + id));
        expense.setDeletedAt(OffsetDateTime.now());
    }

    @Override
    @Transactional(readOnly = true)
    public List<MonthlyTotalResponse> monthlySummary(int year) {
        List<Object[]> rows = expenseRepository.monthlyTotals(year);
        return rows.stream()
                .map(r -> new MonthlyTotalResponse(
                        ((Number) r[0]).intValue(),
                        (BigDecimal) r[1]))
                .toList();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void applyRequest(Expense expense, ExpenseRequest req) {
        expense.setCategory(ExpenseCategory.valueOf(req.category()));
        expense.setLabel(req.label());
        expense.setAmount(req.amount());
        expense.setExpenseDate(req.expenseDate());
        expense.setPeriodicity(
                req.periodicity() != null
                        ? ExpensePeriodicity.valueOf(req.periodicity())
                        : ExpensePeriodicity.PONCTUELLE);
        expense.setSupplier(req.supplier());
        expense.setNotes(req.notes());
    }
}
