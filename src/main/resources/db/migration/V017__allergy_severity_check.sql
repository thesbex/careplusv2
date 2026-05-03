-- V017 — guarantee patient_allergy.severity stays in the canonical enum.
--
-- During QA on 2026-05-01 a row was inserted with severity='GRAVE' (FR colloquial)
-- which is NOT in the AllergySeverity enum (LEGERE / MODEREE / SEVERE). The result
-- was a 500 on every endpoint that loaded that patient (GET /patients/{id},
-- POST /consultations/{id}/prescriptions, /constantes/{appointmentId}, …) because
-- Hibernate's Enum.valueOf threw IllegalArgumentException on hydration.
--
-- This CHECK constraint makes that class of corruption impossible: any future
-- INSERT/UPDATE with an unknown severity value gets rejected at the DB level
-- before it can poison reads.

ALTER TABLE patient_allergy
    ADD CONSTRAINT patient_allergy_severity_check
        CHECK (severity IN ('LEGERE','MODEREE','SEVERE'));
