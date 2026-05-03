-- =============================================================================
-- V014 — Photo patient (QA5-3) + import auto skeleton (QA5-1)
-- =============================================================================
--
-- 1. Photo patient (QA5-3) :
--    - Réutilise patient_document avec un nouveau type 'PHOTO'.
--    - Dénormalise patient_document.id courant sur patient_patient.photo_document_id
--      pour permettre un rendu rapide de la liste patients (évite N sous-requêtes).
--    - Lors d'un upload PHOTO, l'application :
--        a) soft-delete l'éventuelle photo précédente,
--        b) crée la nouvelle ligne patient_document type='PHOTO',
--        c) met à jour patient_patient.photo_document_id.
--
-- 2. Import auto squelette (QA5-1) :
--    - Tables document_import_source (source configurée par l'admin) et
--      document_import_inbox (file d'attente de validation pour les
--      documents arrivés automatiquement et non encore rattachés).
--    - Permission DOCUMENT_IMPORT_ADMIN ajoutée à identity_role_permission,
--      seedée pour ADMIN + MEDECIN par défaut. SECRETAIRE/ASSISTANT à FALSE.
--    - Le poller IMAP / webhook lui-même n'est PAS livré ici — c'est la partie
--      ~10 jours de QA5-1. Cette migration prépare le terrain pour qu'il puisse
--      être branché plus tard sans deuxième round de schéma.

-- ── 1. Photo patient ─────────────────────────────────────────────────────────

ALTER TABLE patient_patient
    ADD COLUMN photo_document_id UUID NULL REFERENCES patient_document(id) ON DELETE SET NULL;

CREATE INDEX idx_patient_photo_document
    ON patient_patient(photo_document_id)
    WHERE photo_document_id IS NOT NULL;

COMMENT ON COLUMN patient_patient.photo_document_id IS
    'FK vers patient_document type=PHOTO en cours. NULL si aucune photo. Mis à jour par PatientPhotoController.';

-- Le commentaire de patient_document.type est mis à jour pour mentionner PHOTO.
COMMENT ON COLUMN patient_document.type IS
    'PRESCRIPTION_HISTORIQUE | ANALYSE | IMAGERIE | COMPTE_RENDU | AUTRE | PHOTO';

-- ── 2. Import auto — sources + corbeille ─────────────────────────────────────

CREATE TABLE document_import_source (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    label           VARCHAR(128) NOT NULL,
    type            VARCHAR(32)  NOT NULL, -- EMAIL_INBOX | FOLDER_WATCH | HTTP_WEBHOOK
    config          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    enabled         BOOLEAN      NOT NULL DEFAULT FALSE,
    last_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      UUID         REFERENCES identity_user(id),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  document_import_source IS
    'Sources d''import automatique de documents (boîte mail dédiée, dossier surveillé, webhook). QA5-1.';
COMMENT ON COLUMN document_import_source.type IS
    'EMAIL_INBOX | FOLDER_WATCH | HTTP_WEBHOOK';
COMMENT ON COLUMN document_import_source.config IS
    'Paramètres spécifiques au type — ex. { "host": "imap.gmail.com", "username": "...", "allowed_senders": ["..."] }';

CREATE TABLE document_import_inbox (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id           UUID         NOT NULL REFERENCES document_import_source(id) ON DELETE CASCADE,
    raw_file_key        TEXT         NOT NULL,
    original_filename   TEXT         NOT NULL,
    mime_type           VARCHAR(128) NOT NULL,
    size_bytes          BIGINT       NOT NULL,
    parsed_metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    matched_patient_id  UUID         NULL REFERENCES patient_patient(id) ON DELETE SET NULL,
    status              VARCHAR(32)  NOT NULL DEFAULT 'PENDING_REVIEW',
    -- PENDING_REVIEW | MATCHED | REJECTED
    received_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reviewed_by         UUID         REFERENCES identity_user(id),
    reviewed_at         TIMESTAMPTZ
);

CREATE INDEX idx_document_import_inbox_status
    ON document_import_inbox(status, received_at);

CREATE INDEX idx_document_import_inbox_source
    ON document_import_inbox(source_id);

COMMENT ON TABLE  document_import_inbox IS
    'File d''attente des documents arrivés via une source. QA5-1.';
COMMENT ON COLUMN document_import_inbox.status IS
    'PENDING_REVIEW | MATCHED | REJECTED';
COMMENT ON COLUMN document_import_inbox.parsed_metadata IS
    'Données extraites du document/email — sender, subject, ocr_hint, candidate_patient_ids…';

-- ── 3. Permission DOCUMENT_IMPORT_ADMIN ─────────────────────────────────────

INSERT INTO identity_role_permission (role_code, permission, granted) VALUES
    ('ADMIN',      'DOCUMENT_IMPORT_ADMIN', TRUE),
    ('MEDECIN',    'DOCUMENT_IMPORT_ADMIN', TRUE),
    ('SECRETAIRE', 'DOCUMENT_IMPORT_ADMIN', FALSE),
    ('ASSISTANT',  'DOCUMENT_IMPORT_ADMIN', FALSE)
ON CONFLICT (role_code, permission) DO NOTHING;

-- V010 a élevé ASSISTANT à TRUE pour toute permission existante. La permission
-- ci-dessus étant nouvelle, le seed FALSE est correct ; admins peuvent l'élever
-- depuis l'UI s'ils le souhaitent.
