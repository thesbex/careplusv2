-- =============================================================================
-- V041 - Insurance compatibility flags on catalog_act.
--
-- The onboarding wizard "Tarifs" step displays a nomenclature table per the
-- prototype, with one column per Moroccan insurance scheme (CNOPS / CNSS /
-- RAMED). The flags drive both the visual marker in the wizard and (later)
-- the eligibility check at invoice issuance — only acts with the matching
-- flag can be billed under the patient's insurance.
--
-- Default TRUE for the three consultation-grade flags reflects current
-- cabinet behavior: consultations are reimbursable under all three schemes
-- unless the admin marks an act otherwise (e.g., aesthetic procedures).
-- =============================================================================

ALTER TABLE catalog_act
  ADD COLUMN IF NOT EXISTS cnops_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cnss_eligible  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ramed_eligible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN catalog_act.cnops_eligible IS 'Si TRUE, cet acte peut etre factur sous convention CNOPS (tiers payant).';
COMMENT ON COLUMN catalog_act.cnss_eligible  IS 'Si TRUE, cet acte peut etre factur sous convention CNSS.';
COMMENT ON COLUMN catalog_act.ramed_eligible IS 'Si TRUE, cet acte peut etre factur sous convention RAMED.';

-- Adjust seed defaults: certificates and home visits are not RAMED-eligible
-- (administrative acts, not medical care; RAMED limited to clinical acts).
UPDATE catalog_act
   SET ramed_eligible = FALSE
 WHERE code IN ('CERT_MED', 'CERT_APT', 'VISITE_DOM');

-- Urgent consultations are CNOPS-eligible but not CNSS / RAMED (specific
-- regulatory carve-outs in Moroccan practice).
UPDATE catalog_act
   SET cnss_eligible = FALSE, ramed_eligible = FALSE
 WHERE code = 'CONS_URG';
