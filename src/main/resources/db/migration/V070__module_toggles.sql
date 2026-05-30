-- =============================================================================
-- V070 — Habilitation des modules par l'administrateur
--
-- Demande client : « L'ensemble des fonctionnalités principales de l'application
-- peuvent être habilitées ou non par l'administrateur. »
--
-- Modèle : une colonne tableau `disabled_modules` sur la configuration cabinet
-- (single-row). Elle liste les modules DÉSACTIVÉS (liste vide = tout activé, donc
-- aucune régression sur les installs existantes). L'IHM masque l'entrée de nav
-- (sidebar desktop + feuille « Plus » mobile) des modules listés ici.
--
-- Modules débrayables (fonctionnalités secondaires) : vaccinations, grossesses,
-- stock, messages, assistant, charges. Les modules cœur (agenda, patients, salle
-- d'attente, consultations, facturation, catalogue, personnel, paramètres,
-- dashboard) ne sont volontairement PAS débrayables pour ne pas rendre
-- l'application inutilisable. L'hospitalisation garde sa propre capability
-- (hospitalization_enabled, V054) — non dupliquée ici.
-- =============================================================================

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS disabled_modules TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN configuration_clinic_settings.disabled_modules IS
    'V070 — codes des modules désactivés par l''admin (vaccinations, grossesses, '
    'stock, messages, assistant, charges). Vide = tous activés. Masque l''entrée '
    'de navigation correspondante côté IHM.';
