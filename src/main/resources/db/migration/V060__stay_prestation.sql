-- =============================================================================
-- V060 — Hospitalisation : prestations de séjour (actes supplémentaires)
--
-- Pendant un séjour, le cabinet peut fournir des services additionnels
-- (consultation, oxygène, repas, etc.) qui s'ajoutent au prix de journée
-- et sont facturés sur la même facture de séjour.
--
-- Pas de soft-delete : suppression physique autorisée tant que le séjour n'est
-- pas encore facturé (status != FACTURE). Une fois FACTURE, la ligne est gelée
-- via le contrôle applicatif (409 STAY_ALREADY_INVOICED).
-- =============================================================================

CREATE TABLE IF NOT EXISTS hospitalization_stay_prestation (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    stay_id      UUID           NOT NULL REFERENCES hospitalization_stay(id),
    act_id       UUID           NULL REFERENCES catalog_act(id),  -- lien optionnel au catalogue
    label        VARCHAR(255)   NOT NULL,
    unit_price   NUMERIC(10,2)  NOT NULL CHECK (unit_price >= 0),
    quantity     NUMERIC(10,2)  NOT NULL DEFAULT 1 CHECK (quantity > 0),
    performed_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    created_by   UUID           NULL,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

COMMENT ON TABLE hospitalization_stay_prestation IS
    'Actes/services supplémentaires fournis pendant un séjour hospitalier (en dehors du prix de journée). '
    'Ajoutés à la facture de séjour lors de la facturation. Suppression physique autorisée tant que status != FACTURE.';

CREATE INDEX IF NOT EXISTS idx_hosp_prestation_stay
    ON hospitalization_stay_prestation (stay_id, performed_at);
