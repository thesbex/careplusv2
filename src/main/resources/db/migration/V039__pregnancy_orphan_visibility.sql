-- =============================================================================
-- V039 — Visibilité des patientes « orphelines » dans la queue Grossesse.
--
-- Symétrie de V036 vaccination, étendu au module grossesse. Quand le
-- cloisonnement (V032 agenda_strict_isolation) est activé, un médecin ne
-- voit dans la queue Grossesse que les patientes qu'il « suit » : une
-- grossesse est rattachée à un médecin dès que ce dernier a effectué AU
-- MOINS UNE action obstétricale (déclaration, visite, écho, plan de visite).
--
-- Sources de rattachement (UNION) :
--   - pregnancy.created_by
--   - pregnancy_visit.recorded_by, pregnancy_visit.created_by
--   - pregnancy_ultrasound.recorded_by, pregnancy_ultrasound.created_by
--   - pregnancy_visit_plan.created_by
--
-- Que faire des grossesses orphelines (typiquement créées par une secrétaire,
-- ou par auditing manquant) ? Ce paramètre cabinet pilote la liste des rôles
-- autorisés à les voir tant qu'aucun médecin ne s'en est occupé. Default =
-- tous les rôles → comportement historique préservé tant que l'admin ne
-- durcit pas.
-- =============================================================================

ALTER TABLE configuration_clinic_settings
  ADD COLUMN IF NOT EXISTS pregnancy_orphan_visible_roles VARCHAR(32)[] NOT NULL
    DEFAULT ARRAY['MEDECIN','ADMIN','SECRETAIRE','ASSISTANT']::VARCHAR(32)[];

COMMENT ON COLUMN configuration_clinic_settings.pregnancy_orphan_visible_roles IS
    'Liste des codes de rôle autorisés à voir une grossesse sans médecin référent (orpheline) dans la queue, quand agenda_strict_isolation = TRUE. Default = tous les rôles → visibilité ouverte (comportement historique). Codes acceptés : MEDECIN, ADMIN, SECRETAIRE, ASSISTANT.';
