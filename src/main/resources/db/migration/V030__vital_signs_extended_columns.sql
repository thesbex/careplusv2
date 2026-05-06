-- V030 : étend `clinical_vital_signs` avec les 3 mesures que le formulaire
-- "Prise des constantes" exposait déjà mais que le backend ignorait silencieu-
-- sement (bug B1, 2026-05-06).
--
--   - respiratory_rate_bpm   — fréquence respiratoire (cycles/min)
--   - abdominal_perimeter_cm — périmètre abdominal (suivi métabolique)
--   - head_circumference_cm  — périmètre crânien (suivi pédiatrique)
--
-- Avant ce fix, les inputs étaient présents dans le form mais ni le DTO
-- `RecordVitalsRequest` ni la table ne les acceptaient → données perdues
-- à la persistance + invisibles côté lecture (vue consultation, dossier
-- patient). Le fix front-end commence à les envoyer ; cette migration
-- permet leur stockage.
--
-- Toutes les colonnes sont nullable (rétro-compatibilité, mesures optionnelles).
ALTER TABLE clinical_vital_signs
    ADD COLUMN IF NOT EXISTS respiratory_rate_bpm   INT,
    ADD COLUMN IF NOT EXISTS abdominal_perimeter_cm NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS head_circumference_cm  NUMERIC(5,2);

COMMENT ON COLUMN clinical_vital_signs.respiratory_rate_bpm   IS 'Fréquence respiratoire (cycles par minute)';
COMMENT ON COLUMN clinical_vital_signs.abdominal_perimeter_cm IS 'Périmètre abdominal en cm';
COMMENT ON COLUMN clinical_vital_signs.head_circumference_cm  IS 'Périmètre crânien en cm (pédiatrie)';
