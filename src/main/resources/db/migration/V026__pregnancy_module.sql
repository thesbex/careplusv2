-- V026 — Pregnancy module schema
-- 4 new tables: pregnancy, pregnancy_visit_plan, pregnancy_visit, pregnancy_ultrasound
-- + extension of scheduling_appointment.type to include SUIVI_GROSSESSE
-- Conventions: UUID PK, TIMESTAMPTZ, audit cols, optimistic locking on aggregates
-- The type column on scheduling_appointment is VARCHAR(20) — additive comment update only.

-- =============================================================================
-- pregnancy — une grossesse par patiente (1-N, historique préservé)
-- =============================================================================
CREATE TABLE pregnancy (
    id                UUID        PRIMARY KEY,
    patient_id        UUID        NOT NULL REFERENCES patient_patient(id),
    started_at        DATE        NOT NULL,
    lmp_date          DATE        NOT NULL,
    due_date          DATE        NOT NULL,
    due_date_source   VARCHAR(10) NOT NULL DEFAULT 'NAEGELE',
    status            VARCHAR(12) NOT NULL DEFAULT 'EN_COURS',
    ended_at          DATE        NULL,
    outcome           VARCHAR(22) NULL,
    child_patient_id  UUID        NULL REFERENCES patient_patient(id),
    fetuses           JSONB       NOT NULL DEFAULT '[{"label":"Fœtus unique"}]',
    notes             TEXT,
    version           BIGINT      NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID        NULL,
    updated_by        UUID        NULL,

    CONSTRAINT chk_pregnancy_ended_at
        CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT chk_pregnancy_active_no_end
        CHECK (status != 'EN_COURS' OR (ended_at IS NULL AND outcome IS NULL)),
    CONSTRAINT chk_pregnancy_due_date_source
        CHECK (due_date_source IN ('NAEGELE', 'ECHO_T1')),
    CONSTRAINT chk_pregnancy_status
        CHECK (status IN ('EN_COURS', 'TERMINEE', 'INTERROMPUE')),
    CONSTRAINT chk_pregnancy_outcome
        CHECK (outcome IS NULL OR outcome IN (
            'ACCOUCHEMENT_VIVANT', 'MORT_NEE', 'MFIU', 'FCS', 'IVG', 'GEU', 'MOLE'))
);

CREATE INDEX idx_pregnancy_patient_status ON pregnancy (patient_id, status);
CREATE INDEX idx_pregnancy_patient_id     ON pregnancy (patient_id);

-- =============================================================================
-- pregnancy_visit_plan — calendrier de visites planifiées (auto-généré + modifiable)
-- =============================================================================
CREATE TABLE pregnancy_visit_plan (
    id                 UUID        PRIMARY KEY,
    pregnancy_id       UUID        NOT NULL REFERENCES pregnancy(id) ON DELETE CASCADE,
    target_sa_weeks    SMALLINT    NOT NULL,
    target_date        DATE        NOT NULL,
    tolerance_days     INT         NOT NULL DEFAULT 14,
    status             VARCHAR(10) NOT NULL DEFAULT 'PLANIFIEE',
    appointment_id     UUID        NULL REFERENCES scheduling_appointment(id),
    consultation_id    UUID        NULL REFERENCES clinical_consultation(id),
    version            BIGINT      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID        NULL,
    updated_by         UUID        NULL,

    CONSTRAINT chk_visit_plan_status
        CHECK (status IN ('PLANIFIEE', 'HONOREE', 'MANQUEE', 'ANNULEE')),
    UNIQUE (pregnancy_id, target_sa_weeks)
);

CREATE INDEX idx_pregnancy_visit_plan_pregnancy_status
    ON pregnancy_visit_plan (pregnancy_id, status);

-- =============================================================================
-- pregnancy_visit — données obstétricales saisies à chaque visite (1-N par grossesse)
-- =============================================================================
CREATE TABLE pregnancy_visit (
    id                        UUID        PRIMARY KEY,
    pregnancy_id              UUID        NOT NULL REFERENCES pregnancy(id) ON DELETE CASCADE,
    visit_plan_id             UUID        NULL REFERENCES pregnancy_visit_plan(id),
    consultation_id           UUID        NULL REFERENCES clinical_consultation(id),
    recorded_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    sa_weeks                  SMALLINT    NOT NULL,
    sa_days                   SMALLINT    NOT NULL DEFAULT 0,
    weight_kg                 NUMERIC(5,2),
    bp_systolic               SMALLINT,
    bp_diastolic              SMALLINT,
    urine_dip                 JSONB,
    fundal_height_cm          NUMERIC(4,1),
    fetal_heart_rate_bpm      SMALLINT,
    fetal_movements_perceived BOOLEAN,
    presentation              VARCHAR(16) NULL,
    notes                     TEXT,
    recorded_by               UUID        NOT NULL REFERENCES identity_user(id),
    version                   BIGINT      NOT NULL DEFAULT 0,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                UUID        NULL,
    updated_by                UUID        NULL,

    CONSTRAINT chk_visit_presentation
        CHECK (presentation IS NULL OR presentation IN (
            'CEPHALIQUE', 'SIEGE', 'TRANSVERSE', 'INDETERMINEE'))
);

CREATE INDEX idx_pregnancy_visit_pregnancy_recorded
    ON pregnancy_visit (pregnancy_id, recorded_at DESC);

-- =============================================================================
-- pregnancy_ultrasound — 3 échos obstétricales par grossesse
-- =============================================================================
CREATE TABLE pregnancy_ultrasound (
    id                UUID        PRIMARY KEY,
    pregnancy_id      UUID        NOT NULL REFERENCES pregnancy(id) ON DELETE CASCADE,
    kind              VARCHAR(16) NOT NULL,
    performed_at      DATE        NOT NULL,
    sa_weeks_at_exam  SMALLINT    NOT NULL,
    sa_days_at_exam   SMALLINT    NOT NULL DEFAULT 0,
    findings          TEXT,
    document_id       UUID        NULL REFERENCES patient_document(id),
    biometry          JSONB,
    corrects_due_date BOOLEAN     NOT NULL DEFAULT FALSE,
    recorded_by       UUID        NOT NULL REFERENCES identity_user(id),
    version           BIGINT      NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID        NULL,
    updated_by        UUID        NULL,

    CONSTRAINT chk_ultrasound_kind
        CHECK (kind IN ('T1_DATATION', 'T2_MORPHO', 'T3_CROISSANCE', 'AUTRE'))
);

CREATE INDEX idx_pregnancy_ultrasound_pregnancy_kind
    ON pregnancy_ultrasound (pregnancy_id, kind);

-- =============================================================================
-- scheduling_appointment.type extension — additive comment update
-- The column is VARCHAR(20); SUIVI_GROSSESSE is 16 chars — fits.
-- No DDL needed beyond updating the comment (no Postgres enum type in use).
-- =============================================================================
COMMENT ON COLUMN scheduling_appointment.type IS
    'CONSULTATION (default), CONTROLE (follow-up), URGENCE, SUIVI_VACCINAL, SUIVI_GROSSESSE';

-- =============================================================================
-- Apply touch_updated_at trigger to the 4 new tables
-- (touch_updated_at function already exists from V001)
-- =============================================================================
CREATE TRIGGER trg_pregnancy_touch
    BEFORE UPDATE ON pregnancy
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_pregnancy_visit_plan_touch
    BEFORE UPDATE ON pregnancy_visit_plan
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_pregnancy_visit_touch
    BEFORE UPDATE ON pregnancy_visit
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_pregnancy_ultrasound_touch
    BEFORE UPDATE ON pregnancy_ultrasound
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
