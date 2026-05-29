-- =============================================================================
-- V067 — Pause déjeuner par médecin
--
-- User request : chaque médecin peut préciser SON horaire de pause déjeuner,
-- pendant lequel il est interdit de prendre des rendez-vous (enforced à la
-- création/déplacement + exclu des créneaux de disponibilité).
--
-- Modèle : une seule fenêtre par praticien (PK = practitioner_id), appliquée à
-- tous les jours travaillés. Avant V067, la « Pause déjeuner 12–14H » était
-- codée en dur et globale côté frontend, sans aucun blocage à la réservation.
-- =============================================================================

CREATE TABLE scheduling_practitioner_lunch_break (
    practitioner_id UUID        NOT NULL REFERENCES identity_user(id) ON DELETE CASCADE,
    start_time      TIME        NOT NULL,
    end_time        TIME        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT scheduling_practitioner_lunch_break_pk PRIMARY KEY (practitioner_id),
    CONSTRAINT scheduling_lunch_break_time_ck CHECK (end_time > start_time)
);

COMMENT ON TABLE scheduling_practitioner_lunch_break IS
    'Pause déjeuner par médecin (une fenêtre, tous les jours travaillés). Bloque la prise de RDV.';
