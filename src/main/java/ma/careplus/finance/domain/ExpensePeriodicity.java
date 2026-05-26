package ma.careplus.finance.domain;

/**
 * Periodicity of a cabinet expense.
 * Mirrors the CHECK constraint in V058__finance_expense.sql.
 */
public enum ExpensePeriodicity {
    PONCTUELLE,
    MENSUELLE,
    ANNUELLE
}
