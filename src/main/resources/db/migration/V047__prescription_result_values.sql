-- V047 — Résultats structurés (analyte / valeur / unité) par ligne LAB / IMAGING.
--
-- Remplace en pratique le champ texte libre `result_text` (V045) qui ne
-- permettait pas le suivi d'évolution. Le médecin saisit maintenant une
-- liste d'analytes (ex. NFS → Hb 14.2 g/dL, Plaquettes 245 G/L, GB 7.1
-- G/L). Le dossier patient agrège ensuite tous les résultats du même
-- analyte (clé = analyte normalisé = lower+trim) pour tracer un graphe
-- d'évolution dans le temps.
--
-- v1 : analyte libre (pas de catalogue), autocomplétion côté UI sur les
-- valeurs déjà saisies par patient. Le champ `analyte_normalized` est
-- stocké en colonne calculée (PG) pour servir d'index de groupage sans
-- payer le lower(trim()) à chaque requête graphe.
--
-- result_text reste en base : pas de DROP — backward-compat pour les
-- saisies antérieures, et permet une migration douce si on souhaite plus
-- tard re-ingérer ces blobs en lignes structurées.

CREATE TABLE clinical_prescription_result_value (
    id                    UUID         PRIMARY KEY,
    prescription_line_id  UUID         NOT NULL,
    patient_id            UUID         NOT NULL, -- dénormalisé pour les requêtes "trend" sans join
    analyte               VARCHAR(120) NOT NULL,
    -- Colonne calculée (PostgreSQL 12+) : sert d'index de groupage pour le graphe.
    analyte_normalized    VARCHAR(120) GENERATED ALWAYS AS (LOWER(BTRIM(analyte))) STORED,
    value_numeric         NUMERIC(14, 4) NOT NULL,
    unit                  VARCHAR(40),
    recorded_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    sort_order            INT          NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT clinical_prescription_result_value_line_fkey
        FOREIGN KEY (prescription_line_id)
        REFERENCES clinical_prescription_line (id)
        ON DELETE CASCADE,
    CONSTRAINT clinical_prescription_result_value_patient_fkey
        FOREIGN KEY (patient_id)
        REFERENCES patient_patient (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_prescription_result_value_line
    ON clinical_prescription_result_value (prescription_line_id);

-- Index principal du graphe "trend par patient/analyte" : on filtre par
-- patient + analyte normalisé, ordonné par date.
CREATE INDEX idx_prescription_result_value_patient_analyte
    ON clinical_prescription_result_value (patient_id, analyte_normalized, recorded_at);

COMMENT ON TABLE clinical_prescription_result_value IS
    'V047 — resultats structures par ligne LAB/IMAGING. Source du graphe d evolution biologique dans le dossier patient.';
COMMENT ON COLUMN clinical_prescription_result_value.analyte_normalized IS
    'lower+trim de analyte — cle de groupage pour le graphe (Hb / HB / hb -> "hb").';
