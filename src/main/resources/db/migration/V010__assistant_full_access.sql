-- =============================================================================
-- V010 — ASSISTANT obtient un accès complet (parité avec MEDECIN)
-- =============================================================================
-- Demande utilisateur : "full access to assistante".
-- On bascule tous les flags du rôle ASSISTANT dans identity_role_permission
-- à TRUE. Le backend (PreAuthorize hardcoded en v1, cf. ADR sur QA3-3) doit
-- être complété en parallèle pour ajouter ASSISTANT aux hasAnyRole où il
-- manque ; voir le commit applicatif associé.

UPDATE identity_role_permission
SET    granted    = TRUE,
       updated_at = now()
WHERE  role_code  = 'ASSISTANT';

-- Au cas où une permission ait été ajoutée plus tard sans ligne ASSISTANT.
INSERT INTO identity_role_permission (role_code, permission, granted)
SELECT 'ASSISTANT', permission, TRUE
FROM (
    SELECT DISTINCT permission FROM identity_role_permission
) p
ON CONFLICT (role_code, permission) DO NOTHING;
