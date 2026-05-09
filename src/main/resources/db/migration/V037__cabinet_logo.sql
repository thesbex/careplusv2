-- =============================================================================
-- Logo établissement injecté sur tous les PDFs générés (ordonnance, certificat,
-- carnet vaccination). Pattern identique à V031 (signature médecin) et V035
-- (signature per-praticien) :
--   • bytes stockés en DB (BYTEA), pas de filesystem (cohérent ADR-020)
--   • single-row (un cabinet par installation), limite pratique négligeable
--   • validation taille (≤ 500 KB) côté backend, MIME ∈ {png, jpeg}
--
-- NULL = pas de logo configuré → fallback texte (rendu actuel inchangé).
-- =============================================================================

ALTER TABLE configuration_clinic_settings
    ADD COLUMN logo_blob        BYTEA,
    ADD COLUMN logo_mime        VARCHAR(50),
    ADD COLUMN logo_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN configuration_clinic_settings.logo_blob IS
    'Bytes bruts du logo de l''établissement (PNG / JPEG, max 500 Ko côté backend). NULL si non configuré — l''en-tête PDF rend alors le nom en texte seul.';
COMMENT ON COLUMN configuration_clinic_settings.logo_mime IS
    'MIME type de l''image stockée (image/png, image/jpeg). NULL si pas de logo.';
COMMENT ON COLUMN configuration_clinic_settings.logo_uploaded_at IS
    'Horodatage du dernier upload — sert de cache buster côté frontend.';
