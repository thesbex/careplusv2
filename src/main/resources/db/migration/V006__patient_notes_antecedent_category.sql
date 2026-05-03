-- V006: patient_note table + category column on patient_antecedent
-- Adds the fine-grained antecedent taxonomy (ADR-023) and clinical notes.
-- patient_antecedent and patient_patient were created in V001.
-- patient_patient tier/mutuelle columns were added in V005.
-- Never modify V001–V005.

-- ── patient_antecedent: fine-grained category column ─────────────────────────
ALTER TABLE patient_antecedent
    ADD COLUMN IF NOT EXISTS category VARCHAR(60) NULL;

COMMENT ON COLUMN patient_antecedent.category IS
    'ADR-023 fine-grained taxonomy: PERSONNEL_MALADIES_CHRONIQUES, PERSONNEL_CHIRURGIES, etc.';

-- ── patient_note: clinical notes by MEDECIN on a patient dossier ──────────────
CREATE TABLE IF NOT EXISTS patient_note (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID        NOT NULL REFERENCES patient_patient(id),
    content     TEXT        NOT NULL,
    created_by  UUID        NOT NULL REFERENCES identity_user(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_note_patient ON patient_note(patient_id);

-- ── touch_updated_at trigger for patient_note ─────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_patient_note_touch'
          AND tgrelid = 'patient_note'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER trg_patient_note_touch
                 BEFORE UPDATE ON patient_note
                 FOR EACH ROW EXECUTE FUNCTION touch_updated_at()';
    END IF;
END $$;
