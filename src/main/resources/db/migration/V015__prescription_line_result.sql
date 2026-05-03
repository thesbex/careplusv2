-- V015 — Résultats associés aux prescriptions (LAB / IMAGING).
--
-- Workflow ciblé : le médecin prescrit une analyse / radio en consultation,
-- le patient revient avec le résultat (PDF d'analyse, image radio), le
-- résultat doit pouvoir être attaché DIRECTEMENT à la ligne de prescription
-- d'origine — pas seulement à la liste générale des documents du dossier.
--
-- Choix : un FK simple `result_document_id` sur clinical_prescription_line,
-- nullable, avec ON DELETE SET NULL pour ne pas casser une ligne signée si
-- le document est purgé (soft-delete documenté côté patient_document).
-- Le document lui-même utilise patient_document.type = 'RESULTAT'.

ALTER TABLE clinical_prescription_line
    ADD COLUMN result_document_id UUID NULL;

ALTER TABLE clinical_prescription_line
    ADD CONSTRAINT clinical_prescription_line_result_document_id_fkey
    FOREIGN KEY (result_document_id)
    REFERENCES patient_document(id)
    ON DELETE SET NULL;

-- Index partiel : la majorité des lignes n'aura jamais de résultat
-- (lignes médicament). On indexe seulement les lignes qui en ont un.
CREATE INDEX idx_prescription_line_result
    ON clinical_prescription_line (result_document_id)
    WHERE result_document_id IS NOT NULL;
