-- V046 — Liste personnelle de confrères par médecin (référencement externe).
--
-- Chaque médecin tient son propre carnet d'adresses de confrères vers qui
-- orienter ses patients (par spécialité). Tableau scopé au médecin (owner_id),
-- pas de partage cabinet en v1 — chacun fait confiance à sa propre liste.
--
-- v1 = CRUD seul depuis /profil > Mes confrères. La consommation
-- (bouton "Orienter vers..." en consultation + génération d'une lettre
-- d'orientation PDF) reste hors scope et viendra avec un template arrêté.
--
-- Conventions :
--   - owner_id FK ON DELETE CASCADE : si l'utilisateur disparaît, ses
--     contacts personnels disparaissent avec lui (pas de fuite de carnet
--     d'adresses d'un ex-médecin).
--   - specialty libre (VARCHAR 120) — pas d'enum côté DB pour ne pas
--     bloquer les libellés moins courants (homéopathie, médecine du sport…).
--   - Index combiné (owner_id, specialty) pour le filtrage UI par spé.

CREATE TABLE identity_referral_contact (
    id          UUID         PRIMARY KEY,
    owner_id    UUID         NOT NULL,
    full_name   VARCHAR(160) NOT NULL,
    specialty   VARCHAR(120) NOT NULL,
    phone       VARCHAR(40),
    city        VARCHAR(120),
    notes       TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT identity_referral_contact_owner_fkey
        FOREIGN KEY (owner_id) REFERENCES identity_user (id) ON DELETE CASCADE
);

CREATE INDEX idx_referral_contact_owner
    ON identity_referral_contact (owner_id);

CREATE INDEX idx_referral_contact_owner_specialty
    ON identity_referral_contact (owner_id, specialty);

COMMENT ON TABLE identity_referral_contact IS
    'V046 — carnet personnel de confrères par médecin pour orientation patient.';
COMMENT ON COLUMN identity_referral_contact.owner_id IS
    'identity_user.id du médecin propriétaire du carnet.';
