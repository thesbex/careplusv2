-- =============================================================================
-- Facturation des analyses / examens d'imagerie effectués en interne (V038).
--
-- Demande terrain (Suivi CarePlus 2026-05-21) : "Il faut penser à la facturation
-- des radios et analyses si elle sont effectuées en interne".
--
-- Aujourd'hui : quand le médecin coche "Réaliser en interne" sur une ligne LAB
-- ou IMAGING, la prescription part en queue technicien (V038), mais aucune
-- ligne de facture n'est créée. Le patient n'est jamais facturé pour le service
-- rendu par le cabinet.
--
-- Fix : on ajoute un prix par test / examen pour le **mode interne** sur les
-- tables catalog. La colonne est nullable :
--   - NULL    → pas facturable en interne (la ligne reste mais n'apparaît
--               pas sur la facture brouillon ; le médecin peut ajouter une
--               ligne manuellement s'il le souhaite).
--   - non-NULL → BillingService.onConsultationSigned ajoute une ligne facture
--                à hauteur du prix * 1 unité au moment où la consultation
--                est signée.
--
-- Pas de tiering (NORMAL/PREMIUM) pour ces lignes en v1 — c'est un prix
-- unique par test. Le tiering peut être ajouté plus tard si demandé via une
-- table catalog_lab_internal_tariff (cf. ADR-023 pour le pattern).
-- =============================================================================

ALTER TABLE catalog_lab_test
    ADD COLUMN internal_price NUMERIC(10, 2) NULL;

ALTER TABLE catalog_imaging_exam
    ADD COLUMN internal_price NUMERIC(10, 2) NULL;

COMMENT ON COLUMN catalog_lab_test.internal_price IS
    'Prix de facturation en mode interne (NULL = non facturable en interne, le médecin doit facturer manuellement).';
COMMENT ON COLUMN catalog_imaging_exam.internal_price IS
    'Prix de facturation en mode interne (NULL = non facturable en interne).';
