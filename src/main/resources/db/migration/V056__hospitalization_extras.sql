-- =============================================================================
-- V056 — Hospitalisation Slices C/E/D2 : règle de comptage des journées,
-- cloisonnement (orphan roles), rattachement des constantes au séjour.
--
-- Voir docs/plans/2026-05-25-hospitalisation-design.md (D2 + Slice C + Slice E).
-- =============================================================================

-- D2 — règle de comptage des journées facturables. NUITS (défaut, on compte les
-- nuits = floor des jours, min 1) ou JOURS_ENTAMES (jour d'entrée ET de sortie
-- comptés = floor + 1). Paramétrable car litige fréquent en clinique Maroc.
ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS stay_billing_day_rule VARCHAR(16) NOT NULL DEFAULT 'NUITS';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stay_billing_day_rule') THEN
        ALTER TABLE configuration_clinic_settings
            ADD CONSTRAINT chk_stay_billing_day_rule
            CHECK (stay_billing_day_rule IN ('NUITS','JOURS_ENTAMES'));
    END IF;
END $$;

-- Slice E — cloisonnement : rôles autorisés à voir les séjours sans médecin
-- référent (orphelins) quand agenda_strict_isolation = TRUE. Défaut = tous les
-- rôles → comportement historique préservé. Calque V036/V039 (ADR-032).
ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS hospitalization_orphan_visible_roles VARCHAR(32)[]
        NOT NULL DEFAULT ARRAY['MEDECIN','ADMIN','SECRETAIRE','ASSISTANT']::VARCHAR(32)[];

-- Slice C — rattachement optionnel des constantes à un séjour (soins au lit).
ALTER TABLE clinical_vital_signs
    ADD COLUMN IF NOT EXISTS stay_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_vital_signs_stay
    ON clinical_vital_signs (stay_id) WHERE stay_id IS NOT NULL;
