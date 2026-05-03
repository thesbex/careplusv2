-- =============================================================================
-- V016 — Prestations cliniques (piqûre, acupuncture, ECG, échographie, …)
-- =============================================================================
-- Une prestation = un acte facturable réalisé pendant la consultation, en
-- plus (ou à la place) du tarif consultation classique. Le médecin peut
-- ajouter une ou plusieurs prestations à une consultation, chaque prestation
-- a un tarif par défaut (configurable côté Paramétrage) qu'on FIGE au
-- moment de l'ajout (snapshot `unit_price`) — pour qu'une mise à jour de
-- tarif demain ne réécrive pas les anciennes consultations.
--
-- Demande Y. Boutaleb 2026-05-01.

CREATE TABLE catalog_prestation (
    id            UUID PRIMARY KEY,
    code          VARCHAR(32)   NOT NULL UNIQUE,
    label         VARCHAR(128)  NOT NULL,
    default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    active        BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order    INTEGER       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE catalog_prestation IS
    'Prestations facturables additionnelles (V016) : ECG, échographie, etc.';
COMMENT ON COLUMN catalog_prestation.default_price IS
    'Tarif suggéré, en MAD. Snappé sur consultation_prestation.unit_price à l''ajout.';

CREATE INDEX idx_catalog_prestation_active
    ON catalog_prestation (active, sort_order)
    WHERE active = TRUE;

-- ── Lien consultation × prestation ────────────────────────────────────────
-- Une consultation peut référencer plusieurs prestations (piqûre + ECG).
-- `unit_price` est le snapshot du tarif à l'instant T : modifier
-- catalog_prestation.default_price plus tard ne réécrit pas l'historique.

CREATE TABLE clinical_consultation_prestation (
    id              UUID PRIMARY KEY,
    consultation_id UUID          NOT NULL,
    prestation_id   UUID          NOT NULL,
    unit_price      NUMERIC(10,2) NOT NULL,
    quantity        INTEGER       NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    notes           TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT clinical_cons_prestation_consultation_fk
        FOREIGN KEY (consultation_id) REFERENCES clinical_consultation(id) ON DELETE CASCADE,
    CONSTRAINT clinical_cons_prestation_prestation_fk
        FOREIGN KEY (prestation_id) REFERENCES catalog_prestation(id)
);
COMMENT ON TABLE clinical_consultation_prestation IS
    'Prestations réalisées pendant une consultation (V016). unit_price figé.';

CREATE INDEX idx_consultation_prestation_consultation
    ON clinical_consultation_prestation (consultation_id);

-- ── Permission RBAC ───────────────────────────────────────────────────────
-- PRESTATION_ADMIN = administrer le catalogue prestations (CRUD + tarifs).
-- TRUE pour ADMIN/MEDECIN, FALSE pour SECRETAIRE/ASSISTANT.
-- La ligne apparaît automatiquement dans la matrice RBAC du Paramétrage.

INSERT INTO identity_role_permission (role_code, permission, granted) VALUES
    ('ADMIN',      'PRESTATION_ADMIN', TRUE),
    ('MEDECIN',    'PRESTATION_ADMIN', TRUE),
    ('SECRETAIRE', 'PRESTATION_ADMIN', FALSE),
    ('ASSISTANT',  'PRESTATION_ADMIN', FALSE);

-- ── Seed initial : 6 prestations courantes du généraliste marocain ─────────
INSERT INTO catalog_prestation (id, code, label, default_price, sort_order) VALUES
    (gen_random_uuid(), 'PIQURE',       'Piqûre / injection IM',       50,  10),
    (gen_random_uuid(), 'ECG',          'Électrocardiogramme (ECG)',   200, 20),
    (gen_random_uuid(), 'ECHOGRAPHIE',  'Échographie',                 350, 30),
    (gen_random_uuid(), 'ACUPUNCTURE',  'Séance d''acupuncture',       300, 40),
    (gen_random_uuid(), 'PANSEMENT',    'Pansement / soins',           80,  50),
    (gen_random_uuid(), 'SUTURE',       'Suture simple',               150, 60);
