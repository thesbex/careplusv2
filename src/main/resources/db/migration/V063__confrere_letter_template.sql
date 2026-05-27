-- =============================================================================
-- Modèles de courrier confrère (bibliothèque admin)
--
-- Table confrere_letter_template
--   Bibliothèque de textes de courrier au confrère, gérée par l'ADMIN et
--   réutilisée par les médecins : le corps du modèle est chargé dans la
--   boîte de dialogue « Courrier confrère » côté frontend.
--   Soft-delete via deleted_at. active=TRUE/FALSE pour activer/désactiver.
--
--   Pas de colonne `type` ni de CHECK : un courrier confrère n'a pas de
--   catégorie. Le texte est stocké tel quel — aucun placeholder n'est traité
--   ici (texte brut). La génération du PDF existe déjà ailleurs.
-- =============================================================================

CREATE TABLE confrere_letter_template (
    id          UUID          NOT NULL DEFAULT gen_random_uuid(),
    title       VARCHAR(200)  NOT NULL,
    body        TEXT          NOT NULL,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by  UUID          NULL REFERENCES identity_user(id) ON DELETE SET NULL,
    deleted_at  TIMESTAMPTZ   NULL,

    CONSTRAINT confrere_letter_template_pk PRIMARY KEY (id)
);

COMMENT ON TABLE  confrere_letter_template        IS 'Bibliothèque de modèles de courrier confrère (admin-managed).';
COMMENT ON COLUMN confrere_letter_template.body   IS 'Texte du courrier confrère, stocké tel quel (texte brut, aucun placeholder traité).';
COMMENT ON COLUMN confrere_letter_template.active IS 'FALSE = désactivé (masqué pour les médecins) sans suppression physique.';

-- Filtre principal : liste non-supprimée, triée par titre
CREATE INDEX idx_confrere_letter_tpl_active
    ON confrere_letter_template (active, title)
    WHERE deleted_at IS NULL;
