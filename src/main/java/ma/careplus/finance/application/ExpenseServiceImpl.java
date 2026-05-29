package ma.careplus.finance.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import ma.careplus.finance.domain.Expense;
import ma.careplus.finance.domain.ExpenseCategory;
import ma.careplus.finance.domain.ExpensePeriodicity;
import ma.careplus.finance.infrastructure.persistence.ExpenseRepository;
import ma.careplus.finance.infrastructure.web.dto.ExpenseRequest;
import ma.careplus.finance.infrastructure.web.dto.ExpenseResponse;
import ma.careplus.finance.infrastructure.web.dto.MonthlyTotalResponse;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbc;

    public ExpenseServiceImpl(ExpenseRepository expenseRepository, JdbcTemplate jdbc) {
        this.expenseRepository = expenseRepository;
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Expense> list(ExpenseCategory category, LocalDate from, LocalDate to) {
        return expenseRepository.findAllActive(category, from, to);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExpenseResponse> salaryPaymentsAsExpenses(LocalDate from, LocalDate to) {
        // Lecture inter-module via JdbcTemplate (exception assumée, comme les
        // services PDF lisent identity_user) : pas de couplage repository RH.
        StringBuilder sql = new StringBuilder(
                "SELECT sp.id, sp.amount, sp.paid_at, sp.period, sp.notes, sp.created_at, "
                + "s.full_name AS staff_name "
                + "FROM hr_salary_payment sp JOIN hr_staff s ON s.id = sp.staff_id WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (from != null) { sql.append(" AND sp.paid_at >= ?"); args.add(java.sql.Date.valueOf(from)); }
        if (to != null)   { sql.append(" AND sp.paid_at <= ?"); args.add(java.sql.Date.valueOf(to)); }
        sql.append(" ORDER BY sp.paid_at DESC");

        return jdbc.query(sql.toString(), (rs, i) -> {
            OffsetDateTime created = rs.getTimestamp("created_at").toInstant().atOffset(ZoneOffset.UTC);
            String staff = rs.getString("staff_name");
            return new ExpenseResponse(
                    (UUID) rs.getObject("id"),
                    "SALAIRE",
                    "Salaire — " + staff + " (" + rs.getString("period") + ")",
                    rs.getBigDecimal("amount"),
                    rs.getDate("paid_at").toLocalDate(),
                    "MENSUELLE",
                    staff,
                    rs.getString("notes"),
                    created,
                    created,
                    "HR");
        }, args.toArray());
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
        // Charges manuelles + salaires RH agrégés par mois, pour que le total
        // annuel reste cohérent avec la liste (qui inclut désormais les salaires).
        java.util.Map<Integer, BigDecimal> byMonth = new java.util.TreeMap<>();
        for (Object[] r : expenseRepository.monthlyTotals(year)) {
            byMonth.merge(((Number) r[0]).intValue(), (BigDecimal) r[1], BigDecimal::add);
        }
        jdbc.query(
                "SELECT EXTRACT(MONTH FROM paid_at)::int AS m, SUM(amount) AS total "
                + "FROM hr_salary_payment WHERE EXTRACT(YEAR FROM paid_at) = ? GROUP BY 1",
                (java.sql.ResultSet rs) -> {
                    byMonth.merge(rs.getInt("m"), rs.getBigDecimal("total"), BigDecimal::add);
                },
                year);
        return byMonth.entrySet().stream()
                .map(e -> new MonthlyTotalResponse(e.getKey(), e.getValue()))
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
