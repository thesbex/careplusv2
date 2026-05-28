-- =============================================================================
-- V065 — Modèles de courrier confrère scopés par médecin
--
-- User request 2026-05-28 : « modèles de lettre confrère associés à chaque
-- médecin ». Avant V065, tous les modèles étaient cabinet-wide. On ajoute
-- une colonne `owner_user_id` nullable :
--   - NULL  → modèle cabinet-wide (visible par tous les médecins)
--   - <uuid> → modèle privé du médecin propriétaire (visible seulement par lui)
--
-- L'admin garde la possibilité d'éditer/supprimer les deux (cabinet-wide ou
-- per-medecin) — filtrage côté service.
-- =============================================================================

ALTER TABLE confrere_letter_template
    ADD COLUMN owner_user_id UUID NULL
        REFERENCES identity_user(id) ON DELETE SET NULL;

COMMENT ON COLUMN confrere_letter_template.owner_user_id IS
    'NULL = modèle partagé (cabinet-wide), UUID = modèle privé du médecin propriétaire.';

-- Index pour le filtre principal du dialog courrier confrère :
-- (owner IS NULL OR owner = ?) AND active AND deleted_at IS NULL.
CREATE INDEX idx_confrere_letter_tpl_owner_active
    ON confrere_letter_template (owner_user_id, active)
    WHERE deleted_at IS NULL;
