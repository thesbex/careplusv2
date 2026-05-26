-- =============================================================================
-- V061 — HR/Personnel module (QA9-14)
--
-- Three tables:
--   hr_staff          — staff members (may or may not have an app login)
--   hr_leave_entry    — leave taken, absences, lateness per staff member
--   hr_salary_payment — salary payment log per staff member per period
--
-- Leave accrual: 1.5 days per whole calendar month worked (computed in Java).
-- Soft delete on hr_staff only (deleted_at). Leave entries and salary payments
-- are physically deleted.
-- =============================================================================

CREATE TABLE hr_staff (
    id             UUID          NOT NULL DEFAULT gen_random_uuid(),
    full_name      VARCHAR(255)  NOT NULL,
    role           VARCHAR(32)   NOT NULL,
    hire_date      DATE          NOT NULL,
    monthly_salary NUMERIC(12,2) NULL CHECK (monthly_salary IS NULL OR monthly_salary >= 0),
    phone          VARCHAR(32)   NULL,
    user_id        UUID          NULL REFERENCES identity_user(id) ON DELETE SET NULL,
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    notes          TEXT          NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by     UUID          NULL,
    deleted_at     TIMESTAMPTZ   NULL,

    version       BIGINT        NOT NULL DEFAULT 0,

    CONSTRAINT hr_staff_pk      PRIMARY KEY (id),
    CONSTRAINT hr_staff_role_ck CHECK (role IN (
        'SECURITE', 'MENAGE', 'INFIRMIER', 'SECRETAIRE', 'ASSISTANTE', 'TECHNICIEN', 'AUTRE'
    ))
);

COMMENT ON TABLE  hr_staff                IS 'QA9-14 — personnel du cabinet (avec ou sans accès applicatif). Soft-delete via deleted_at.';
COMMENT ON COLUMN hr_staff.role           IS 'SECURITE | MENAGE | INFIRMIER | SECRETAIRE | ASSISTANTE | TECHNICIEN | AUTRE';
COMMENT ON COLUMN hr_staff.user_id        IS 'Lien optionnel vers identity_user pour les agents qui ont un login applicatif (assistante, secrétaire).';
COMMENT ON COLUMN hr_staff.active         IS 'FALSE = employé parti / contrat suspendu (toujours visible en archive, exclu des listes actives par défaut).';
COMMENT ON COLUMN hr_staff.deleted_at     IS 'Soft delete — NULL = enregistrement accessible.';

CREATE INDEX idx_hr_staff_active_role ON hr_staff (role, active) WHERE deleted_at IS NULL;
CREATE INDEX idx_hr_staff_user_id     ON hr_staff (user_id)      WHERE user_id IS NOT NULL AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------

CREATE TABLE hr_leave_entry (
    id         UUID          NOT NULL DEFAULT gen_random_uuid(),
    staff_id   UUID          NOT NULL REFERENCES hr_staff(id),
    type       VARCHAR(16)   NOT NULL,
    start_date DATE          NOT NULL,
    days       NUMERIC(5,2)  NOT NULL DEFAULT 1 CHECK (days >= 0),
    notes      TEXT          NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by UUID          NULL,

    CONSTRAINT hr_leave_entry_pk      PRIMARY KEY (id),
    CONSTRAINT hr_leave_entry_type_ck CHECK (type IN ('CONGE', 'ABSENCE', 'RETARD'))
);

COMMENT ON TABLE  hr_leave_entry          IS 'QA9-14 — congés pris, absences et retards par employé.';
COMMENT ON COLUMN hr_leave_entry.type     IS 'CONGE | ABSENCE | RETARD';
COMMENT ON COLUMN hr_leave_entry.days     IS 'Nombre de jours (peut être 0 pour RETARD, fraction possible).';

CREATE INDEX idx_hr_leave_staff ON hr_leave_entry (staff_id, start_date DESC);

-- -----------------------------------------------------------------------------

CREATE TABLE hr_salary_payment (
    id         UUID          NOT NULL DEFAULT gen_random_uuid(),
    staff_id   UUID          NOT NULL REFERENCES hr_staff(id),
    period     VARCHAR(7)    NOT NULL,              -- YYYY-MM
    amount     NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    paid_at    DATE          NOT NULL,
    notes      TEXT          NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by UUID          NULL,

    CONSTRAINT hr_salary_payment_pk        PRIMARY KEY (id),
    CONSTRAINT hr_salary_payment_period_ck CHECK (period ~ '^\d{4}-\d{2}$')
);

COMMENT ON TABLE  hr_salary_payment        IS 'QA9-14 — log des paiements de salaire par période.';
COMMENT ON COLUMN hr_salary_payment.period IS 'Période salariale au format YYYY-MM.';

CREATE INDEX idx_hr_salary_staff   ON hr_salary_payment (staff_id, period DESC);
CREATE INDEX idx_hr_salary_paid_at ON hr_salary_payment (paid_at DESC);
