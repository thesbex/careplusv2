-- V022 — Vaccination module schema
-- 3 new tables: vaccine_catalog, vaccine_schedule_dose, vaccination_dose
-- + 1 column on patient_patient (vaccination_started_at)
-- Conventions: UUID PK, TIMESTAMPTZ, audit cols, optimistic locking on catalog + dose

-- =============================================================================
-- vaccine_catalog — référentiel éditable des vaccins
-- =============================================================================
CREATE TABLE vaccine_catalog (
    id                   UUID         PRIMARY KEY,
    code                 VARCHAR(32)  NOT NULL UNIQUE,
    name_fr              VARCHAR(255) NOT NULL,
    manufacturer_default VARCHAR(255),
    route_default        VARCHAR(8)   NOT NULL DEFAULT 'IM', -- IM | SC | PO | ID
    is_pni               BOOLEAN      NOT NULL DEFAULT FALSE,
    active               BOOLEAN      NOT NULL DEFAULT TRUE,
    version              BIGINT       NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by           UUID,
    updated_by           UUID
);

CREATE INDEX idx_vaccine_catalog_code   ON vaccine_catalog (code);
CREATE INDEX idx_vaccine_catalog_active ON vaccine_catalog (active) WHERE active = TRUE;

-- =============================================================================
-- vaccine_schedule_dose — calendrier des doses planifiées (template global)
-- =============================================================================
CREATE TABLE vaccine_schedule_dose (
    id               UUID        PRIMARY KEY,
    vaccine_id       UUID        NOT NULL REFERENCES vaccine_catalog(id),
    dose_number      SMALLINT    NOT NULL,
    target_age_days  INT         NOT NULL,
    tolerance_days   INT         NOT NULL DEFAULT 30,
    label_fr         VARCHAR(255),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_by       UUID,
    UNIQUE (vaccine_id, dose_number)
);

CREATE INDEX idx_schedule_vaccine ON vaccine_schedule_dose (vaccine_id);

-- =============================================================================
-- vaccination_dose — doses réellement administrées/planifiées par patient
-- =============================================================================
CREATE TABLE vaccination_dose (
    id                UUID        PRIMARY KEY,
    patient_id        UUID        NOT NULL REFERENCES patient_patient(id),
    schedule_dose_id  UUID        REFERENCES vaccine_schedule_dose(id),
    vaccine_id        UUID        NOT NULL REFERENCES vaccine_catalog(id),
    dose_number       SMALLINT    NOT NULL,
    status            VARCHAR(16) NOT NULL DEFAULT 'PLANNED',
    administered_at   TIMESTAMPTZ,
    lot_number        VARCHAR(100),
    route             VARCHAR(8),
    site              VARCHAR(100),
    administered_by   UUID        REFERENCES identity_user(id),
    deferral_reason   VARCHAR(500),
    notes             TEXT,
    version           BIGINT      NOT NULL DEFAULT 0,
    deleted_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID,
    updated_by        UUID
);

CREATE INDEX idx_vaccination_dose_patient       ON vaccination_dose (patient_id, vaccine_id, dose_number);
CREATE INDEX idx_vaccination_dose_patient_active ON vaccination_dose (patient_id) WHERE deleted_at IS NULL;

-- =============================================================================
-- patient_patient — add vaccination_started_at column
-- =============================================================================
ALTER TABLE patient_patient
    ADD COLUMN IF NOT EXISTS vaccination_started_at TIMESTAMPTZ NULL;

-- =============================================================================
-- Apply touch_updated_at trigger to the 3 new tables
-- (touch_updated_at function already exists from V001)
-- =============================================================================
CREATE TRIGGER trg_vaccine_catalog_touch
    BEFORE UPDATE ON vaccine_catalog
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_vaccine_schedule_dose_touch
    BEFORE UPDATE ON vaccine_schedule_dose
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_vaccination_dose_touch
    BEFORE UPDATE ON vaccination_dose
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
