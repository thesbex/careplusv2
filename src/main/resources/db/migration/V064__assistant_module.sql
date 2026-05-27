-- V064 — Assistant IA (médecin)
-- Module ma.careplus.assistant. Historise les conversations entre un médecin
-- (owner) et l'assistant IA. Provider IA configurable (Gemini par défaut) —
-- aucune clé / aucun secret stocké ici, uniquement le fil de discussion.
--
-- patient_id (nullable) : conversation « contextuelle » rattachée à un dossier
-- patient (l'IA reçoit un résumé clinique anonymisé du dossier). NULL = chat
-- médical général sans contexte patient.

CREATE TABLE assistant_conversation (
    id          UUID         PRIMARY KEY,
    owner_id    UUID         NOT NULL REFERENCES identity_user(id),
    patient_id  UUID         NULL REFERENCES patient_patient(id),
    title       VARCHAR(200) NOT NULL DEFAULT 'Nouvelle conversation',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Liste « mes conversations » triée par activité décroissante, cloisonnée owner.
CREATE INDEX idx_assistant_conversation_owner
    ON assistant_conversation (owner_id, updated_at DESC);

CREATE TABLE assistant_message (
    id               UUID        PRIMARY KEY,
    conversation_id  UUID        NOT NULL REFERENCES assistant_conversation(id) ON DELETE CASCADE,
    role             VARCHAR(16) NOT NULL CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
    content          TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fil d'une conversation, ordre chronologique.
CREATE INDEX idx_assistant_message_conversation
    ON assistant_message (conversation_id, created_at);
