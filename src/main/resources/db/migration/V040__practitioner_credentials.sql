-- =============================================================================
-- V040 - Practitioner credentials on identity_user.
--
-- The onboarding wizard "Medecin" step asks each practitioner for the
-- regulatory identifiers that must appear on every issued document
-- (ordonnance, certificat, carnet vaccination). Cabinet-level INPE already
-- lives on configuration_clinic_settings; this migration adds the SAME fields
-- at user level because a multi-praticien cabinet has one set per medecin.
--
-- All columns optional (NULL allowed) - solo cabinets that don't fill them
-- keep working, the PDF templates fall back to the cabinet-level INPE.
-- =============================================================================

ALTER TABLE identity_user
  ADD COLUMN IF NOT EXISTS inpe  VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cnom  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cnops VARCHAR(64);

COMMENT ON COLUMN identity_user.inpe  IS 'INPE du medecin (Identifiant National des Professionnels de sante au Maroc). Apparait sur ordonnances et certificats.';
COMMENT ON COLUMN identity_user.cnom  IS 'Numero Conseil National de l''Ordre des Medecins. Optionnel.';
COMMENT ON COLUMN identity_user.cnops IS 'Numero de conventionnement CNOPS pour le tiers payant. Optionnel.';
