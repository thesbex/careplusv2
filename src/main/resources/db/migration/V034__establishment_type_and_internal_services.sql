-- V034 — type d'établissement (cabinet/clinique/hôpital/centre/autre) + capacités internes.
--
-- Pourquoi : careplus s'installe désormais aussi en clinique et en hôpital (cf. décision
-- 2026-05-07 multi-praticien). Le label "Cabinet" hardcodé dans la sidebar et les en-têtes
-- PDF n'a plus de sens partout. On stocke le type comme valeur contrôlée pour qu'un
-- futur changement (ex. ajout 'POLYCLINIQUE') passe par migration plutôt que par texte
-- libre incohérent d'un install à l'autre.
--
-- Les deux booléens lab_internal / imaging_internal préparent le routing futur des
-- prescriptions vers les services internes (radio, labo). Aujourd'hui ils ne servent qu'à
-- afficher / masquer des entrées dans le parametrage et seront consommés en J+ par le
-- module digital de prescription analyses+radio.

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS establishment_type VARCHAR(32) NOT NULL DEFAULT 'CABINET';

-- CHECK constraint : on garde la liste fermée pour que le frontend puisse rendre une
-- option lisible par valeur sans fallback. 'AUTRE' est l'échappatoire — pas de texte libre.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_establishment_type'
    ) THEN
        ALTER TABLE configuration_clinic_settings
            ADD CONSTRAINT chk_establishment_type
            CHECK (establishment_type IN ('CABINET','CLINIQUE','HOPITAL','CENTRE_MEDICAL','AUTRE'));
    END IF;
END $$;

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS lab_internal BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS imaging_internal BOOLEAN NOT NULL DEFAULT FALSE;
