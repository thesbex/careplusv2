-- V043 — Logo placement preference for PDF documents
--
-- Lets the cabinet choose where the establishment logo appears on generated
-- documents (ordonnance, certificat, carnet vaccination). Backward-compatible
-- default 'HEADER' matches the previous hardcoded behavior so existing
-- installations see no change until they explicitly pick another value.

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS logo_position VARCHAR(16) NOT NULL DEFAULT 'HEADER';

ALTER TABLE configuration_clinic_settings
    DROP CONSTRAINT IF EXISTS chk_clinic_logo_position;

ALTER TABLE configuration_clinic_settings
    ADD CONSTRAINT chk_clinic_logo_position
    CHECK (logo_position IN ('HEADER', 'FOOTER', 'WATERMARK', 'NONE'));
