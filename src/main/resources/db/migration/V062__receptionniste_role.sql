-- =============================================================================
-- V062 — Rôle RÉCEPTIONNISTE (bureau des admissions d'une clinique / hôpital)
--
-- La fonctionnalité d'admission hospitalière doit pouvoir être déléguée à un
-- profil dédié « Réceptionniste », distinct de la secrétaire de cabinet. Ce
-- rôle n'a de sens que lorsque l'établissement hospitalise
-- (hospitalization_enabled = TRUE, suggéré pour CLINIQUE / HOPITAL — V054).
-- L'IHM ne propose le rôle que dans ce cas ; ici on se contente d'ajouter le
-- rôle + ses permissions au référentiel (toujours présent, inerte tant qu'aucun
-- utilisateur ne le porte).
--
-- Calque l'ajout INFIRMIER (V054) et RADIO/LAB (V038) : identity_user_role est
-- déjà multi-rôle, donc un utilisateur peut cumuler RECEPTIONNISTE avec d'autres.
-- =============================================================================

-- 1. Le rôle lui-même (id ...008, suite logique après INFIRMIER = ...007).
INSERT INTO identity_role (id, code, label_fr) VALUES
    ('00000000-0000-0000-0000-000000000008', 'RECEPTIONNISTE', 'Réceptionniste')
ON CONFLICT (code) DO NOTHING;

-- 2. Jeu de permissions « bureau des admissions ». On reprend les codes déjà
--    définis dans la matrice (V008 : PATIENT_READ / APPOINTMENT_READ /
--    ARRIVAL_DECLARE / INVOICE_READ ; V054 : HOSPITALIZATION_ADMIT). Le
--    réceptionniste lit les patients, le planning, déclare les arrivées, lit la
--    facturation et admet en hospitalisation. Il n'émet pas de facture
--    (INVOICE_ISSUE) ni ne crée de patient/RDV par défaut — éditable ensuite
--    depuis Paramétrage > Droits d'accès.
INSERT INTO identity_role_permission (role_code, permission, granted) VALUES
    ('RECEPTIONNISTE', 'PATIENT_READ',           TRUE),
    ('RECEPTIONNISTE', 'APPOINTMENT_READ',       TRUE),
    ('RECEPTIONNISTE', 'ARRIVAL_DECLARE',        TRUE),
    ('RECEPTIONNISTE', 'INVOICE_READ',           TRUE),
    ('RECEPTIONNISTE', 'HOSPITALIZATION_ADMIT',  TRUE)
ON CONFLICT (role_code, permission) DO NOTHING;
