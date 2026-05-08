-- V035 — signature scannée par utilisateur (et non plus par cabinet).
--
-- Pourquoi : chaque médecin a sa propre signature manuscrite. Avec la
-- décision multi-praticien (2026-05-07), la signature stockée sur la ligne
-- unique de configuration_clinic_settings ne suffit plus — chaque médecin
-- doit pouvoir téléverser et utiliser la sienne sur ses propres PDF
-- (ordonnance, certificat, carnet vaccination).
--
-- Migration des données : on copie la signature cabinet existante vers
-- TOUS les utilisateurs MEDECIN actifs qui n'ont pas encore la leur. Cela
-- préserve le rendu des PDF déjà générés (visuellement identiques) et
-- chaque médecin pourra ensuite remplacer la sienne.
--
-- Les colonnes signature_* de configuration_clinic_settings sont laissées
-- en place pour cette release : aucun code ne les lit plus en V035, mais
-- on évite la perte de données si un rollback rapide était nécessaire.
-- Suppression prévue dans une migration ultérieure (V036+).

ALTER TABLE identity_user
    ADD COLUMN IF NOT EXISTS signature_blob BYTEA NULL,
    ADD COLUMN IF NOT EXISTS signature_mime VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS signature_uploaded_at TIMESTAMPTZ NULL;

-- Backfill — on lie le blob cabinet existant à chaque MEDECIN actif sans
-- signature. Idempotent : ne touche pas les utilisateurs qui en ont déjà
-- une (ré-exécution safe).
UPDATE identity_user u
SET signature_blob = c.signature_blob,
    signature_mime = c.signature_mime,
    signature_uploaded_at = c.signature_uploaded_at
FROM configuration_clinic_settings c
WHERE u.signature_blob IS NULL
  AND c.signature_blob IS NOT NULL
  AND u.enabled = TRUE
  AND EXISTS (
      SELECT 1 FROM identity_user_role ur
      JOIN identity_role r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND r.code = 'MEDECIN'
  );
