-- =============================================================================
-- V032 — Identity extensions for the auto-adaptive 1-doc / N-doc / clinic model.
--
-- Three additive changes:
--   1. identity_user.specialty (VARCHAR 120) — médecin's clinical specialty,
--      auto-injected under "Dr. <Name>" on every PDF (ordonnance, certificat,
--      carnet vaccination). Optional: NULL = no specialty line in the PDF.
--   2. configuration_clinic_settings.agenda_strict_isolation (BOOLEAN, default
--      FALSE) — toggle that, when ON, hides one practitioner's agenda entries
--      from the others (clinical privacy mode). Default OFF for the legacy
--      single-doctor / open-cabinet behavior.
--   3. identity_user_assignment — many-to-many table mapping a non-medical
--      user (SECRETAIRE / ASSISTANT) to the practitioners they support. Drives
--      the per-user agenda + queue filtering once the cabinet has > 1 médecin.
--      Empty for MEDECIN / ADMIN-only users (no rows = "not applicable").
-- =============================================================================

ALTER TABLE identity_user
  ADD COLUMN IF NOT EXISTS specialty VARCHAR(120);

COMMENT ON COLUMN identity_user.specialty IS
    'Spécialité clinique du médecin (ex. "Pédiatre", "Cardiologue"). Auto-injectée sous le nom du Dr. dans tous les PDF générés. NULL = aucun bloc spécialité affiché.';

ALTER TABLE configuration_clinic_settings
  ADD COLUMN IF NOT EXISTS agenda_strict_isolation BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN configuration_clinic_settings.agenda_strict_isolation IS
    'Si TRUE, l''agenda d''un médecin n''est visible que par lui-même et les utilisateurs SECRETAIRE/ASSISTANT qui lui sont rattachés (identity_user_assignment). FALSE = mode cabinet ouvert (tous voient tout), comportement historique single-doctor.';

CREATE TABLE IF NOT EXISTS identity_user_assignment (
  user_id         UUID NOT NULL REFERENCES identity_user(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES identity_user(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, practitioner_id)
);

CREATE INDEX IF NOT EXISTS idx_user_assignment_practitioner
  ON identity_user_assignment (practitioner_id);

COMMENT ON TABLE identity_user_assignment IS
    'Assignation N..N entre un utilisateur non-médical (SECRETAIRE/ASSISTANT) et les médecins qu''il assiste. Filtrage agenda + file d''attente quand la cabinet a > 1 médecin. Aucune ligne = utilisateur non concerné (MEDECIN/ADMIN seul) OU explicitement non assigné.';
