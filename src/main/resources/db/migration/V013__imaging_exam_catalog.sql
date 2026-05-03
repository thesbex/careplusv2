-- =============================================================================
-- V013 — Référentiel examens radio / imagerie (médecine générale Maroc)
-- =============================================================================
-- Promotion des seeds dev (R__seed_dev + R__seed_catalog_extended) vers une
-- migration versionnée. Sans ce V013 l'écran /catalogue/radio était vide en
-- prod (cloud / on-prem ne chargent que db/migration, pas db/seed).
--
-- Idempotent : INSERT … WHERE NOT EXISTS sur le code (UNIQUE).

INSERT INTO catalog_imaging_exam (id, code, name, modality)
SELECT gen_random_uuid(), x.code, x.name, x.modality
FROM (VALUES
    -- ── Radiographie standard ────────────────────────────────────────────
    ('RADIO_THX',      'Radiographie du thorax (face)',               'RADIO'),
    ('RADIO_ABDO',     'Radiographie abdomen sans préparation',       'RADIO'),
    ('RADIO_RACH',     'Radiographie rachis lombaire',                'RADIO'),
    ('RADIO_RACH_C',   'Radiographie rachis cervical',                'RADIO'),
    ('RADIO_RACH_D',   'Radiographie rachis dorsal',                  'RADIO'),
    ('RADIO_BASS',     'Radiographie du bassin de face',              'RADIO'),
    ('RADIO_MEM_INF',  'Radiographie du membre inférieur',            'RADIO'),
    ('RADIO_MEM_SUP',  'Radiographie du membre supérieur',            'RADIO'),
    ('RADIO_GENOU',    'Radiographie du genou (face + profil)',       'RADIO'),
    ('RADIO_EPAULE',   'Radiographie de l''épaule',                   'RADIO'),
    ('RADIO_CRANE',    'Radiographie du crâne',                       'RADIO'),
    ('RADIO_SINUS',    'Radiographie des sinus',                      'RADIO'),
    ('RADIO_DENT',     'Panoramique dentaire',                        'RADIO'),

    -- ── Échographie ──────────────────────────────────────────────────────
    ('ECHO_ABDO',      'Échographie abdominale',                      'ECHO'),
    ('ECHO_PELV',      'Échographie pelvienne',                       'ECHO'),
    ('ECHO_CARD',      'Échographie cardiaque',                       'ECHO'),
    ('ECHO_REIN',      'Échographie rénale et vésicale',              'ECHO'),
    ('ECHO_THYR',      'Échographie thyroïdienne',                    'ECHO'),
    ('ECHO_MAMM',      'Échographie mammaire',                        'ECHO'),
    ('ECHO_OBSTE',     'Échographie obstétricale',                    'ECHO'),
    ('ECHO_DOPP_MI',   'Écho-doppler veineux des membres inférieurs', 'ECHO'),
    ('ECHO_DOPP_TSA',  'Écho-doppler des troncs supra-aortiques',     'ECHO'),
    ('ECHO_PROST',     'Échographie prostatique',                     'ECHO'),
    ('ECHO_PARTIES_M', 'Échographie des parties molles',              'ECHO'),

    -- ── Mammographie ─────────────────────────────────────────────────────
    ('MAMMO',          'Mammographie bilatérale',                     'MAMMO'),

    -- ── Scanner ──────────────────────────────────────────────────────────
    ('SCAN_CERE',      'Scanner cérébral sans injection',             'SCANNER'),
    ('SCAN_THX',       'Scanner thoracique',                          'SCANNER'),
    ('SCAN_ABDO',      'Scanner abdomino-pelvien',                    'SCANNER'),
    ('SCAN_RACH_L',    'Scanner rachis lombaire',                     'SCANNER'),
    ('SCAN_SINUS',     'Scanner des sinus',                           'SCANNER'),
    ('SCAN_AURI',      'Scanner des oreilles',                        'SCANNER'),
    ('ANGIOSCAN',      'Angio-scanner thoracique',                    'SCANNER'),

    -- ── IRM ──────────────────────────────────────────────────────────────
    ('IRM_GENOU',      'IRM du genou',                                'IRM'),
    ('IRM_CERE',       'IRM cérébrale',                               'IRM'),
    ('IRM_RACH_C',     'IRM rachis cervical',                         'IRM'),
    ('IRM_RACH_L',     'IRM rachis lombaire',                         'IRM'),
    ('IRM_EPAULE',     'IRM de l''épaule',                            'IRM'),
    ('IRM_HANCHE',     'IRM de la hanche',                            'IRM'),
    ('IRM_PELV',       'IRM pelvienne',                               'IRM'),
    ('IRM_ABDO',       'IRM abdominale',                              'IRM'),

    -- ── Médecine nucléaire / endoscopie ──────────────────────────────────
    ('SCINTI_OS',      'Scintigraphie osseuse',                       'MEDECINE_NUCLEAIRE'),
    ('SCINTI_THYR',    'Scintigraphie thyroïdienne',                  'MEDECINE_NUCLEAIRE'),
    ('FIBRO_GASTRO',   'Fibroscopie œso-gastro-duodénale',            'ENDOSCOPIE'),
    ('COLOSCOPIE',     'Coloscopie',                                  'ENDOSCOPIE')
) AS x (code, name, modality)
WHERE NOT EXISTS (SELECT 1 FROM catalog_imaging_exam i WHERE i.code = x.code);
