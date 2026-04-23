-- Repeatable dev seed. Only loaded when spring.flyway.locations includes classpath:db/seed
-- (i.e. only in the 'dev' profile). Idempotent — guards with NOT EXISTS.
-- Users are seeded by Java (DevUserSeeder) because BCrypt hashes need the PasswordEncoder.

-- -----------------------------------------------------------------------------
-- Demo patients (Moroccan names)
-- -----------------------------------------------------------------------------
INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date, cin, phone, email, address, city)
SELECT gen_random_uuid(), 'Alami',        'Mohamed',      'M', DATE '1980-03-15', 'GM123456', '+212 6 11 22 33 44', 'mohamed.alami@example.ma',      '12 Rue Allal Ben Abdellah', 'Casablanca'
WHERE NOT EXISTS (SELECT 1 FROM patient_patient WHERE cin = 'GM123456');

INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date, cin, phone, email, address, city)
SELECT gen_random_uuid(), 'Lahlou',       'Fatima Zahra', 'F', DATE '1993-07-22', 'AB234567', '+212 6 22 33 44 55', 'fatima.lahlou@example.ma',      '45 Boulevard Mohamed V',    'Rabat'
WHERE NOT EXISTS (SELECT 1 FROM patient_patient WHERE cin = 'AB234567');

INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date, cin, phone, email, address, city)
SELECT gen_random_uuid(), 'Ziani',        'Youssef',      'M', DATE '1998-11-03', 'CD345678', '+212 6 33 44 55 66', 'youssef.ziani@example.ma',      '8 Rue de la Liberté',       'Casablanca'
WHERE NOT EXISTS (SELECT 1 FROM patient_patient WHERE cin = 'CD345678');

INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date, cin, phone, email, address, city)
SELECT gen_random_uuid(), 'Tahiri',       'Khadija',      'F', DATE '1970-01-28', 'EF456789', '+212 6 44 55 66 77', 'khadija.tahiri@example.ma',     '22 Avenue Hassan II',       'Fès'
WHERE NOT EXISTS (SELECT 1 FROM patient_patient WHERE cin = 'EF456789');

INSERT INTO patient_patient (id, last_name, first_name, gender, birth_date, cin, phone, email, address, city)
SELECT gen_random_uuid(), 'Cherkaoui',    'Ahmed',        'M', DATE '1959-06-10', 'GH567890', '+212 6 55 66 77 88', 'ahmed.cherkaoui@example.ma',    '101 Rue Ibn Batouta',       'Marrakech'
WHERE NOT EXISTS (SELECT 1 FROM patient_patient WHERE cin = 'GH567890');

-- -----------------------------------------------------------------------------
-- Demo allergies for a couple of patients (to exercise alert logic later)
-- -----------------------------------------------------------------------------
INSERT INTO patient_allergy (id, patient_id, substance, atc_tag, severity)
SELECT gen_random_uuid(), p.id, 'Pénicilline', 'penicillines', 'SEVERE'
FROM patient_patient p
WHERE p.cin = 'GM123456'
  AND NOT EXISTS (SELECT 1 FROM patient_allergy a WHERE a.patient_id = p.id AND a.substance = 'Pénicilline');

INSERT INTO patient_allergy (id, patient_id, substance, atc_tag, severity)
SELECT gen_random_uuid(), p.id, 'Iode', 'iode', 'MODEREE'
FROM patient_patient p
WHERE p.cin = 'EF456789'
  AND NOT EXISTS (SELECT 1 FROM patient_allergy a WHERE a.patient_id = p.id AND a.substance = 'Iode');

