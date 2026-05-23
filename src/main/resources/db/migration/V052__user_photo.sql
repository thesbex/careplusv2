-- =============================================================================
-- Photo de profil utilisateur (Suivi CarePlus 2026-05-22 — item Waiting :
-- « un médecin devrait aussi avoir la possibilité d'uploader sa photo dans
-- sa page de profil. cette photo doit être utilisée pour le chat »).
--
-- Stockée directement sur identity_user (vs. via patient_document) parce qu'un
-- user n'a pas de patient_id et le binaire n'est pas un dossier patient.
-- Le binaire vit sous documents.root/users/<userId>.<ext> via DocumentStorage.
--
-- Colonnes nullable : pas d'obligation, l'avatar tombe sur les initiales si
-- aucune photo.
-- =============================================================================

ALTER TABLE identity_user
    ADD COLUMN photo_storage_key VARCHAR(255) NULL,
    ADD COLUMN photo_mime VARCHAR(64) NULL,
    ADD COLUMN photo_size_bytes BIGINT NULL,
    ADD COLUMN photo_uploaded_at TIMESTAMPTZ NULL;
