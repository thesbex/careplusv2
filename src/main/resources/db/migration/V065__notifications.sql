-- =============================================================================
-- Notifications sortantes (WhatsApp + Email) — socle v1
--
-- Module ma.careplus.notification, event-driven. Voir
-- docs/plans/2026-05-27-notifications-design.md.
--
--   - notification_template : modèles de message gérés par l'ADMIN, par
--     (event_key, channel). Placeholders {{patientNom}} … rendus au moment de
--     l'envoi.
--   - notification_outbox   : journal + file d'attente (idempotence via
--     dedupe_key, retry borné, tolérance hors-ligne).
--   - patient_patient       : opt-in consentement + canal préféré.
-- =============================================================================

CREATE TABLE notification_template (
    id                      UUID         NOT NULL DEFAULT gen_random_uuid(),
    event_key               VARCHAR(40)  NOT NULL,
    channel                 VARCHAR(16)  NOT NULL,
    subject                 VARCHAR(200) NULL,
    body                    TEXT         NOT NULL,
    whatsapp_template_name  VARCHAR(120) NULL,
    active                  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by              UUID         NULL REFERENCES identity_user(id) ON DELETE SET NULL,
    deleted_at              TIMESTAMPTZ  NULL,

    CONSTRAINT notification_template_pk PRIMARY KEY (id),
    CONSTRAINT notification_template_event_ck CHECK (event_key IN (
        'APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER', 'PRESCRIPTION_READY')),
    CONSTRAINT notification_template_channel_ck CHECK (channel IN ('WHATSAPP', 'EMAIL'))
);

COMMENT ON TABLE  notification_template IS 'Modèles de message notification (admin-managed), par (event_key, channel).';
COMMENT ON COLUMN notification_template.body IS 'Corps avec placeholders : {{patientNom}}, {{patientPrenom}}, {{date}}, {{heure}}, {{medecin}}, {{cabinet}}, {{motif}}.';
COMMENT ON COLUMN notification_template.whatsapp_template_name IS 'Nom du template Meta approuvé (canal WHATSAPP, message émis hors fenêtre 24h).';

CREATE INDEX idx_notif_tpl_active
    ON notification_template (event_key, channel, active)
    WHERE deleted_at IS NULL;


CREATE TABLE notification_outbox (
    id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    event_key            VARCHAR(40)  NOT NULL,
    channel              VARCHAR(16)  NOT NULL,
    recipient_patient_id UUID         NULL,
    to_address           VARCHAR(255) NOT NULL,
    rendered_subject     VARCHAR(200) NULL,
    rendered_body        TEXT         NOT NULL,
    status               VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    attempts             INT          NOT NULL DEFAULT 0,
    last_error           TEXT         NULL,
    dedupe_key           VARCHAR(120) NOT NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    sent_at              TIMESTAMPTZ  NULL,

    CONSTRAINT notification_outbox_pk PRIMARY KEY (id),
    CONSTRAINT notification_outbox_dedupe_uk UNIQUE (dedupe_key),
    CONSTRAINT notification_outbox_status_ck CHECK (status IN (
        'PENDING', 'SENT', 'FAILED', 'SKIPPED', 'SENT_SIMULATED'))
);

COMMENT ON TABLE  notification_outbox IS 'File d''attente + journal des notifications (idempotence dedupe_key, retry, audit).';
COMMENT ON COLUMN notification_outbox.dedupe_key IS 'Ex. APPOINTMENT_CREATED:<appointmentId>:WHATSAPP — empêche le double envoi.';
COMMENT ON COLUMN notification_outbox.to_address IS 'Numéro E.164 (WhatsApp) ou adresse email du destinataire.';

CREATE INDEX idx_notif_outbox_pending ON notification_outbox (status, created_at);


-- Consentement patient + canal préféré.
ALTER TABLE patient_patient
    ADD COLUMN notifications_opt_in  BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN notifications_channel VARCHAR(16) NULL;

COMMENT ON COLUMN patient_patient.notifications_opt_in  IS 'TRUE = le patient accepte les notifications sortantes (RDV, rappels).';
COMMENT ON COLUMN patient_patient.notifications_channel IS 'Canal préféré : WHATSAPP | EMAIL | BOTH (NULL = BOTH selon contacts disponibles).';


-- Modèles par défaut (l'ADMIN les édite ensuite). Texte FR, placeholders.
INSERT INTO notification_template (event_key, channel, subject, body, whatsapp_template_name, active) VALUES
 ('APPOINTMENT_CREATED', 'EMAIL', 'Confirmation de votre rendez-vous',
  E'Bonjour {{patientPrenom}} {{patientNom}},\n\nVotre rendez-vous est confirmé le {{date}} à {{heure}} avec {{medecin}}.\n\n{{cabinet}}', NULL, TRUE),
 ('APPOINTMENT_CREATED', 'WHATSAPP', NULL,
  'Bonjour {{patientPrenom}}, votre rendez-vous du {{date}} à {{heure}} avec {{medecin}} est confirmé. {{cabinet}}',
  'appointment_confirmation', TRUE),
 ('APPOINTMENT_REMINDER', 'EMAIL', 'Rappel : rendez-vous demain',
  E'Bonjour {{patientPrenom}} {{patientNom}},\n\nRappel : vous avez rendez-vous demain {{date}} à {{heure}} avec {{medecin}}.\n\n{{cabinet}}', NULL, TRUE),
 ('APPOINTMENT_REMINDER', 'WHATSAPP', NULL,
  'Rappel : votre rendez-vous est demain {{date}} à {{heure}} avec {{medecin}}. {{cabinet}}',
  'appointment_reminder', TRUE);
