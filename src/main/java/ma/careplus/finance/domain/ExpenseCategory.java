package ma.careplus.finance.domain;

/**
 * Controlled set of expense categories for the cabinet.
 * Mirrors the CHECK constraint in V058__finance_expense.sql.
 */
public enum ExpenseCategory {
    EAU_ELECTRICITE,
    INTERNET,
    LOYER,
    SYNDIC,
    REPARATION,
    FOURNITURES,
    ASSURANCE,
    IMPOTS,
    SALAIRE,
    AUTRE
}
