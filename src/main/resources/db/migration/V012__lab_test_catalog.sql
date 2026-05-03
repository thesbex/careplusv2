-- =============================================================================
-- V012 — Référentiel analyses biologiques (NABM Maroc, médecine générale)
-- =============================================================================
-- Promotion des seeds dev (R__seed_dev + R__seed_catalog_extended) vers une
-- migration versionnée. Les profils prod (cloud / on-prem) ne chargent que
-- db/migration ; sans ce V012 les écrans /catalogue/analyses étaient vides.
--
-- Idempotent : INSERT … WHERE NOT EXISTS sur le code (UNIQUE).

INSERT INTO catalog_lab_test (id, code, name, category)
SELECT gen_random_uuid(), x.code, x.name, x.category
FROM (VALUES
    -- ── Hématologie ──────────────────────────────────────────────────────
    ('NFS',         'Numération Formule Sanguine (NFS)',                'hematologie'),
    ('VS',          'Vitesse de sédimentation (VS)',                    'hematologie'),
    ('FERRITINE',   'Ferritine sérique',                                'hematologie'),
    ('FER',         'Fer sérique + capacité de fixation',               'hematologie'),
    ('VIT_B12',     'Vitamine B12',                                     'hematologie'),
    ('FOLATES',     'Folates (B9)',                                     'hematologie'),
    ('GROUPE_RH',   'Groupe sanguin + Rhésus',                          'hematologie'),
    ('RAI',         'RAI (recherche d''agglutinines irrégulières)',     'hematologie'),
    ('RETICULO',    'Réticulocytes',                                    'hematologie'),

    -- ── Inflammation / sérologies ────────────────────────────────────────
    ('CRP',         'Protéine C-réactive (CRP)',                        'inflammation'),
    ('PCT',         'Procalcitonine (PCT)',                             'inflammation'),
    ('SERO_HIV',    'Sérologie VIH (Combo Ag p24/Ac)',                  'serologie'),
    ('SERO_HEPB',   'Sérologie hépatite B (AgHBs, Ac anti-HBs, anti-HBc)','serologie'),
    ('SERO_HEPC',   'Sérologie hépatite C (Ac anti-VHC)',               'serologie'),
    ('SERO_SYPH',   'Sérologie syphilis (TPHA-VDRL)',                   'serologie'),
    ('SERO_TOXO',   'Sérologie toxoplasmose (IgG/IgM)',                 'serologie'),
    ('SERO_RUB',    'Sérologie rubéole (IgG/IgM)',                      'serologie'),

    -- ── Diabète / métabolisme ────────────────────────────────────────────
    ('GLY',         'Glycémie à jeun',                                  'diabete'),
    ('GLY_PP',      'Glycémie post-prandiale',                          'diabete'),
    ('HBA1C',       'Hémoglobine glyquée (HbA1c)',                      'diabete'),
    ('HGPO',        'Hyperglycémie provoquée par voie orale (HGPO)',    'diabete'),
    ('FRUCTOS',     'Fructosamine',                                     'diabete'),

    -- ── Lipides ──────────────────────────────────────────────────────────
    ('CHOL',        'Bilan lipidique (cholestérol total, HDL, LDL, TG)','lipides'),
    ('TG',          'Triglycérides',                                    'lipides'),
    ('HDL',         'HDL cholestérol',                                  'lipides'),
    ('LDL',         'LDL cholestérol',                                  'lipides'),

    -- ── Rein / iono ──────────────────────────────────────────────────────
    ('CREA',        'Créatinine + clairance',                           'rein'),
    ('UREE',        'Urée sanguine',                                    'rein'),
    ('IONO_S',      'Ionogramme sanguin (Na, K, Cl)',                   'rein'),
    ('IONO_U',      'Ionogramme urinaire',                              'rein'),
    ('CALCIUM',     'Calcémie',                                         'rein'),
    ('MAGNESIUM',   'Magnésémie',                                       'rein'),
    ('PHOSPHORE',   'Phosphorémie',                                     'rein'),
    ('PROT_24H',    'Protéinurie des 24h',                              'rein'),
    ('MICROALB',    'Microalbuminurie',                                 'rein'),

    -- ── Foie / pancréas ──────────────────────────────────────────────────
    ('BILAN_HEP',   'Bilan hépatique (ASAT, ALAT, GGT, PAL)',           'foie'),
    ('BILIRUBINE',  'Bilirubine totale + conjuguée',                    'foie'),
    ('LIPASE',      'Lipase',                                           'pancreas'),
    ('AMYLASE',     'Amylase',                                          'pancreas'),

    -- ── Thyroïde / endocrino ─────────────────────────────────────────────
    ('TSH',         'TSH',                                              'thyroide'),
    ('T4L',         'T4 libre',                                         'thyroide'),
    ('T3L',         'T3 libre',                                         'thyroide'),
    ('AC_TPO',      'Anticorps anti-TPO',                               'thyroide'),
    ('CORTISOL_8H', 'Cortisol à 8h',                                    'endocrino'),
    ('PROLACTINE',  'Prolactine',                                       'endocrino'),

    -- ── Marqueurs cardiaques / coag ──────────────────────────────────────
    ('TROPO',       'Troponine ultra-sensible',                         'cardiaque'),
    ('BNP',         'BNP / NT-proBNP',                                  'cardiaque'),
    ('TP',          'Taux de prothrombine (TP / INR)',                  'coagulation'),
    ('TCA',         'TCA (temps de céphaline activée)',                 'coagulation'),
    ('D_DIMERES',   'D-Dimères',                                        'coagulation'),
    ('FIBRINOGENE', 'Fibrinogène',                                      'coagulation'),

    -- ── Marqueurs tumoraux ───────────────────────────────────────────────
    ('PSA',         'PSA total + libre',                                'oncologie'),
    ('CA125',       'CA 125',                                           'oncologie'),
    ('CA19_9',      'CA 19-9',                                          'oncologie'),
    ('AFP',         'Alpha-foetoprotéine (AFP)',                        'oncologie'),
    ('CEA',         'ACE (antigène carcino-embryonnaire)',              'oncologie'),

    -- ── Gynéco / grossesse ───────────────────────────────────────────────
    ('BHCG',        'β-hCG quantitatif',                                'gynecologie'),
    ('FROTTIS',     'Frottis cervico-vaginal',                          'gynecologie'),

    -- ── Bactério / parasito / urines ─────────────────────────────────────
    ('ECBU',        'Examen cytobactériologique des urines',            'urines'),
    ('COPRO',       'Coproculture',                                     'bacteriologie'),
    ('PARASITO',    'Examen parasitologique des selles',                'parasitologie'),
    ('CHLAMYDIA',   'PCR Chlamydia trachomatis',                        'bacteriologie'),
    ('STREPTO_A',   'Test rapide angine (Streptocoque A)',              'bacteriologie'),

    -- ── Vitamines / allergologie ─────────────────────────────────────────
    ('VIT_D',       'Vitamine D 25-OH',                                 'vitamines'),
    ('IGE_TOT',     'IgE totales',                                      'allergologie'),
    ('PHADIATOP',   'Phadiatop (mélange aéroallergènes)',               'allergologie')
) AS x (code, name, category)
WHERE NOT EXISTS (SELECT 1 FROM catalog_lab_test l WHERE l.code = x.code);
