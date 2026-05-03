-- V005: billing module additions
-- V001 already created: billing_invoice, billing_invoice_line, billing_payment,
--   billing_credit_note, billing_invoice_sequence.
-- V001 patient_patient does NOT have tier or mutuelle fields.
-- This migration adds the missing billing columns + patient tier/mutuelle
-- + config_patient_tier table.

-- ── patient_patient: tier + mutuelle fields ──────────────────────────────────
ALTER TABLE patient_patient
    ADD COLUMN IF NOT EXISTS tier                 VARCHAR(20)  NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS mutuelle_insurance_id UUID        NULL REFERENCES catalog_insurance(id),
    ADD COLUMN IF NOT EXISTS mutuelle_policy_number VARCHAR(100) NULL;

-- ── billing_invoice: missing columns for discount + mutuelle snapshot ─────────
-- V001 columns: id, number, patient_id, consultation_id, appointment_id, status,
--   subtotal, vat_total, total, paid_total, issued_at, issued_by, pdf_storage_key,
--   cancelled_at, credit_note_id, created_at, updated_at, created_by, updated_by

ALTER TABLE billing_invoice
    ADD COLUMN IF NOT EXISTS discount_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_amount             NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS mutuelle_insurance_id  UUID          NULL REFERENCES catalog_insurance(id),
    ADD COLUMN IF NOT EXISTS mutuelle_policy_number VARCHAR(100)  NULL,
    ADD COLUMN IF NOT EXISTS adjusted_by            UUID          NULL REFERENCES identity_user(id),
    ADD COLUMN IF NOT EXISTS adjusted_at            TIMESTAMPTZ   NULL,
    ADD COLUMN IF NOT EXISTS version                BIGINT        NOT NULL DEFAULT 0;

-- ── config_patient_tier: tier discount configuration ─────────────────────────
CREATE TABLE IF NOT EXISTS config_patient_tier (
    id               UUID         PRIMARY KEY,
    tier             VARCHAR(20)  NOT NULL UNIQUE,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO config_patient_tier (id, tier, discount_percent)
VALUES
    (gen_random_uuid(), 'NORMAL',  0),
    (gen_random_uuid(), 'PREMIUM', 10)
ON CONFLICT (tier) DO NOTHING;

-- ── touch_updated_at trigger for new table ────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_config_patient_tier_touch'
          AND tgrelid = 'config_patient_tier'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER trg_config_patient_tier_touch
                 BEFORE UPDATE ON config_patient_tier
                 FOR EACH ROW EXECUTE FUNCTION touch_updated_at()';
    END IF;
END $$;