-- -----------------------------------------------------------------------------
-- Demo medication catalog (20 common Moroccan drugs)
-- -----------------------------------------------------------------------------
INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags, favorite)
SELECT gen_random_uuid(), x.commercial, x.dci, x.form, x.dosage, x.tags, TRUE
FROM (VALUES
    ('Doliprane',     'Paracétamol',                    'comprimé',          '1g',     'antalgique'),
    ('Doliprane',     'Paracétamol',                    'comprimé',          '500mg',  'antalgique'),
    ('Efferalgan',    'Paracétamol',                    'comprimé effervescent', '1g', 'antalgique'),
    ('Efferalgan',    'Paracétamol',                    'comprimé',          '500mg',  'antalgique'),
    ('Amoxicilline',  'Amoxicilline',                   'gélule',            '500mg',  'penicillines'),
    ('Augmentin',     'Amoxicilline + Acide clavulanique', 'comprimé',       '1g',     'penicillines'),
    ('Zithromax',     'Azithromycine',                  'comprimé',          '500mg',  'macrolides'),
    ('Glucophage',    'Metformine',                     'comprimé',          '1000mg', 'antidiabetique'),
    ('Glucophage',    'Metformine',                     'comprimé',          '500mg',  'antidiabetique'),
    ('Amlor',         'Amlodipine',                     'gélule',            '5mg',    'antihypertenseur'),
    ('Amlor',         'Amlodipine',                     'gélule',            '10mg',   'antihypertenseur'),
    ('Tahor',         'Atorvastatine',                  'comprimé',          '20mg',   'statine'),
    ('Tahor',         'Atorvastatine',                  'comprimé',          '40mg',   'statine'),
    ('Mopral',        'Oméprazole',                     'gélule',            '20mg',   'ipp'),
    ('Inexium',       'Ésoméprazole',                   'comprimé',          '40mg',   'ipp'),
    ('Brufen',        'Ibuprofène',                     'comprimé',          '400mg',  'ains'),
    ('Spasfon',       'Phloroglucinol',                 'comprimé',          '80mg',   'antispasmodique'),
    ('Lasilix',       'Furosémide',                     'comprimé',          '40mg',   'diuretique'),
    ('Cortancyl',     'Prednisone',                     'comprimé',          '20mg',   'corticoide'),
    ('Xanax',         'Alprazolam',                     'comprimé',          '0.25mg', 'benzodiazepine')
) AS x (commercial, dci, form, dosage, tags)
WHERE NOT EXISTS (
    SELECT 1 FROM catalog_medication m
    WHERE m.commercial_name = x.commercial AND m.dci = x.dci AND m.dosage = x.dosage
);

-- -----------------------------------------------------------------------------
-- Demo lab tests (10 common)
-- -----------------------------------------------------------------------------
INSERT INTO catalog_lab_test (id, code, name, category)
SELECT gen_random_uuid(), x.code, x.name, x.category
FROM (VALUES
    ('NFS',     'Numération Formule Sanguine (NFS)',     'hematologie'),
    ('CRP',     'Protéine C-réactive (CRP)',             'inflammation'),
    ('GLY',     'Glycémie à jeun',                       'diabete'),
    ('HBA1C',   'Hémoglobine glyquée (HbA1c)',           'diabete'),
    ('CHOL',    'Bilan lipidique (cholestérol total, HDL, LDL, TG)', 'lipides'),
    ('CREA',    'Créatinine + clairance',                'rein'),
    ('UREE',    'Urée sanguine',                         'rein'),
    ('TSH',     'TSH',                                   'thyroide'),
    ('ECBU',    'Examen cytobactériologique des urines', 'urines'),
    ('TP',      'Taux de prothrombine (TP / INR)',       'coagulation')
) AS x (code, name, category)
WHERE NOT EXISTS (SELECT 1 FROM catalog_lab_test l WHERE l.code = x.code);

-- -----------------------------------------------------------------------------
-- Demo imaging exams (8 common)
-- -----------------------------------------------------------------------------
INSERT INTO catalog_imaging_exam (id, code, name, modality)
SELECT gen_random_uuid(), x.code, x.name, x.modality
FROM (VALUES
    ('RADIO_THX',  'Radiographie du thorax (face)',   'RADIO'),
    ('RADIO_ABDO', 'Radiographie abdomen sans prép.', 'RADIO'),
    ('RADIO_RACH', 'Radiographie rachis lombaire',    'RADIO'),
    ('ECHO_ABDO',  'Échographie abdominale',          'ECHO'),
    ('ECHO_PELV',  'Échographie pelvienne',           'ECHO'),
    ('ECHO_CARD',  'Échographie cardiaque',           'ECHO'),
    ('SCAN_CERE',  'Scanner cérébral sans injection', 'SCANNER'),
    ('IRM_GENOU',  'IRM du genou',                    'IRM')
) AS x (code, name, modality)
WHERE NOT EXISTS (SELECT 1 FROM catalog_imaging_exam i WHERE i.code = x.code);
