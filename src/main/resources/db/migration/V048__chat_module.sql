-- =============================================================================
-- Module chat — messagerie d'équipe iso-maquette (canaux + DM + fils patient).
--
-- Périmètre (cf. `design/prototype/screens/messages.jsx` +
-- `design/prototype/mobile/messages.jsx` — maquette ADR-035) :
--   - **Canaux** thématiques (général, urgences, planning, pharmacie, admin)
--     avec membres, mentions, pinned message, fichiers partagés (post-MVP).
--   - **DMs** 1-1 (user_a/user_b en forme canonique).
--   - **Fils patient** : conversation rattachée à un dossier patient, avec
--     plusieurs participants (médecin + secrétaire + infirmière).
--   - Messages : texte, mentions @user, réactions emoji, threading (parent),
--     flag urgent, attache patient (sara El Khattabi · PT-00489), pinned.
--
-- Choix de schéma :
--   - Une table unique `chat_conversation` portant un `kind` ∈ {DM, CHANNEL,
--     PATIENT_THREAD}. Les DMs gardent `user_a_id < user_b_id` UNIQUE (forme
--     canonique). Les channels portent `name` + `topic` + `color`. Les fils
--     patient portent `patient_id` + `subject`.
--   - Membership porté par `chat_conversation_member` (PK composite). Pour les
--     DM, c'est dénormalisé (2 lignes générées au start) → unification du SQL
--     de lecture des conversations.
--   - Messages : `chat_message` étendu avec `parent_message_id` (threading),
--     `patient_id` (attach), `is_urgent`, `pinned_at` + tables `chat_message_mention`
--     et `chat_message_reaction` (chacune une ligne par mention/réaction).
-- =============================================================================

-- ── chat_conversation ────────────────────────────────────────────────────────
CREATE TABLE chat_conversation (
    id              UUID PRIMARY KEY,
    kind            VARCHAR(20) NOT NULL,            -- 'DM' | 'CHANNEL' | 'PATIENT_THREAD'
    -- DM fields ---------------------------------------------------------------
    user_a_id       UUID NULL REFERENCES identity_user (id),
    user_b_id       UUID NULL REFERENCES identity_user (id),
    -- CHANNEL fields ----------------------------------------------------------
    name            VARCHAR(64) NULL,                -- ex. 'urgences'
    topic           TEXT        NULL,                -- ex. 'Coordination des cas urgents…'
    color           VARCHAR(16) NULL,                -- hex pour les fils patient
    -- PATIENT_THREAD fields ---------------------------------------------------
    patient_id      UUID NULL REFERENCES patient_patient (id) ON DELETE CASCADE,
    subject         TEXT        NULL,                -- ex. 'Suivi HTA · ajustement traitement'
    -- common ------------------------------------------------------------------
    pinned_message_id  UUID NULL,                    -- FK softer — on n'attache pas en CASCADE
    last_message_at TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chat_conversation_kind_chk
        CHECK (kind IN ('DM','CHANNEL','PATIENT_THREAD')),
    CONSTRAINT chat_conversation_dm_pair_chk
        CHECK (kind <> 'DM'
               OR (user_a_id IS NOT NULL AND user_b_id IS NOT NULL AND user_a_id < user_b_id)),
    CONSTRAINT chat_conversation_channel_name_chk
        CHECK (kind <> 'CHANNEL' OR (name IS NOT NULL AND length(name) > 0)),
    CONSTRAINT chat_conversation_patient_chk
        CHECK (kind <> 'PATIENT_THREAD' OR patient_id IS NOT NULL)
);

-- Forme canonique pour les DMs : 1 paire = 1 conversation max.
CREATE UNIQUE INDEX uk_chat_conversation_dm_pair
    ON chat_conversation (user_a_id, user_b_id)
    WHERE kind = 'DM';
CREATE UNIQUE INDEX uk_chat_conversation_channel_name
    ON chat_conversation (lower(name))
    WHERE kind = 'CHANNEL';

CREATE INDEX idx_chat_conversation_last_msg
    ON chat_conversation (last_message_at DESC NULLS LAST);
CREATE INDEX idx_chat_conversation_patient
    ON chat_conversation (patient_id)
    WHERE patient_id IS NOT NULL;

