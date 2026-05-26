-- =============================================================================
-- QA9-13 — Modèles de consentement (bibliothèque admin) + type CONSENTEMENT
--
-- Part A : table clinical_consent_template
--   Bibliothèque de textes de consentement gérée par l'ADMIN et réutilisée
--   par les médecins pour générer/imprimer un document signé avec le patient.
--   Soft-delete via deleted_at. active=TRUE/FALSE pour activer/désactiver.
--
-- Part B : ajouter CONSENTEMENT au commentaire de patient_document.type
--   (V009 déclare la colonne en VARCHAR(32) sans CHECK — on est libre d'ajouter
--    la valeur côté applicatif via l'enum DocumentType. Aucune contrainte DB
--    à modifier.)
-- =============================================================================

CREATE TABLE clinical_consent_template (
    id          UUID          NOT NULL DEFAULT gen_random_uuid(),
    type        VARCHAR(40)   NOT NULL,
    title       VARCHAR(200)  NOT NULL,
    body        TEXT          NOT NULL,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by  UUID          NULL REFERENCES identity_user(id) ON DELETE SET NULL,
    deleted_at  TIMESTAMPTZ   NULL,

    CONSTRAINT clinical_consent_template_pk      PRIMARY KEY (id),
    CONSTRAINT clinical_consent_template_type_ck CHECK (type IN (
        'PARTAGE_DOSSIER',
        'ACTE_OPERATOIRE',
        'ANESTHESIE',
        'IMAGERIE',
        'PRELEVEMENT',
        'HOSPITALISATION',
        'AUTRE'
    ))
);

COMMENT ON TABLE  clinical_consent_template        IS 'QA9-13 — Bibliothèque de modèles de consentement (admin-managed).';
COMMENT ON COLUMN clinical_consent_template.type   IS 'PARTAGE_DOSSIER | ACTE_OPERATOIRE | ANESTHESIE | IMAGERIE | PRELEVEMENT | HOSPITALISATION | AUTRE';
COMMENT ON COLUMN clinical_consent_template.body   IS 'Texte du consentement. Placeholders : {{patientNom}}, {{patientCin}}, {{dateJour}}, {{cabinet}}.';
COMMENT ON COLUMN clinical_consent_template.active IS 'FALSE = désactivé (masqué pour les médecins) sans suppression physique.';

-- Filtre principal : liste non-supprimée, triée par titre
CREATE INDEX idx_consent_tpl_active
    ON clinical_consent_template (type, active, title)
    WHERE deleted_at IS NULL;

-- Update patient_document.type comment to include CONSENTEMENT
COMMENT ON COLUMN patient_document.type IS 'PRESCRIPTION_HISTORIQUE | ANALYSE | IMAGERIE | COMPTE_RENDU | AUTRE | PHOTO | RESULTAT | CONSENTEMENT';
