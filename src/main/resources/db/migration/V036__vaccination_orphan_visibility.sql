-- =============================================================================
-- V036 — Visibilité des patients « orphelins » dans la queue Vaccination.
--
-- Quand le cloisonnement (V032 agenda_strict_isolation) est activé, un médecin
-- ne voit dans la queue Vaccination que les patients qu'il « suit » : un
-- patient est rattaché à un médecin dès que ce dernier a effectué AU MOINS UNE
-- action sur une dose (administered_by ou created_by sur vaccination_dose).
--
-- Mais que faire des patients que personne ne suit encore (« orphelins »,
-- typiquement un nouveau patient pédiatrique) ? Ce paramètre cabinet pilote
-- la liste des rôles autorisés à les voir tant qu'aucun médecin ne s'en est
-- occupé. Default = tous les rôles → comportement historique préservé tant que
-- l'admin ne durcit pas.
-- =============================================================================

ALTER TABLE configuration_clinic_settings
  ADD COLUMN IF NOT EXISTS vaccination_orphan_visible_roles VARCHAR(32)[] NOT NULL
    DEFAULT ARRAY['MEDECIN','ADMIN','SECRETAIRE','ASSISTANT']::VARCHAR(32)[];

COMMENT ON COLUMN configuration_clinic_settings.vaccination_orphan_visible_roles IS
    'Liste des codes de rôle autorisés à voir un patient sans médecin référent vaccination dans la queue, quand agenda_strict_isolation = TRUE. Default = tous les rôles → visibilité ouverte (comportement historique). Codes acceptés : MEDECIN, ADMIN, SECRETAIRE, ASSISTANT.';
