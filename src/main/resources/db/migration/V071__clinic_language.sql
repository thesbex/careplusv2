-- =============================================================================
-- V071 — Langue de l'application (multilangue, #122)
--
-- Demande : « Je veux rendre l'application multilangue et le superadministrateur
-- qui définit la langue. Langues : Arabe, Français, Anglais et Espagnol. »
--
-- La langue est un réglage cabinet (single-row), modifiable par le SUPER_ADMIN
-- seulement (V069 — c'est un champ protégé dans SettingsController). Codes ISO
-- 639-1 : fr | en | ar | es. Défaut 'fr' (rétrocompatible). L'arabe déclenche le
-- mode RTL côté IHM.
-- =============================================================================

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'fr';

ALTER TABLE configuration_clinic_settings
    ADD CONSTRAINT chk_clinic_language CHECK (language IN ('fr', 'en', 'ar', 'es'));

COMMENT ON COLUMN configuration_clinic_settings.language IS
    'V071 — langue de l''application (ISO 639-1 : fr|en|ar|es). Réglée par le '
    'super administrateur. ar => mode RTL côté IHM.';
