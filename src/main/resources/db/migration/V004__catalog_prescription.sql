-- V004: catalog module additions + prescription module
-- Adds tariff table, enriches catalog_act, creates prescription + prescription_line.
-- clinical_prescription and clinical_prescription_line already exist in V001 with
-- different columns. This migration reuses those tables by adding missing columns
-- rather than creating new tables, staying true to the V001 schema.
-- catalog_medication, catalog_lab_test, catalog_imaging_exam already exist in V001.
-- catalog_act already exists in V001 (has: id, code, name, default_price, vat_rate, active).

-- ── catalog_act: add type column if not present ───────────────────────────────
ALTER TABLE catalog_act
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'CONSULTATION';

-- ── catalog_tariff: tier-based tariff history per act ─────────────────────────
CREATE TABLE IF NOT EXISTS catalog_tariff (
    id               UUID          PRIMARY KEY,
    act_id           UUID          NOT NULL REFERENCES catalog_act(id),
    tier             VARCHAR(20)   NOT NULL DEFAULT 'NORMAL',
    amount           NUMERIC(10,2) NOT NULL,
    effective_from   DATE          NOT NULL,
    effective_to     DATE          NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_tariff_act_tier_from UNIQUE (act_id, tier, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_tariff_act_tier ON catalog_tariff (act_id, tier);

-- ── clinical_prescription: add missing columns needed for J6 ─────────────────
-- existing columns in V001: id, consultation_id, type, issued_at, pdf_storage_key,
-- created_at, updated_at, created_by, updated_by
ALTER TABLE clinical_prescription
    ADD COLUMN IF NOT EXISTS patient_id            UUID NULL REFERENCES patient_patient(id),
    ADD COLUMN IF NOT EXISTS allergy_override       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS allergy_override_reason TEXT NULL;

-- ── clinical_prescription_line: align to J6 schema ───────────────────────────
-- existing columns: id, prescription_id, position, item_id, item_kind,
--   free_text, dose, frequency, duration, route, timing, notes, created_at
-- add missing columns for explicit FK references + new fields
ALTER TABLE clinical_prescription_line
    ADD COLUMN IF NOT EXISTS medication_id     UUID NULL REFERENCES catalog_medication(id),
    ADD COLUMN IF NOT EXISTS lab_test_id       UUID NULL REFERENCES catalog_lab_test(id),
    ADD COLUMN IF NOT EXISTS imaging_exam_id   UUID NULL REFERENCES catalog_imaging_exam(id),
    ADD COLUMN IF NOT EXISTS dosage            VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS quantity          INT NULL,
    ADD COLUMN IF NOT EXISTS instructions      TEXT NULL,
    ADD COLUMN IF NOT EXISTS sort_order        INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── touch_updated_at trigger for new/altered tables ──────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_catalog_tariff_touch'
          AND tgrelid = 'catalog_tariff'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER trg_catalog_tariff_touch
                 BEFORE UPDATE ON catalog_tariff
                 FOR EACH ROW EXECUTE FUNCTION touch_updated_at()';
    END IF;
END $$;
