-- =============================================================================
-- Pièces jointes dans le chat (Suivi CarePlus 2026-05-22 — item Waiting :
-- « Dans les messages, je souhaite avoir la possibilité de joindre un document
-- et l'envoyer »).
--
-- v1 : 1 PJ par message, fichier (PDF / image) stocké via DocumentStorage sous
-- chat/<conversation-id>/<attachment-id>.<ext>. La méta vit dans cette table,
-- jamais dans patient_document — une PJ chat n'est pas attachée à un dossier
-- patient (c'est une communication entre users).
--
-- Suppression : si le message est supprimé (jamais en v1, chat_message est
-- immuable), ON DELETE CASCADE retire aussi la PJ. Le binaire physique est
-- nettoyé séparément (best-effort, voir ChatServiceImpl.deleteAttachmentFile).
-- =============================================================================

CREATE TABLE chat_attachment (
    id                UUID PRIMARY KEY,
    message_id        UUID NOT NULL REFERENCES chat_message(id) ON DELETE CASCADE,
    storage_key       VARCHAR(255) NOT NULL,
    mime              VARCHAR(128) NOT NULL,
    size_bytes        BIGINT       NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    uploaded_by       UUID         NOT NULL REFERENCES identity_user(id),
    uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_attachment_message ON chat_attachment(message_id);

COMMENT ON TABLE chat_attachment IS
    'V053 — pièces jointes de messages chat. Stockage : chat/<convId>/<attId>.<ext>.';
