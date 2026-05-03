-- careplus baseline schema
-- All MVP tables in one migration. Further modules add Vxxx__<module>_<change>.sql.
-- Conventions:
--   * UUID ids generated app-side (UUID.randomUUID)
--   * TIMESTAMPTZ only
--   * created_at / updated_at / created_by / updated_by on every table
--   * deleted_at (soft delete) on patient-medical tables; NEVER on billing
--   * version (optimistic locking) on mutable aggregates
--   * Table names: <module>_<entity>; column names: snake_case
-- Extensions — idempotent. Pre-created by docker init script; Testcontainers needs them.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- identity module
-- =============================================================================

CREATE TABLE identity_role (
    id            UUID        PRIMARY KEY,
    code          VARCHAR(32) NOT NULL UNIQUE,
    label_fr      VARCHAR(64) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE identity_role IS 'System roles: SECRETAIRE, ASSISTANT, MEDECIN, ADMIN';

CREATE TABLE identity_user (
    id               UUID         PRIMARY KEY,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(72)  NOT NULL,
    first_name       VARCHAR(64)  NOT NULL,
    last_name        VARCHAR(64)  NOT NULL,
    phone            VARCHAR(32),
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    locked_until     TIMESTAMPTZ  NULL,
    failed_attempts  INT          NOT NULL DEFAULT 0,
    last_login_at    TIMESTAMPTZ  NULL,
    version          BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       UUID         NULL,
    updated_by       UUID         NULL
);
CREATE INDEX idx_user_email_lower ON identity_user (LOWER(email));

CREATE TABLE identity_user_role (
    user_id  UUID NOT NULL REFERENCES identity_user(id) ON DELETE CASCADE,
    role_id  UUID NOT NULL REFERENCES identity_role(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE identity_refresh_token (
    id            UUID        PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES identity_user(id) ON DELETE CASCADE,
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ NULL,
    replaced_by   UUID        NULL REFERENCES identity_refresh_token(id),
    user_agent    VARCHAR(255),
    ip_address    VARCHAR(45)
);
CREATE INDEX idx_refresh_token_user ON identity_refresh_token (user_id) WHERE revoked_at IS NULL;

CREATE TABLE identity_audit_log (
    id              UUID        PRIMARY KEY,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id         UUID        NULL,
    action          VARCHAR(64) NOT NULL,
    entity_type     VARCHAR(64),
    entity_id       UUID,
    before_json     JSONB,
    after_json      JSONB,
    ip_address      VARCHAR(45),
    correlation_id  VARCHAR(64)
);
CREATE INDEX idx_audit_occurred_at ON identity_audit_log (occurred_at DESC);
CREATE INDEX idx_audit_entity      ON identity_audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_user        ON identity_audit_log (user_id);

-- =============================================================================
-- configuration module
-- =============================================================================

CREATE TABLE configuration_clinic_settings (
    id            UUID         PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    address       VARCHAR(512) NOT NULL,
    city          VARCHAR(128) NOT NULL,
    phone         VARCHAR(32)  NOT NULL,
    email         VARCHAR(255),
    inpe          VARCHAR(32),
    cnom          VARCHAR(32),
    ice           VARCHAR(32),
    rib           VARCHAR(32),
    logo_key      VARCHAR(255),
    stamp_key     VARCHAR(255),
    signature_key VARCHAR(255),
    version       BIGINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID         NULL,
    updated_by    UUID         NULL
);
COMMENT ON TABLE configuration_clinic_settings IS 'Single-row table in v1 (solo cabinet); multi-row in clinique v2';

CREATE TABLE configuration_document_template (
    id             UUID         PRIMARY KEY,
    type           VARCHAR(32)  NOT NULL UNIQUE,
    html_template  TEXT         NOT NULL,
    css_style      TEXT,
    variables_json JSONB,
    page_format    VARCHAR(16)  NOT NULL DEFAULT 'A4',
    version        BIGINT       NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by     UUID         NULL,
    updated_by     UUID         NULL
);
COMMENT ON COLUMN configuration_document_template.type IS 'ORDONNANCE, ORDONNANCE_SECURISEE, BON_ANALYSE, BON_RADIO, CERTIFICAT, ARRET_TRAVAIL, FACTURE, RECU';

-- =============================================================================
-- catalog module (référentiels)
-- =============================================================================

CREATE TABLE catalog_insurance (
    id           UUID         PRIMARY KEY,
    code         VARCHAR(32)  NOT NULL UNIQUE,
    name         VARCHAR(128) NOT NULL,
    kind         VARCHAR(16)  NOT NULL,  -- AMO, MUTUELLE, PRIVEE
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE catalog_medication (
    id            UUID         PRIMARY KEY,
    commercial_name VARCHAR(255) NOT NULL,
    dci           VARCHAR(255) NOT NULL,
    form          VARCHAR(64)  NOT NULL,   -- comprime, sirop, gelule, ampoule...
    dosage        VARCHAR(64)  NOT NULL,
    atc_code      VARCHAR(16),
    tags          VARCHAR(255),             -- allergen class: penicillines, sulfamides, iode, etc.
    favorite      BOOLEAN      NOT NULL DEFAULT FALSE,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID         NULL,
    updated_by    UUID         NULL
);
CREATE INDEX idx_medication_commercial_trgm ON catalog_medication USING gin (commercial_name gin_trgm_ops);
CREATE INDEX idx_medication_dci_trgm        ON catalog_medication USING gin (dci gin_trgm_ops);

CREATE TABLE catalog_lab_test (
    id            UUID         PRIMARY KEY,
    code          VARCHAR(32)  NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    category      VARCHAR(64),
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_test_name_trgm ON catalog_lab_test USING gin (name gin_trgm_ops);

CREATE TABLE catalog_imaging_exam (
    id            UUID         PRIMARY KEY,
    code          VARCHAR(32)  NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    modality      VARCHAR(32),  -- RADIO, ECHO, SCANNER, IRM
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE catalog_act (
    id            UUID         PRIMARY KEY,
    code          VARCHAR(32)  NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    vat_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =============================================================================
-- patient module
-- =============================================================================

CREATE TABLE patient_patient (
    id                UUID          PRIMARY KEY,
    last_name         VARCHAR(64)   NOT NULL,
    first_name        VARCHAR(64)   NOT NULL,
    gender            VARCHAR(8),        -- M, F, O
    birth_date        DATE,
    cin               VARCHAR(32)   UNIQUE, -- MVP plaintext; encrypted at-rest in later sprint
    phone             VARCHAR(32),
    emergency_phone   VARCHAR(32),
    email             VARCHAR(255),
    address           VARCHAR(512),
    city              VARCHAR(128),
    country           VARCHAR(64)   DEFAULT 'Maroc',
    marital_status    VARCHAR(16),
    profession        VARCHAR(128),
    blood_group       VARCHAR(8),
    number_children   INT           NOT NULL DEFAULT 0,
    notes             TEXT,
    status            VARCHAR(16)   NOT NULL DEFAULT 'ACTIF',  -- PROSPECT, ACTIF, ARCHIVE, ANONYMISE
    version           BIGINT        NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by        UUID          NULL,
    updated_by        UUID          NULL,
    deleted_at        TIMESTAMPTZ   NULL
);
CREATE INDEX idx_patient_last_name_trgm  ON patient_patient USING gin (last_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX idx_patient_first_name_trgm ON patient_patient USING gin (first_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX idx_patient_phone           ON patient_patient (phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_patient_cin             ON patient_patient (cin) WHERE deleted_at IS NULL;

CREATE TABLE patient_allergy (
    id            UUID         PRIMARY KEY,
    patient_id    UUID         NOT NULL REFERENCES patient_patient(id) ON DELETE CASCADE,
    substance     VARCHAR(255) NOT NULL,
    atc_tag       VARCHAR(64),  -- cross-reference with catalog_medication.tags for auto-alert
    severity      VARCHAR(16)  NOT NULL DEFAULT 'MODEREE', -- LEGERE, MODEREE, SEVERE
    notes         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID         NULL,
    updated_by    UUID         NULL
);
CREATE INDEX idx_allergy_patient ON patient_allergy (patient_id);

CREATE TABLE patient_antecedent (
    id            UUID         PRIMARY KEY,
    patient_id    UUID         NOT NULL REFERENCES patient_patient(id) ON DELETE CASCADE,
    type          VARCHAR(32)  NOT NULL,  -- MEDICAL, CHIRURGICAL, FAMILIAL, GYNECO_OBSTETRIQUE, HABITUS
    description   VARCHAR(512) NOT NULL,
    occurred_on   DATE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID         NULL,
    updated_by    UUID         NULL
);
CREATE INDEX idx_antecedent_patient ON patient_antecedent (patient_id);

-- =============================================================================
-- scheduling module
-- =============================================================================

CREATE TABLE scheduling_appointment_reason (
    id               UUID         PRIMARY KEY,
    code             VARCHAR(32)  NOT NULL UNIQUE,
    label            VARCHAR(128) NOT NULL,
    duration_minutes INT          NOT NULL,
    default_act_id   UUID         REFERENCES catalog_act(id),
    color_hex        VARCHAR(7)   DEFAULT '#2196F3',
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE scheduling_working_hours (
    id            UUID        PRIMARY KEY,
    day_of_week   INT         NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- ISO: 1=Monday
    start_time    TIME        NOT NULL,
    end_time      TIME        NOT NULL,
    active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scheduling_holiday (
    id            UUID        PRIMARY KEY,
    date          DATE        NOT NULL UNIQUE,
    label         VARCHAR(128) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scheduling_appointment (
    id                     UUID         PRIMARY KEY,
    patient_id             UUID         NOT NULL REFERENCES patient_patient(id),
    practitioner_id        UUID         NOT NULL REFERENCES identity_user(id),
    reason_id              UUID         REFERENCES scheduling_appointment_reason(id),
    start_at               TIMESTAMPTZ  NOT NULL,
    end_at                 TIMESTAMPTZ  NOT NULL,
    status                 VARCHAR(32)  NOT NULL DEFAULT 'PLANIFIE',
    cancel_reason          VARCHAR(255),
    walk_in                BOOLEAN      NOT NULL DEFAULT FALSE,
    urgency                BOOLEAN      NOT NULL DEFAULT FALSE,
    -- presence timestamps (WF2 + WF3 + WF4)
    arrived_at             TIMESTAMPTZ  NULL,
    vitals_started_at      TIMESTAMPTZ  NULL,
    vitals_ended_at        TIMESTAMPTZ  NULL,
    consultation_started_at TIMESTAMPTZ NULL,
    consultation_ended_at  TIMESTAMPTZ  NULL,
    invoiced_at            TIMESTAMPTZ  NULL,
    left_at                TIMESTAMPTZ  NULL,
    version                BIGINT       NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by             UUID         NULL,
    updated_by             UUID         NULL,
    CHECK (end_at > start_at),
    CHECK (status IN ('PLANIFIE','CONFIRME','ARRIVE','EN_ATTENTE_CONSTANTES','CONSTANTES_PRISES',
                      'EN_CONSULTATION','CONSULTATION_TERMINEE','FACTURE','CLOS','ANNULE','NO_SHOW'))
);
CREATE INDEX idx_appt_start_at      ON scheduling_appointment (start_at);
CREATE INDEX idx_appt_patient       ON scheduling_appointment (patient_id);
CREATE INDEX idx_appt_practitioner  ON scheduling_appointment (practitioner_id);
CREATE INDEX idx_appt_status        ON scheduling_appointment (status);
CREATE INDEX idx_appt_day           ON scheduling_appointment (DATE(start_at AT TIME ZONE 'Africa/Casablanca'));

-- =============================================================================
-- clinical module
-- =============================================================================

CREATE TABLE clinical_consultation (
    id                      UUID         PRIMARY KEY,
    patient_id              UUID         NOT NULL REFERENCES patient_patient(id),
    practitioner_id         UUID         NOT NULL REFERENCES identity_user(id),
    appointment_id          UUID         REFERENCES scheduling_appointment(id),
    version_number          INT          NOT NULL DEFAULT 1,
    parent_consultation_id  UUID         NULL REFERENCES clinical_consultation(id),
    status                  VARCHAR(16)  NOT NULL DEFAULT 'BROUILLON',   -- BROUILLON, SIGNEE, AMENDEE
    motif                   TEXT,
    examination             TEXT,
    diagnosis               TEXT,
    notes                   TEXT,
    started_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    signed_at               TIMESTAMPTZ  NULL,
    version                 BIGINT       NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by              UUID         NULL,
    updated_by              UUID         NULL
);
CREATE INDEX idx_consult_patient        ON clinical_consultation (patient_id);
CREATE INDEX idx_consult_practitioner   ON clinical_consultation (practitioner_id);
CREATE INDEX idx_consult_started_at     ON clinical_consultation (started_at DESC);

CREATE TABLE clinical_vital_signs (
    id                UUID         PRIMARY KEY,
    patient_id        UUID         NOT NULL REFERENCES patient_patient(id),
    appointment_id    UUID         REFERENCES scheduling_appointment(id),
    consultation_id   UUID         REFERENCES clinical_consultation(id),
    systolic_mmhg     INT,
    diastolic_mmhg    INT,
    temperature_c     NUMERIC(4,1),
    weight_kg         NUMERIC(5,2),
    height_cm         NUMERIC(5,2),
    bmi               NUMERIC(5,2),      -- computed app-side
    heart_rate_bpm    INT,
    spo2_percent      INT,
    glycemia_g_per_l  NUMERIC(4,2),
    recorded_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    recorded_by       UUID         NOT NULL REFERENCES identity_user(id),
    notes             TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_vitals_patient_time ON clinical_vital_signs (patient_id, recorded_at DESC);
CREATE INDEX idx_vitals_appointment  ON clinical_vital_signs (appointment_id);

CREATE TABLE clinical_prescription (
    id               UUID         PRIMARY KEY,
    consultation_id  UUID         NOT NULL REFERENCES clinical_consultation(id) ON DELETE CASCADE,
    type             VARCHAR(16)  NOT NULL,  -- DRUG, LAB, IMAGING, CERT, SICK_LEAVE
    issued_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    pdf_storage_key  VARCHAR(255),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       UUID         NULL,
    updated_by       UUID         NULL
);
CREATE INDEX idx_prescription_consultation ON clinical_prescription (consultation_id);

CREATE TABLE clinical_prescription_line (
    id                UUID         PRIMARY KEY,
    prescription_id   UUID         NOT NULL REFERENCES clinical_prescription(id) ON DELETE CASCADE,
    position          INT          NOT NULL DEFAULT 0,
    item_id           UUID         NULL,     -- refers to catalog_medication / catalog_lab_test / catalog_imaging_exam
    item_kind         VARCHAR(16),           -- DRUG, LAB, IMAGING, FREE_TEXT
    free_text         TEXT,                  -- fallback when no catalog item
    dose              VARCHAR(64),
    frequency         VARCHAR(64),
    duration          VARCHAR(64),
    route             VARCHAR(32),
    timing            VARCHAR(64),
    notes             TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_prescription_line_rx ON clinical_prescription_line (prescription_id);

CREATE TABLE clinical_allergy_override (
    id                UUID         PRIMARY KEY,
    consultation_id   UUID         NOT NULL REFERENCES clinical_consultation(id),
    medication_id     UUID         NOT NULL REFERENCES catalog_medication(id),
    allergy_id        UUID         NULL REFERENCES patient_allergy(id),
    confirmed_by      UUID         NOT NULL REFERENCES identity_user(id),
    confirmed_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reason            TEXT
);

CREATE TABLE clinical_follow_up (
    id                UUID         PRIMARY KEY,
    consultation_id   UUID         NOT NULL REFERENCES clinical_consultation(id) ON DELETE CASCADE,
    target_date       DATE         NOT NULL,
    reason            VARCHAR(255),
    appointment_id    UUID         NULL REFERENCES scheduling_appointment(id),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =============================================================================
-- patient_insurance_policy (after catalog_insurance and patient_patient exist)
-- =============================================================================

CREATE TABLE patient_insurance_policy (
    id             UUID         PRIMARY KEY,
    patient_id     UUID         NOT NULL REFERENCES patient_patient(id) ON DELETE CASCADE,
    insurance_id   UUID         NOT NULL REFERENCES catalog_insurance(id),
    policy_number  VARCHAR(64),
    primary_flag   BOOLEAN      NOT NULL DEFAULT FALSE,
    valid_from     DATE,
    valid_until    DATE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_insurance_patient ON patient_insurance_policy (patient_id);

-- =============================================================================
-- billing module (no soft-delete, no updates after issue)
-- =============================================================================

CREATE TABLE billing_invoice_sequence (
    year        INT    PRIMARY KEY,
    next_value  BIGINT NOT NULL DEFAULT 1
);
COMMENT ON TABLE billing_invoice_sequence IS 'Atomic counter per year. SELECT FOR UPDATE + increment. Guarantees gap-free sequential numbering.';

CREATE TABLE billing_invoice (
    id                UUID          PRIMARY KEY,
    number            VARCHAR(16)   UNIQUE,  -- YYYY-NNNNNN; NULL while status=BROUILLON
    patient_id        UUID          NOT NULL REFERENCES patient_patient(id),
    consultation_id   UUID          REFERENCES clinical_consultation(id),
    appointment_id    UUID          REFERENCES scheduling_appointment(id),
    status            VARCHAR(16)   NOT NULL DEFAULT 'BROUILLON',
    subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
    vat_total         NUMERIC(10,2) NOT NULL DEFAULT 0,
    total             NUMERIC(10,2) NOT NULL DEFAULT 0,
    paid_total        NUMERIC(10,2) NOT NULL DEFAULT 0,
    issued_at         TIMESTAMPTZ   NULL,
    issued_by         UUID          NULL REFERENCES identity_user(id),
    pdf_storage_key   VARCHAR(255),
    cancelled_at      TIMESTAMPTZ   NULL,
    credit_note_id    UUID          NULL,   -- FK added below after table exists
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by        UUID          NULL,
    updated_by        UUID          NULL,
    CHECK (status IN ('BROUILLON','EMISE','PAYEE_PARTIELLE','PAYEE_TOTALE','ANNULEE'))
);
CREATE INDEX idx_invoice_patient ON billing_invoice (patient_id);
CREATE INDEX idx_invoice_status  ON billing_invoice (status);
CREATE INDEX idx_invoice_issued  ON billing_invoice (issued_at DESC);

CREATE TABLE billing_invoice_line (
    id             UUID          PRIMARY KEY,
    invoice_id     UUID          NOT NULL REFERENCES billing_invoice(id) ON DELETE CASCADE,
    position       INT           NOT NULL DEFAULT 0,
    act_id         UUID          REFERENCES catalog_act(id),
    description    VARCHAR(255)  NOT NULL,
    unit_price     NUMERIC(10,2) NOT NULL,
    quantity       NUMERIC(6,2)  NOT NULL DEFAULT 1,
    vat_rate       NUMERIC(5,2)  NOT NULL DEFAULT 0,
    line_total     NUMERIC(10,2) NOT NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_line_invoice ON billing_invoice_line (invoice_id);

CREATE TABLE billing_payment (
    id             UUID          PRIMARY KEY,
    invoice_id     UUID          NOT NULL REFERENCES billing_invoice(id),
    method         VARCHAR(16)   NOT NULL,   -- CASH, CHEQUE, CARD, TRANSFER, INSURANCE
    amount         NUMERIC(10,2) NOT NULL,
    received_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    received_by    UUID          NOT NULL REFERENCES identity_user(id),
    reference      VARCHAR(128),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_invoice ON billing_payment (invoice_id);
CREATE INDEX idx_payment_time    ON billing_payment (received_at DESC);

CREATE TABLE billing_credit_note (
    id                    UUID          PRIMARY KEY,
    number                VARCHAR(16)   NOT NULL UNIQUE,    -- AYYYY-NNNNNN
    original_invoice_id   UUID          NOT NULL REFERENCES billing_invoice(id),
    amount                NUMERIC(10,2) NOT NULL,
    reason                VARCHAR(512)  NOT NULL,
    issued_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    issued_by             UUID          NOT NULL REFERENCES identity_user(id),
    pdf_storage_key       VARCHAR(255),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_note_invoice ON billing_credit_note (original_invoice_id);

ALTER TABLE billing_invoice ADD CONSTRAINT fk_invoice_credit_note
    FOREIGN KEY (credit_note_id) REFERENCES billing_credit_note(id);

-- =============================================================================
-- Trigger: keep updated_at current on every UPDATE
-- =============================================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table with an updated_at column
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'updated_at'
          AND c.table_name NOT LIKE 'flyway%'
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%I_touch
                        BEFORE UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', r.table_name, r.table_name);
    END LOOP;
END $$;
