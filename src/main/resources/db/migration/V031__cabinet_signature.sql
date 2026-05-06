-- =============================================================================
-- F16 — Signature médecin auto-injectée sur tous les PDF générés.
--
-- On stocke directement les bytes de l'image dans la table
-- `configuration_clinic_settings` (option A) :
--   • simplicité : pas de gestion de fichiers, pas de cleanup orphelin
--   • transactionnel : un upload = un commit, pas de désync DB ↔ FS
--   • sauvegarde : déjà couverte par le dump PostgreSQL existant
--   • taille bornée : la validation backend interdit > 500 Ko
--
-- La table est single-row en v1 (un cabinet par installation), donc la limite
-- pratique sur le poids total du blob est insignifiante.
-- =============================================================================

ALTER TABLE configuration_clinic_settings
    ADD COLUMN signature_blob        BYTEA,
    ADD COLUMN signature_mime        VARCHAR(50),
    ADD COLUMN signature_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN configuration_clinic_settings.signature_blob IS
    'Bytes bruts de la signature scannée du médecin (PNG / JPEG / WEBP, max 500 Ko côté backend). NULL si non configurée — le PDF tombe alors back sur le cachet texte.';
COMMENT ON COLUMN configuration_clinic_settings.signature_mime IS
    'MIME type de l''image stockée (image/png, image/jpeg, image/webp). NULL si pas de signature.';
COMMENT ON COLUMN configuration_clinic_settings.signature_uploaded_at IS
    'Horodatage du dernier upload — sert de cache buster côté frontend.';
