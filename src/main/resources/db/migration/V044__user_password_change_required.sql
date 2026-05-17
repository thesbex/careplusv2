-- V044 — Force-change-password flag for admin-initiated resets
--
-- When an admin resets a user's password, we want to force that user to
-- pick a new one on next login so the admin never ends up holding the
-- persistent credential. The flag is cleared by POST /api/me/change-password
-- once the user has chosen a new password.
--
-- Backward-compatible default FALSE keeps every existing user unaffected.

ALTER TABLE identity_user
    ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT FALSE;
