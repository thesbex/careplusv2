-- =============================================================================
-- V069 — Rôle SUPER_ADMIN
--
-- Demande client : seul un « super administrateur » doit pouvoir modifier
-- l'Identité du centre médical, les Services internes (labo / radio / pharmacie)
-- et l'Hospitalisation. Un administrateur « normal » gère les utilisateurs, le
-- catalogue, les tarifs, etc., mais n'a plus la main sur ces 3 sections.
--
-- Stratégie (faible risque, additive) :
--   • On ajoute le rôle SUPER_ADMIN au référentiel.
--   • On PROMEUT tous les ADMIN existants en SUPER_ADMIN : ils CONSERVENT le
--     rôle ADMIN et gagnent SUPER_ADMIN. Aucune install en service ne perd
--     l'accès. Les NOUVEAUX comptes créés en « Administrateur » n'auront que
--     ADMIN → ils sont bloqués sur les 3 sections sensibles (garde au niveau
--     des champs dans SettingsController.updateClinic + grisage IHM).
--   • SUPER_ADMIN hérite du même jeu de permissions que ADMIN (matrice V008),
--     afin d'être pleinement opérationnel s'il est un jour porté seul.
-- =============================================================================

-- 1. Le rôle (id ...009, suite après RECEPTIONNISTE = ...008 en V062).
INSERT INTO identity_role (id, code, label_fr) VALUES
    ('00000000-0000-0000-0000-000000000009', 'SUPER_ADMIN', 'Super administrateur')
ON CONFLICT (code) DO NOTHING;

-- 2. Permissions : SUPER_ADMIN = copie de la matrice ADMIN.
INSERT INTO identity_role_permission (role_code, permission, granted)
SELECT 'SUPER_ADMIN', permission, granted
  FROM identity_role_permission
 WHERE role_code = 'ADMIN'
ON CONFLICT (role_code, permission) DO NOTHING;

-- 3. Promotion : chaque utilisateur portant ADMIN reçoit aussi SUPER_ADMIN
--    (additif — il garde ADMIN). Sans utilisateur (install neuve), ne fait rien :
--    le bootstrap du premier admin lui accorde SUPER_ADMIN (cf. AdminBootstrapController).
INSERT INTO identity_user_role (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM identity_role WHERE code = 'SUPER_ADMIN')
  FROM identity_user_role ur
  JOIN identity_role r ON r.id = ur.role_id
 WHERE r.code = 'ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;
