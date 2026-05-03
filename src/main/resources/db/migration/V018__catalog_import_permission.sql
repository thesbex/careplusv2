-- V018 — `CATALOG_IMPORT` permission for CSV-based catalog admin uploads.
--
-- Différent de DOCUMENT_IMPORT_ADMIN (V014) qui contrôle l'import auto
-- des documents patient via IMAP/webhook. Ici c'est l'upload manuel par
-- un admin d'un fichier CSV qui ajoute / met à jour des médicaments,
-- analyses ou examens d'imagerie dans le catalogue (rapport
-- Y. Boutaleb 2026-05-01).
--
-- Granted par défaut : ADMIN + MEDECIN. SECRETAIRE / ASSISTANT à FALSE.

INSERT INTO identity_role_permission (role_code, permission, granted) VALUES
    ('ADMIN',      'CATALOG_IMPORT', TRUE),
    ('MEDECIN',    'CATALOG_IMPORT', TRUE),
    ('SECRETAIRE', 'CATALOG_IMPORT', FALSE),
    ('ASSISTANT',  'CATALOG_IMPORT', FALSE)
ON CONFLICT (role_code, permission) DO NOTHING;
