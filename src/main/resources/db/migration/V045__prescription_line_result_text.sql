-- V045 — Saisie texte / chiffrée du résultat d'une ligne LAB / IMAGING.
--
-- Pendant : `result_document_id` (V015) reçoit le PDF / image scanné. Cette
-- colonne reçoit en parallèle ce que le médecin tape à la main pour pouvoir
-- comparer numériquement les valeurs d'une consultation à l'autre sans
-- ouvrir le PDF à chaque fois.
--
-- v1 : un seul champ libre par ordonnance (ancré sur la première ligne, même
-- stratégie que `result_document_id`). Le suivi par analyte structuré
-- (valeur/unité/norme) reste hors scope et passera par une autre table si
-- le besoin se confirme.

ALTER TABLE clinical_prescription_line
    ADD COLUMN result_text TEXT NULL;

COMMENT ON COLUMN clinical_prescription_line.result_text IS
    'V045 — résultat saisi en texte/chiffré (en parallèle de result_document_id). NULL = pas de saisie.';
