-- =============================================================================
-- V008 — Role × permission matrix (QA3-3, pragmatic v1)
-- =============================================================================
-- Extends the 4 hard-coded roles with editable permission flags so an
-- admin/médecin can grant fine-grained access to SECRETAIRE / ASSISTANT
-- without code changes.
--
-- Scope of v1 (intentionally narrow — 8 high-impact permissions):
--   PATIENT_CREATE       create / modify a patient
--   PATIENT_READ         read patient dossier
--   APPOINTMENT_CREATE   book a new appointment
--   APPOINTMENT_READ     read planning / agenda
--   ARRIVAL_DECLARE      declare patient arrival in waiting room
--   VITALS_RECORD        record height / weight / BP at intake
--   INVOICE_READ         access facturation list / drawer
--   INVOICE_ISSUE        issue / record payment / credit-note
--
-- The full RBAC refactor (replacing every @PreAuthorize("hasRole(...)") call
-- across ~50 endpoints with @PreAuthorize("hasAuthority(...)")) is QA3-3
-- continuation work — see BACKLOG.md. v1 only enforces the matrix at the
-- frontend layer (hide CTA, redirect from screen) so we ship the visible
-- behaviour without risking a security regression on the hot path.

CREATE TABLE identity_role_permission (
    role_code     VARCHAR(32) NOT NULL,
    permission    VARCHAR(64) NOT NULL,
    granted       BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    UUID        NULL,
    PRIMARY KEY (role_code, permission)
);
COMMENT ON TABLE identity_role_permission IS
    'Editable role × permission matrix (QA3-3 v1). Source of truth for
     the frontend permission guards. Backend still enforces hardcoded
     @PreAuthorize role checks for now — this is purely additive UX gating.';

-- Sensible defaults that mirror current behaviour. Admins can flip any of
-- these from Paramétrage > Droits d'accès afterwards.
INSERT INTO identity_role_permission (role_code, permission, granted) VALUES
    -- ADMIN: everything.
    ('ADMIN', 'PATIENT_CREATE',     TRUE),
    ('ADMIN', 'PATIENT_READ',       TRUE),
    ('ADMIN', 'APPOINTMENT_CREATE', TRUE),
    ('ADMIN', 'APPOINTMENT_READ',   TRUE),
    ('ADMIN', 'ARRIVAL_DECLARE',    TRUE),
    ('ADMIN', 'VITALS_RECORD',      TRUE),
    ('ADMIN', 'INVOICE_READ',       TRUE),
    ('ADMIN', 'INVOICE_ISSUE',      TRUE),
    -- MEDECIN: clinical owner — everything.
    ('MEDECIN', 'PATIENT_CREATE',     TRUE),
    ('MEDECIN', 'PATIENT_READ',       TRUE),
    ('MEDECIN', 'APPOINTMENT_CREATE', TRUE),
    ('MEDECIN', 'APPOINTMENT_READ',   TRUE),
    ('MEDECIN', 'ARRIVAL_DECLARE',    TRUE),
    ('MEDECIN', 'VITALS_RECORD',      TRUE),
    ('MEDECIN', 'INVOICE_READ',       TRUE),
    ('MEDECIN', 'INVOICE_ISSUE',      TRUE),
    -- SECRETAIRE: front-desk default per WORKFLOWS.md.
    ('SECRETAIRE', 'PATIENT_CREATE',     TRUE),
    ('SECRETAIRE', 'PATIENT_READ',       TRUE),
    ('SECRETAIRE', 'APPOINTMENT_CREATE', TRUE),
    ('SECRETAIRE', 'APPOINTMENT_READ',   TRUE),
    ('SECRETAIRE', 'ARRIVAL_DECLARE',    TRUE),
    ('SECRETAIRE', 'VITALS_RECORD',      FALSE),
    ('SECRETAIRE', 'INVOICE_READ',       TRUE),
    ('SECRETAIRE', 'INVOICE_ISSUE',      TRUE),
    -- ASSISTANT: clinical helper — vitals + read access only.
    ('ASSISTANT', 'PATIENT_CREATE',     FALSE),
    ('ASSISTANT', 'PATIENT_READ',       TRUE),
    ('ASSISTANT', 'APPOINTMENT_CREATE', FALSE),
    ('ASSISTANT', 'APPOINTMENT_READ',   TRUE),
    ('ASSISTANT', 'ARRIVAL_DECLARE',    TRUE),
    ('ASSISTANT', 'VITALS_RECORD',      TRUE),
    ('ASSISTANT', 'INVOICE_READ',       FALSE),
    ('ASSISTANT', 'INVOICE_ISSUE',      FALSE);
