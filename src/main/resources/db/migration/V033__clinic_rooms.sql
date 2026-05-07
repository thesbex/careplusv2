-- =============================================================================
-- V033 — Salles de consultation (rooms module)
--
-- Introduit la table clinic_room (référentiel des salles du cabinet) et ajoute
-- room_id (FK nullable) sur scheduling_appointment pour rattacher un RDV à une
-- salle. La détection de conflit de salle est UI-only (warning), jamais
-- bloquante côté serveur.
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinic_room (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(80) NOT NULL,
    capability_tags TEXT[]      NOT NULL DEFAULT '{}',
    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         BIGINT      NOT NULL DEFAULT 0
);

COMMENT ON TABLE clinic_room IS
    'Référentiel des salles de consultation du cabinet. Soft-delete via active=false.';
COMMENT ON COLUMN clinic_room.capability_tags IS
    'Tags libres décrivant les équipements / spécialités de la salle (ex: ECG, Pédiatrie).';

-- Unicité du nom (insensible à la casse) parmi les salles actives seulement.
CREATE UNIQUE INDEX uq_clinic_room_name_active
    ON clinic_room (LOWER(name)) WHERE active = TRUE;

-- Ajout de la colonne room_id sur les RDV (nullable — pas de rupture).
ALTER TABLE scheduling_appointment
    ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES clinic_room(id);

COMMENT ON COLUMN scheduling_appointment.room_id IS
    'Salle de consultation assignée au RDV. Nullable. Conflits de salle : warning UI uniquement.';

CREATE INDEX IF NOT EXISTS idx_appointment_room
    ON scheduling_appointment (room_id) WHERE room_id IS NOT NULL;
