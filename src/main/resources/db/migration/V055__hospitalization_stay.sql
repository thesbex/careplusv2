-- =============================================================================
-- V055 — Hospitalisation Slice B+D : séjour (stay) + affectations de lit (ADT) + facturation
--
-- Voir docs/plans/2026-05-25-hospitalisation-design.md.
-- Le séjour est l'aggregate central : 1 patient ↔ N affectations de lit (transferts).
-- Le prix de journée est GELÉ sur chaque affectation (reproductibilité facture).
-- =============================================================================

CREATE TABLE IF NOT EXISTS hospitalization_stay (
    id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                UUID         NOT NULL,
    attending_practitioner_id UUID         NULL,        -- médecin responsable
    admitted_by               UUID         NULL,        -- qui a admis (bureau des admissions)
    admission_reason          TEXT         NULL,
    -- EN_COURS → SORTI → FACTURE  ; branche ANNULE (admission annulée).
    status                    VARCHAR(16)  NOT NULL DEFAULT 'EN_COURS',
    admitted_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    discharged_at             TIMESTAMPTZ  NULL,
    discharge_type            VARCHAR(16)  NULL,         -- DOMICILE | TRANSFERT_EXT | CONTRE_AVIS | DECES
    discharge_summary         TEXT         NULL,         -- compte-rendu de sortie (MEDECIN)
    invoice_id                UUID         NULL,         -- facture de séjour (module billing, cross-module)
    version                   BIGINT       NOT NULL DEFAULT 0,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by                UUID         NULL,
    updated_by                UUID         NULL,
    deleted_at                TIMESTAMPTZ  NULL,
    CONSTRAINT chk_hosp_stay_status
        CHECK (status IN ('EN_COURS','SORTI','FACTURE','ANNULE')),
    CONSTRAINT chk_hosp_stay_discharge_type
        CHECK (discharge_type IS NULL
               OR discharge_type IN ('DOMICILE','TRANSFERT_EXT','CONTRE_AVIS','DECES'))
);
COMMENT ON TABLE hospitalization_stay IS 'Séjour hospitalier. 1 patient ↔ N affectations de lit. invoice_id lie la facture de séjour (billing).';
CREATE INDEX IF NOT EXISTS idx_hosp_stay_patient ON hospitalization_stay (patient_id);
CREATE INDEX IF NOT EXISTS idx_hosp_stay_status  ON hospitalization_stay (status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hospitalization_bed_assignment (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    stay_id            UUID          NOT NULL REFERENCES hospitalization_stay(id),
    bed_id             UUID          NOT NULL REFERENCES hospitalization_bed(id),
    daily_rate_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,  -- gelé depuis la chambre à l'affectation
    from_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    to_at              TIMESTAMPTZ   NULL,                 -- NULL = affectation courante
    assigned_by        UUID          NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE hospitalization_bed_assignment IS 'Historique ADT : un lit occupé par un séjour sur un intervalle. to_at NULL = occupation courante. daily_rate gelé.';
CREATE INDEX IF NOT EXISTS idx_hosp_assignment_stay ON hospitalization_bed_assignment (stay_id);
-- Un lit ne peut avoir qu'une affectation courante (to_at NULL) à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hosp_assignment_bed_current
    ON hospitalization_bed_assignment (bed_id) WHERE to_at IS NULL;
