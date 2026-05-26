-- =============================================================================
-- Finance — dépenses du cabinet (QA9-15)
--
-- Table finance_expense : charges récurrentes et ponctuelles du cabinet
-- (eau/électricité, internet, loyer, syndic, réparation, fournitures, etc.)
-- Soft delete via deleted_at. Pas de version d'optimistic locking sur cette
-- table (pas d'accès concurrent attendu — saisie admin séquentielle).
-- =============================================================================

CREATE TABLE finance_expense (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    category      VARCHAR(32)   NOT NULL,
    label         VARCHAR(255)  NOT NULL,
    amount        NUMERIC(12,2) NOT NULL,
    expense_date  DATE          NOT NULL,
    periodicity   VARCHAR(16)   NOT NULL DEFAULT 'PONCTUELLE',
    supplier      VARCHAR(255)  NULL,
    notes         TEXT          NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by    UUID          NULL,
    deleted_at    TIMESTAMPTZ   NULL,

    CONSTRAINT finance_expense_pk          PRIMARY KEY (id),
    CONSTRAINT finance_expense_amount_nn   CHECK (amount >= 0),
    CONSTRAINT finance_expense_category_ck CHECK (category IN (
        'EAU_ELECTRICITE', 'INTERNET', 'LOYER', 'SYNDIC', 'REPARATION',
        'FOURNITURES', 'ASSURANCE', 'IMPOTS', 'SALAIRE', 'AUTRE'
    )),
    CONSTRAINT finance_expense_periodicity_ck CHECK (periodicity IN (
        'PONCTUELLE', 'MENSUELLE', 'ANNUELLE'
    ))
);

COMMENT ON TABLE  finance_expense                IS 'QA9-15 — charges du cabinet (eau/élec, loyer, internet, etc.)';
COMMENT ON COLUMN finance_expense.category       IS 'Catégorie contrôlée : EAU_ELECTRICITE | INTERNET | LOYER | SYNDIC | REPARATION | FOURNITURES | ASSURANCE | IMPOTS | SALAIRE | AUTRE';
COMMENT ON COLUMN finance_expense.periodicity    IS 'PONCTUELLE | MENSUELLE | ANNUELLE';
COMMENT ON COLUMN finance_expense.deleted_at     IS 'Soft delete — NULL = actif.';

CREATE INDEX finance_expense_date_idx     ON finance_expense (expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX finance_expense_category_idx ON finance_expense (category)          WHERE deleted_at IS NULL;
