-- QA6-2 + QA6-3 — Modèles de prescription réutilisables.
--
-- Le médecin prépare des "ordonnances types" (DRUG, LAB ou IMAGING) qu'il
-- charge ensuite dans le drawer de prescription pendant la consultation.
-- Les lignes sont éditables après chargement (append au drawer existant).
--
-- Scope : privé au médecin (FK practitioner_id, filtré par JWT côté service).
-- Polymorphisme : un seul type par template, discriminé par la colonne `type`.
-- Lines : JSONB (ordre intrinsèque, jamais requêté indépendamment, pattern
--         identity_audit_log + autres entités du projet).

CREATE TABLE clinical_prescription_template (
    id              UUID         PRIMARY KEY,
    practitioner_id UUID         NOT NULL REFERENCES identity_user(id),
    name            VARCHAR(120) NOT NULL,
    type            VARCHAR(16)  NOT NULL CHECK (type IN ('DRUG','LAB','IMAGING')),
    lines           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    deleted_at      TIMESTAMPTZ,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Filtre principal : "tous mes modèles d'un type donné, ordonnés par updated_at DESC".
CREATE INDEX idx_rxtpl_practitioner_type
    ON clinical_prescription_template (practitioner_id, type, updated_at DESC)
    WHERE deleted_at IS NULL;

-- Un médecin ne peut pas avoir deux templates de même type avec le même nom.
-- Case-insensitive : "HTA stable" et "hta stable" sont en collision.
CREATE UNIQUE INDEX uniq_rxtpl_practitioner_name_type
    ON clinical_prescription_template (practitioner_id, type, lower(name))
    WHERE deleted_at IS NULL;
