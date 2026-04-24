-- V003: clinical module additions + presence fields
-- Adds can_start_consultation flag to identity_user,
-- type + origin_consultation_id to scheduling_appointment.
-- Does NOT recreate clinical_consultation or clinical_vital_signs (already in V001).
-- Never modify applied Flyway migrations -- this is an additive migration only.

-- ── identity_user: per-user consultation-start permission ──────────────────────
ALTER TABLE identity_user
    ADD COLUMN IF NOT EXISTS can_start_consultation BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN identity_user.can_start_consultation IS
    'Allows SECRETAIRE / ASSISTANT to open a consultation draft without MEDECIN role';

-- ── scheduling_appointment: appointment type + follow-up link ─────────────────
ALTER TABLE scheduling_appointment
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'CONSULTATION';

ALTER TABLE scheduling_appointment
    ADD COLUMN IF NOT EXISTS origin_consultation_id UUID NULL;

-- FK added after the column exists (clinical_consultation was created in V001)
ALTER TABLE scheduling_appointment
    ADD CONSTRAINT fk_appt_origin_consultation
    FOREIGN KEY (origin_consultation_id) REFERENCES clinical_consultation(id);

COMMENT ON COLUMN scheduling_appointment.type IS
    'CONSULTATION (default), CONTROLE (follow-up), URGENCE';

COMMENT ON COLUMN scheduling_appointment.origin_consultation_id IS
    'For CONTROLE appointments: references the consultation that triggered the follow-up';
