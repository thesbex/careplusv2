-- R__seed_vaccine_catalog.sql — PNI marocain (idempotent)
-- Vaccins du Programme National d'Immunisation (12 vaccins) + calendrier (~25 doses)
-- Runs on EVERY Flyway migration; ON CONFLICT DO NOTHING makes it safe.

-- =============================================================================
-- 1. vaccine_catalog — 12 vaccins PNI
-- All IDs use standard UUID hex format (all hex digits)
-- =============================================================================

INSERT INTO vaccine_catalog (id, code, name_fr, manufacturer_default, route_default, is_pni, active)
VALUES
    ('a0000001-0000-0000-0000-000000000001', 'BCG',    'BCG (Bacille de Calmette et Guerin)',        'Sanofi Pasteur',  'ID', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000002', 'HEPB',   'Hepatite B',                                  'GSK',             'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000003', 'PENTA',  'Pentavalent (DTCaP-Hib-HepB)',               'Sanofi Pasteur',  'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000004', 'VPI',    'Vaccin Polio Inactive (VPI)',                 'Sanofi Pasteur',  'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000005', 'VPO',    'Vaccin Polio Oral (VPO)',                     NULL,              'PO', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000006', 'PNEUMO', 'Vaccin Pneumococcique Conjugue (PCV13)',      'Pfizer',          'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000007', 'ROTA',   'Rotavirus (Rotarix)',                         'GSK',             'PO', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000008', 'ROR',    'Rougeole-Oreillons-Rubeole (ROR)',            'GSK',             'SC', TRUE, TRUE),
    ('a0000001-0000-0000-0000-000000000009', 'DTP',    'DTP Rappel (Diphterie-Tetanos-Polio)',        'Sanofi Pasteur',  'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-00000000000a', 'HPV',    'Papillomavirus Humain (Gardasil)',            'MSD',             'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-00000000000b', 'HEXA',   'Hexavalent (DTCaP-Hib-HepB-IPV)',            'Sanofi Pasteur',  'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-00000000000c', 'TD',     'Td adulte (Tetanos-Diphterie)',               'Sanofi Pasteur',  'IM', TRUE, TRUE),
    ('a0000001-0000-0000-0000-00000000000d', 'HEPA',   'Hepatite A',                                  'GSK',             'IM', FALSE, TRUE),
    ('a0000001-0000-0000-0000-00000000000e', 'VAR',    'Varicelle (Varilrix)',                        'GSK',             'SC', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 2. vaccine_schedule_dose — calendrier PNI (~25 lignes)
--    Dose IDs: fixed UUIDs for idempotency
-- =============================================================================

-- Naissance (target_age_days = 0)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 1,    0, 30, 'BCG - Naissance'),
    ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', 1,    0, 30, 'HepB D1 - Naissance')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- 2 mois (target_age_days = 60)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', 1,   60, 30, 'Penta D1 - 2 mois'),
    ('b0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', 1,   60, 30, 'VPI D1 - 2 mois'),
    ('b0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000006', 1,   60, 30, 'Pneumo D1 - 2 mois'),
    ('b0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000007', 1,   60, 30, 'Rotavirus D1 - 2 mois')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- 4 mois (target_age_days = 120)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000003', 2,  120, 30, 'Penta D2 - 4 mois'),
    ('b0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000004', 2,  120, 30, 'VPI D2 - 4 mois'),
    ('b0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000006', 2,  120, 30, 'Pneumo D2 - 4 mois'),
    ('b0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000007', 2,  120, 30, 'Rotavirus D2 - 4 mois')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- 6 mois (target_age_days = 180)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000003', 3,  180, 30, 'Penta D3 - 6 mois'),
    ('b0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000004', 3,  180, 30, 'VPI D3 - 6 mois')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- 12 mois (target_age_days = 365)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000008', 1,  365, 30, 'ROR D1 - 12 mois'),
    ('b0000001-0000-0000-0000-000000000014', 'a0000001-0000-0000-0000-000000000002', 3,  365, 30, 'HepB D3 - 12 mois'),
    ('b0000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000006', 3,  365, 30, 'Pneumo R1 (rappel) - 12 mois')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- 18 mois (target_age_days = 548)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000009', 1,  548, 30, 'DTP Rappel R1 - 18 mois')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- 5 ans (target_age_days = 1825)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000017', 'a0000001-0000-0000-0000-000000000008', 2, 1825, 30, 'ROR D2 - 5 ans'),
    ('b0000001-0000-0000-0000-000000000018', 'a0000001-0000-0000-0000-000000000009', 2, 1825, 30, 'DTP Rappel R2 - 5 ans')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- 11 ans (target_age_days = 4015)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000019', 'a0000001-0000-0000-0000-00000000000a', 1, 4015, 30, 'HPV D1 - 11 ans'),
    ('b0000001-0000-0000-0000-000000000020', 'a0000001-0000-0000-0000-00000000000a', 2, 4197, 30, 'HPV D2 - 11 ans + 6 mois')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;

-- VPO oral doses (2 mois, 4 mois, 6 mois, 5 ans)
INSERT INTO vaccine_schedule_dose (id, vaccine_id, dose_number, target_age_days, tolerance_days, label_fr)
VALUES
    ('b0000001-0000-0000-0000-000000000021', 'a0000001-0000-0000-0000-000000000005', 1,   60, 30, 'VPO D1 - 2 mois'),
    ('b0000001-0000-0000-0000-000000000022', 'a0000001-0000-0000-0000-000000000005', 2,  120, 30, 'VPO D2 - 4 mois'),
    ('b0000001-0000-0000-0000-000000000023', 'a0000001-0000-0000-0000-000000000005', 3,  180, 30, 'VPO D3 - 6 mois'),
    ('b0000001-0000-0000-0000-000000000024', 'a0000001-0000-0000-0000-000000000005', 4, 1825, 30, 'VPO Rappel - 5 ans'),
    ('b0000001-0000-0000-0000-000000000025', 'a0000001-0000-0000-0000-000000000002', 2,  120, 30, 'HepB D2 - 4 mois')
ON CONFLICT (vaccine_id, dose_number) DO NOTHING;
