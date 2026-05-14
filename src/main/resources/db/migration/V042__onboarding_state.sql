-- =============================================================================
-- V042 - Onboarding completion gate + step resume.
--
-- The wizard at /onboarding configures cabinet-level state (clinic identity,
-- working hours, document templates, tarifs). It must be:
--   1. forced on first login (any admin/medecin lands on /onboarding until
--      the wizard signals completion)
--   2. resumable - if the user stopped at step 3 "Horaires" and logged out,
--      the next login brings them back to step 3, not step 1.
--
-- Two columns on the single-row configuration_clinic_settings table:
--   - onboarding_completed_at TIMESTAMPTZ NULL - non-null when "Ouvrir mon
--     cabinet" has been clicked at least once. The gate uses this flag.
--   - onboarding_current_step VARCHAR(32) NULL - the step.key the wizard is
--     currently parked on ('cabinet', 'medecin', 'horaires', 'equipe',
--     'tarifs', 'documents', 'recap'). NULL = not started.
--
-- The wizard PUTs the step on each "Continuer" / "Passer cette etape" so a
-- crash/refresh between steps preserves position. Completion sets
-- completed_at = now() and current_step = NULL.
-- =============================================================================

ALTER TABLE configuration_clinic_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS onboarding_current_step VARCHAR(32) NULL;

COMMENT ON COLUMN configuration_clinic_settings.onboarding_completed_at IS
    'Non-NULL une fois que l onboarding wizard a ete cloture par un admin (clic Ouvrir mon cabinet). Si NULL, la route /onboarding est forcee a la connexion.';

COMMENT ON COLUMN configuration_clinic_settings.onboarding_current_step IS
    'Etape courante du wizard (cabinet / medecin / horaires / equipe / tarifs / documents / recap). Permet la reprise apres logout/refresh. NULL = jamais demarre OU termine.';

-- Cabinet-level legal mentions added for full prototype parity on step 1.
-- ICE was already in V001 baseline ; we add RC and IF and the legal form code.
ALTER TABLE configuration_clinic_settings
  ADD COLUMN IF NOT EXISTS rc          VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS if_no       VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS legal_form  VARCHAR(64) NULL;

COMMENT ON COLUMN configuration_clinic_settings.rc IS 'Numero Registre du Commerce. Mention legale optionnelle sur les factures.';
COMMENT ON COLUMN configuration_clinic_settings.if_no IS 'Identifiant Fiscal (IF). Obligatoire sur toute facture emise au Maroc.';
COMMENT ON COLUMN configuration_clinic_settings.legal_form IS 'Forme juridique du cabinet (Profession liberale / SCM / SCP / SARL medicale). Optionnel.';
