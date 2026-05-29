-- =============================================================================
-- V068 — Modèles de consultation SOAP, privés au médecin
--
-- Le bouton « Modèles » de l'écran de consultation insère un modèle pré-rempli
-- dans les 4 champs SOAP (Subjectif / Objectif / Analyse / Plan). Modèles privés
-- par praticien (comme clinical_prescription_template). Soft-delete via deleted_at.
-- =============================================================================

CREATE TABLE clinical_soap_template (
    id              UUID          PRIMARY KEY,
    practitioner_id UUID          NOT NULL REFERENCES identity_user(id),
    name            VARCHAR(120)  NOT NULL,
    subjectif       TEXT,
    objectif        TEXT,
    analyse_note    TEXT,   -- "analyse" est un mot réservé Postgres (ANALYSE) → suffixe
    plan            TEXT,
    deleted_at      TIMESTAMPTZ,
    version         BIGINT        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinical_soap_template IS
    'Modèles de consultation SOAP réutilisables, privés au médecin (practitioner_id). Insérés via le bouton « Modèles » de l''écran consultation.';

CREATE INDEX idx_soap_template_practitioner
    ON clinical_soap_template (practitioner_id, name)
    WHERE deleted_at IS NULL;
