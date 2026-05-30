-- =============================================================================
-- V072 — Apparence de l'application (thème configurable par le super admin)
--
-- Demande : « Make the tweaks configurable by super admin, mode sombre. »
-- Issu de la maquette « careplus refresh - chambres & lits (calm premium) » dont
-- le panneau « Tweaks » pilotait police / ambiance (canvas) / accent / mode sombre.
--
-- On stocke la configuration d'apparence en JSON texte sur la ligne unique du
-- cabinet (single-row), modifiable par le SUPER_ADMIN seulement (champ protégé
-- dans SettingsController, comme `language` en V071). Forme :
--   {"font":"Geist","tone":"default","accent":"#1e4dab","dark":false}
-- NULL / absent = thème par défaut de l'app (rétrocompatible : rien ne change).
-- =============================================================================

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS appearance VARCHAR(2000);

COMMENT ON COLUMN configuration_clinic_settings.appearance IS
    'V072 — configuration d''apparence (JSON : font, tone, accent, dark). Réglée '
    'par le super administrateur. NULL = thème par défaut de l''application.';