CREATE TRIGGER chat_conversation_touch_updated_at
    BEFORE UPDATE ON chat_conversation
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ── chat_conversation_member ────────────────────────────────────────────────
-- Membership uniforme pour les 3 kinds. Pour les DMs, 2 lignes générées au
-- start. Pour les channels et patient threads, ajout/retrait explicite.
CREATE TABLE chat_conversation_member (
    conversation_id UUID NOT NULL REFERENCES chat_conversation (id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES identity_user (id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_chat_conv_member_user
    ON chat_conversation_member (user_id);


-- ── chat_message ─────────────────────────────────────────────────────────────
CREATE TABLE chat_message (
    id                  UUID PRIMARY KEY,
    conversation_id     UUID NOT NULL REFERENCES chat_conversation (id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES identity_user (id),
    body                TEXT NOT NULL,
    -- Threading : NULL = top-level. Si non-null, message est une réponse.
    parent_message_id   UUID NULL REFERENCES chat_message (id) ON DELETE SET NULL,
    -- Attache patient : sticker affiché sous la bulle ("Mme X · PT-00489")
    patient_id          UUID NULL REFERENCES patient_patient (id) ON DELETE SET NULL,
    -- Flag urgent : bordure rouge + bande dans le rendu
    is_urgent           BOOLEAN NOT NULL DEFAULT FALSE,
    -- Pinned (cf. chat_conversation.pinned_message_id pour le pinned courant)
    pinned_at           TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chat_message_body_len_chk CHECK (length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX idx_chat_message_conv_created
    ON chat_message (conversation_id, created_at DESC);
CREATE INDEX idx_chat_message_parent
    ON chat_message (parent_message_id)
    WHERE parent_message_id IS NOT NULL;

-- FK soft pour pinned_message_id maintenant que chat_message existe.
ALTER TABLE chat_conversation
    ADD CONSTRAINT chat_conversation_pinned_message_fkey
        FOREIGN KEY (pinned_message_id) REFERENCES chat_message (id) ON DELETE SET NULL;


-- ── chat_message_mention ────────────────────────────────────────────────────
-- Une ligne par @user mentionné dans un message. Drive le compteur "mentions"
-- côté liste mobile + le surlignage @prénom dans le rendu.
CREATE TABLE chat_message_mention (
    message_id      UUID NOT NULL REFERENCES chat_message (id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES identity_user (id),
    PRIMARY KEY (message_id, mentioned_user_id)
);

CREATE INDEX idx_chat_mention_user
    ON chat_message_mention (mentioned_user_id);


-- ── chat_message_reaction ───────────────────────────────────────────────────
-- Une ligne par (message, user, emoji). Permet de compter par emoji et de
-- retirer la réaction de l'utilisateur courant.
CREATE TABLE chat_message_reaction (
    message_id      UUID NOT NULL REFERENCES chat_message (id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES identity_user (id),
    emoji           VARCHAR(16) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id, emoji)
);


-- ── chat_read_state ─────────────────────────────────────────────────────────
CREATE TABLE chat_read_state (
    conversation_id UUID NOT NULL REFERENCES chat_conversation (id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES identity_user (id),
    last_read_at    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_chat_read_state_user ON chat_read_state (user_id);


-- ── Seed : 5 canaux par défaut (cf. fixtures maquette) ──────────────────────
INSERT INTO chat_conversation (id, kind, name, topic, color)
VALUES
    ('a0c00001-0000-0000-0000-000000000001', 'CHANNEL', 'général',       'Espace équipe',                         '#3F7A3A'),
    ('a0c00001-0000-0000-0000-000000000002', 'CHANNEL', 'urgences',      'Coordination des cas urgents et triage de la salle d''attente', '#A8321E'),
    ('a0c00001-0000-0000-0000-000000000003', 'CHANNEL', 'planning',      'Agenda et remplacements',               '#1E5AA8'),
    ('a0c00001-0000-0000-0000-000000000004', 'CHANNEL', 'pharmacie',     'Stocks et commandes',                   '#B8500C'),
    ('a0c00001-0000-0000-0000-000000000005', 'CHANNEL', 'administratif', 'CNSS, factures, CNOPS',                 '#6B6B6B');

-- Auto-join : tout user actif est membre des canaux à l'install. Au runtime,
-- ce sera fait par le `ChannelService` à la création d'un user ou d'un canal.
INSERT INTO chat_conversation_member (conversation_id, user_id)
SELECT c.id, u.id
  FROM chat_conversation c
  CROSS JOIN identity_user u
 WHERE c.kind = 'CHANNEL'
   AND u.enabled = TRUE
ON CONFLICT DO NOTHING;


COMMENT ON TABLE chat_conversation IS
    'Conversation unifiée : DM 1-1, canal thématique, ou fil patient. kind discrimine.';
COMMENT ON COLUMN chat_conversation.kind IS
    'DM | CHANNEL | PATIENT_THREAD — drive le contrat des autres colonnes.';
COMMENT ON TABLE chat_conversation_member IS
    'Membership uniforme. Pour les DMs, 2 lignes dénormalisées au start (unification SQL lecture).';
COMMENT ON TABLE chat_message IS
    'Message texte avec threading + attache patient + flag urgent + pinning.';
COMMENT ON TABLE chat_message_mention IS
    'Une ligne par @user mentionné. Drive le compteur "mentions" côté UI.';
COMMENT ON TABLE chat_message_reaction IS
    'Une ligne par (message, user, emoji). Permet COUNT par emoji + remove de la réaction du caller.';
