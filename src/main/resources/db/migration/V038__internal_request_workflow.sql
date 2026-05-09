-- =============================================================================
-- Workflow de traitement INTERNE des demandes LAB / IMAGING.
--
-- Quand un établissement dispose d'un service interne (V034 :
-- imaging_internal / lab_internal), le médecin peut, lors de la création d'une
-- ordonnance LAB ou IMAGING, cocher "Réaliser en interne". La ligne
-- correspondante part alors dans la queue du service interne au lieu de
-- générer un bon papier remis au patient.
--
-- Au lieu d'introduire une nouvelle table internal_request (qui dupliquerait
-- la ligne), on étend clinical_prescription_line avec un statut + horodatage
-- + identité du technicien. Le résultat reste lié via V015
-- (clinical_prescription_line.result_document_id), donc l'auto-attachement à
-- la consultation existe déjà sans nouveau code.
--
-- State machine :
--   NULL          → ligne externe (bon papier classique, défaut)
--   PENDING       → demande déposée dans queue, pas traitée
--   IN_PROGRESS   → prise en main par technicien LAB/RADIO
--   DONE          → traitée, résultat uploadé (result_document_id rempli)
--   CANCELLED     → annulée par médecin
--
-- Deux nouveaux rôles : RADIO et LAB (ajoutés à identity_role). Un user peut
-- accumuler ces rôles avec d'autres (la table identity_user_role est déjà
-- multi-rôle — un médecin solo peut être MEDECIN+ADMIN+LAB s'il fait ses
-- propres analyses). Cohérent avec la décision multi-praticien 2026-05-07
-- (1 codebase auto-adaptatif solo→clinique).
-- =============================================================================

ALTER TABLE clinical_prescription_line
    ADD COLUMN internal_status      VARCHAR(16) NULL,
    ADD COLUMN internal_assigned_at TIMESTAMPTZ NULL,
    ADD COLUMN internal_claimed_by  UUID        NULL;

ALTER TABLE clinical_prescription_line
    ADD CONSTRAINT clinical_prescription_line_internal_status_chk
        CHECK (internal_status IS NULL
               OR internal_status IN ('PENDING','IN_PROGRESS','DONE','CANCELLED'));

ALTER TABLE clinical_prescription_line
    ADD CONSTRAINT clinical_prescription_line_internal_claimed_by_fkey
        FOREIGN KEY (internal_claimed_by) REFERENCES identity_user (id)
        ON DELETE SET NULL;

-- Index partiel : la queue ne sélectionne que les lignes en cours de
-- traitement, donc la majorité des lignes d'ordonnance (NULL) ne sont pas
-- indexées.
CREATE INDEX idx_prescription_line_internal_status
    ON clinical_prescription_line (internal_status)
    WHERE internal_status IS NOT NULL;

COMMENT ON COLUMN clinical_prescription_line.internal_status IS
    'Statut du traitement interne (PENDING/IN_PROGRESS/DONE/CANCELLED). NULL = ligne externe (bon papier classique).';
COMMENT ON COLUMN clinical_prescription_line.internal_assigned_at IS
    'Horodatage du dépôt dans la queue interne (passage NULL → PENDING).';
COMMENT ON COLUMN clinical_prescription_line.internal_claimed_by IS
    'Technicien LAB/RADIO ayant pris en charge la demande (NULL tant que PENDING).';

-- Nouveaux rôles
INSERT INTO identity_role (id, code, label_fr) VALUES
    ('00000000-0000-0000-0000-000000000005', 'RADIO', 'Technicien radiologie'),
    ('00000000-0000-0000-0000-000000000006', 'LAB',   'Technicien laboratoire');
