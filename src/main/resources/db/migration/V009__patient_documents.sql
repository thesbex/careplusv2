-- =============================================================================
-- V009 — Patient documents (QA2-2)
-- =============================================================================
-- Stockage des documents historiques fournis par le patient à la création
-- ou en cours de suivi : anciennes prescriptions, comptes-rendus, résultats
-- d'analyses, imagerie. Le contenu binaire vit sur le disque local sous
-- `careplus.documents.root` (défaut : ./data/documents) ; cette table garde
-- la métadonnée + la clé de stockage.
--
-- Soft-delete via `deleted_at` : les documents disparaissent de l'UI mais
-- le fichier reste sur disque jusqu'à un job de nettoyage (post-MVP).
-- Cohérent avec patient_patient — qui peut être archivé sans purger ses
-- documents.

CREATE TABLE patient_document (
    id                UUID         PRIMARY KEY,
    patient_id        UUID         NOT NULL REFERENCES patient_patient(id) ON DELETE CASCADE,
    type              VARCHAR(32)  NOT NULL,
    original_filename TEXT         NOT NULL,
    mime_type         VARCHAR(128) NOT NULL,
    size_bytes        BIGINT       NOT NULL,
    storage_key       TEXT         NOT NULL,
    notes             TEXT,
    uploaded_by       UUID         NOT NULL REFERENCES identity_user(id),
    uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_patient_document_patient
    ON patient_document(patient_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_patient_document_type
    ON patient_document(patient_id, type)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE  patient_document          IS 'Documents historiques rattachés au dossier patient (PDF, images).';
COMMENT ON COLUMN patient_document.type     IS 'PRESCRIPTION_HISTORIQUE | ANALYSE | IMAGERIE | COMPTE_RENDU | AUTRE';
COMMENT ON COLUMN patient_document.storage_key IS 'Chemin relatif sous careplus.documents.root, ex. <patient_id>/<doc_id>.pdf';
