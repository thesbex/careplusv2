-- =============================================================================
-- V054 — Module hospitalisation (référentiel lits) — Slice A
--
-- Voir docs/plans/2026-05-25-hospitalisation-design.md.
-- careplus devient passe-partout : cabinet GP → centre médical → clinique avec
-- lits. L'hospitalisation est une CAPACITÉ activable (hospitalization_enabled),
-- gated par establishment_type (V034). Invisible pour un cabinet GP.
--
-- Cette migration pose UNIQUEMENT le référentiel (services / chambres / lits) +
-- le flag + le rôle INFIRMIER + la permission HOSPITALIZATION_ADMIT. Le séjour
-- (admission / ADT / facturation) arrive dans une migration ultérieure (Slice B+).
-- =============================================================================

-- 1. Flag capability sur la config cabinet (single-row). Défaut FALSE : aucun
--    impact sur un cabinet existant tant qu'il n'a pas coché la case.
ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS hospitalization_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN configuration_clinic_settings.hospitalization_enabled IS
    'V054 — true => le module hospitalisation (lits, séjours) est actif. Suggéré pour CLINIQUE/HOPITAL.';

-- 2. Référentiel : service (ward) → chambre (room) → lit (bed). Soft-delete via active=false.

CREATE TABLE IF NOT EXISTS hospitalization_ward (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(32)  NOT NULL,
    label_fr    VARCHAR(120) NOT NULL,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version     BIGINT       NOT NULL DEFAULT 0
);
COMMENT ON TABLE hospitalization_ward IS 'Service / unité d''hospitalisation (ex: Maternité, Médecine). Soft-delete via active=false.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_hosp_ward_code_active
    ON hospitalization_ward (LOWER(code)) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS hospitalization_room (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id     UUID          NOT NULL REFERENCES hospitalization_ward(id),
    code        VARCHAR(32)   NOT NULL,
    label_fr    VARCHAR(120)  NOT NULL,
    room_class  VARCHAR(32)   NOT NULL DEFAULT 'INDIVIDUELLE',
    daily_rate  NUMERIC(10,2) NOT NULL DEFAULT 0,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    version     BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT chk_hosp_room_class
        CHECK (room_class IN ('INDIVIDUELLE','DOUBLE','COMMUNE','SUITE','AUTRE'))
);
COMMENT ON TABLE hospitalization_room IS 'Chambre rattachée à un service. daily_rate = prix de journée (MAD), gelé sur l''affectation à la facturation du séjour.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_hosp_room_code_active
    ON hospitalization_room (LOWER(code)) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hosp_room_ward ON hospitalization_room (ward_id);

CREATE TABLE IF NOT EXISTS hospitalization_bed (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID        NOT NULL REFERENCES hospitalization_room(id),
    code        VARCHAR(32) NOT NULL,
    -- Statut hybride (cf. design D3) : OCCUPE/LIBRE seront calculés à la volée
    -- depuis les séjours actifs en Slice B. Cette colonne porte l'état MANUEL
    -- (NETTOYAGE / HORS_SERVICE / RESERVE) togglable par le bureau des admissions.
    status      VARCHAR(16) NOT NULL DEFAULT 'LIBRE',
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    version     BIGINT      NOT NULL DEFAULT 0,
    CONSTRAINT chk_hosp_bed_status
        CHECK (status IN ('LIBRE','OCCUPE','RESERVE','NETTOYAGE','HORS_SERVICE'))
);
COMMENT ON TABLE hospitalization_bed IS 'Lit rattaché à une chambre. status = état manuel ; occupation réelle calculée depuis les séjours (Slice B).';
-- Code de lit unique PAR chambre (ex: "Lit A" peut exister dans plusieurs chambres).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hosp_bed_code_active
    ON hospitalization_bed (room_id, LOWER(code)) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hosp_bed_room ON hospitalization_bed (room_id);

-- 3. Rôle INFIRMIER (soins / constantes au lit) — calque l'ajout RADIO/LAB (V038).
--    Cumulable : identity_user_role est déjà multi-rôle.
INSERT INTO identity_role (id, code, label_fr) VALUES
    ('00000000-0000-0000-0000-000000000007', 'INFIRMIER', 'Infirmier(ère)')
ON CONFLICT (code) DO NOTHING;

-- 4. Permission atomique HOSPITALIZATION_ADMIT (admettre / affecter un lit /
--    transférer / gérer le référentiel des lits). Pas de rôle ADMISSION imposé :
--    la secrétaire EST le bureau des admissions d'une petite clinique. Éditable
--    depuis la matrice de droits (QA3-3) pour les 4 rôles canoniques.
INSERT INTO identity_role_permission (role_code, permission, granted) VALUES
    ('ADMIN',      'HOSPITALIZATION_ADMIT', TRUE),
    ('MEDECIN',    'HOSPITALIZATION_ADMIT', TRUE),
    ('SECRETAIRE', 'HOSPITALIZATION_ADMIT', TRUE),
    ('ASSISTANT',  'HOSPITALIZATION_ADMIT', FALSE),
    ('INFIRMIER',  'HOSPITALIZATION_ADMIT', TRUE)
ON CONFLICT (role_code, permission) DO NOTHING;
