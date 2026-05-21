-- =============================================================================
-- Présence live pour la messagerie (ADR-035 v2 follow-up).
--
-- Chaque utilisateur ping un endpoint heartbeat toutes les 30 s tant qu'une
-- session est active dans le browser. La présence est dérivée du delta :
--   < 90 s   → on        (vert)
--   < 5 min  → away      (orange)
--   sinon    → off       (gris)
--
-- Note : on stocke le timestamp directement sur identity_user au lieu d'une
-- table chat_presence dédiée — la donnée est uniforme (1 ligne par user, peu
-- volatile au repos) et plusieurs futures features (Last active, audit
-- "qui était sur la base à 14h"…) en bénéficient.
-- =============================================================================

ALTER TABLE identity_user
    ADD COLUMN last_seen_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN identity_user.last_seen_at IS
    'Dernier ping heartbeat du user (chat presence). NULL = jamais connecté en v2+.';
