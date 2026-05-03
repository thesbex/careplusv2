-- QA wave 6 — Bug code recyclage post-suppression (BACKLOG QA6 / agent manual-qa 2026-05-02)
--
-- Problème : un code supprimé (soft-delete active=FALSE) ne pouvait plus jamais
-- être réutilisé car la contrainte UNIQUE inline sur `code` ignorait `active`.
-- Le pre-check applicatif (CatalogController) filtre désormais sur `active = TRUE`,
-- mais sans cette migration la ré-INSERTION violerait toujours la contrainte BDD
-- avec un 500.
--
-- Fix : remplacer la contrainte UNIQUE par un partial unique index limité aux
-- rows actives. L'invariant reste « pas de doublon parmi les actifs », et les
-- soft-deleted libèrent leur code pour réutilisation.

ALTER TABLE catalog_lab_test DROP CONSTRAINT catalog_lab_test_code_key;
CREATE UNIQUE INDEX catalog_lab_test_code_active_key
    ON catalog_lab_test (code) WHERE active = TRUE;

ALTER TABLE catalog_imaging_exam DROP CONSTRAINT catalog_imaging_exam_code_key;
CREATE UNIQUE INDEX catalog_imaging_exam_code_active_key
    ON catalog_imaging_exam (code) WHERE active = TRUE;
