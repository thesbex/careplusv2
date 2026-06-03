-- V073 — apparence PERSONNELLE par utilisateur (override du défaut cabinet V072).
--
-- Contexte : V072 a introduit `configuration_clinic_settings.appearance`, un thème
-- unique réglé par le super administrateur et appliqué à TOUS les utilisateurs.
-- Demande produit : chaque utilisateur doit pouvoir personnaliser SON affichage.
--
-- Résolution appliquée par le front : override perso → défaut cabinet → défaut app.
-- NULL (valeur par défaut) = l'utilisateur suit le défaut d'apparence du cabinet.
ALTER TABLE identity_user ADD COLUMN appearance VARCHAR(2000);

COMMENT ON COLUMN identity_user.appearance IS
  'V073 — apparence personnelle (JSON : font, tone, accent, dark, navActive, btnPrimary, logo...). '
  'NULL = suit le défaut cabinet (configuration_clinic_settings.appearance, V072).';
