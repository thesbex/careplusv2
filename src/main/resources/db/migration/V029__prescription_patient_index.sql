-- V029 — Index sur clinical_prescription(patient_id).
--
-- Ajouté en support de l'endpoint GET /api/patients/{id}/tab-counts (B6).
-- patient_id a été ajoutée par V004 sans index : COUNT(*) WHERE patient_id = ?
-- scannait toute la table en l'état.
--
-- Note : pas de filtre deleted_at (clinical_prescription est immutable
-- post-signature côté domaine, pas de soft delete sur cette table).

CREATE INDEX IF NOT EXISTS idx_prescription_patient
    ON clinical_prescription (patient_id);
