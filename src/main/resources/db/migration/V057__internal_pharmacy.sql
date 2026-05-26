-- =============================================================================
-- Pharmacie interne (QA9-5/6/7 — suivi .xlsx Y. Boutaleb 2026-05-26).
--
-- Demande : « L'établissement peut aussi fournir des médicaments en interne et
-- les fournir aux patients. » → 3 volets, calqués sur le pattern radiologie/labo
-- internes déjà livré (V034 capability + V038 routing + V050 internal_price) :
--
--   QA9-5  pharmacy_internal : capacité activable dans le paramétrage admin,
--          gated par establishment_type (invisible pour un cabinet GP simple),
--          comme imaging_internal / lab_internal (V034) et hospitalization_enabled.
--
--   QA9-6  catalog_medication.internal_price : prix de cession en interne, comme
--          catalog_lab_test.internal_price / catalog_imaging_exam.internal_price
--          (V050). NULL = non facturable en interne (le médecin facture à la main).
--
--   QA9-7  clinical_prescription_line.internal_dispense : la ligne DRUG est
--          fournie par la pharmacie de l'établissement. On utilise un booléen
--          dédié (et non internal_status, réservé à la file technicien LAB/RADIO
--          de V038) pour ne pas polluer la queue interne avec des médicaments.
--          BillingService.onConsultationSigned ajoute une ligne facture
--          internal_price × quantité au moment de la signature.
-- =============================================================================

ALTER TABLE configuration_clinic_settings
    ADD COLUMN IF NOT EXISTS pharmacy_internal BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN configuration_clinic_settings.pharmacy_internal IS
    'V057 — true => l''établissement fournit des médicaments en interne (pharmacie). '
    'Active le prix interne sur le catalogue médicaments et l''option "fournir en interne" à la prescription.';

ALTER TABLE catalog_medication
    ADD COLUMN IF NOT EXISTS internal_price NUMERIC(10, 2) NULL;

COMMENT ON COLUMN catalog_medication.internal_price IS
    'V057 — prix de cession quand le médicament est fourni en interne (NULL = non '
    'facturable en interne, le médecin ajoute une ligne manuelle s''il le souhaite).';

ALTER TABLE clinical_prescription_line
    ADD COLUMN IF NOT EXISTS internal_dispense BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN clinical_prescription_line.internal_dispense IS
    'V057 — true => ligne médicament fournie par la pharmacie interne ; facturée '
    'internal_price × quantité à la signature de la consultation.';
