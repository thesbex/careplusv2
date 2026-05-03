-- Repeatable extended catalog seed — fills medication / lab / imaging
-- referentiels with realistic Moroccan general-practice data.
-- Loaded only in dev profile (same trigger as R__seed_dev.sql).
-- Idempotent — every INSERT guarded with NOT EXISTS.
-- Runs after R__seed_dev.sql (alphabetical order on the file basename).

-- =============================================================================
-- MEDICATIONS — common DCI on the Moroccan market
-- =============================================================================

INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags, favorite)
SELECT gen_random_uuid(), x.commercial, x.dci, x.form, x.dosage, x.tags, FALSE
FROM (VALUES
    -- Antalgiques / antipyrétiques
    ('Doliprane',        'Paracétamol',                       'sirop',                  '250mg/5ml', 'antalgique'),
    ('Aspégic',          'Acide acétylsalicylique',           'sachet',                 '1000mg',    'antalgique'),
    ('Aspégic',          'Acide acétylsalicylique',           'comprimé',               '500mg',     'antalgique'),
    ('Aspégic Nourrisson','Acide acétylsalicylique',          'sachet',                 '100mg',     'antiagregant'),
    ('Topalgic',         'Tramadol',                          'gélule',                 '50mg',      'antalgique-opioide'),
    ('Topalgic LP',      'Tramadol',                          'comprimé LP',            '100mg',     'antalgique-opioide'),
    ('Codoliprane',      'Paracétamol + Codéine',             'comprimé',               '500mg/30mg','antalgique-opioide'),

    -- AINS
    ('Voltarène',        'Diclofénac',                        'comprimé',               '50mg',      'ains'),
    ('Voltarène LP',     'Diclofénac',                        'comprimé LP',            '75mg',      'ains'),
    ('Voltarène',        'Diclofénac',                        'suppositoire',           '100mg',     'ains'),
    ('Voltarène Emulgel','Diclofénac',                        'gel',                    '1%',        'ains-topique'),
    ('Profénid',         'Kétoprofène',                       'comprimé',               '100mg',     'ains'),
    ('Profénid LP',      'Kétoprofène',                       'gélule LP',              '200mg',     'ains'),
    ('Mobic',            'Méloxicam',                         'comprimé',               '15mg',      'ains'),
    ('Celebrex',         'Célécoxib',                         'gélule',                 '200mg',     'ains-cox2'),
    ('Nifluril',         'Acide niflumique',                  'gélule',                 '250mg',     'ains'),
    ('Apranax',          'Naproxène',                         'comprimé',               '550mg',     'ains'),

    -- Antibiotiques
    ('Augmentin',        'Amoxicilline + Acide clavulanique', 'sachet',                 '1g',        'penicillines'),
    ('Augmentin',        'Amoxicilline + Acide clavulanique', 'comprimé',               '500mg',     'penicillines'),
    ('Clamoxyl',         'Amoxicilline',                      'sachet',                 '1g',        'penicillines'),
    ('Clamoxyl',         'Amoxicilline',                      'sirop',                  '250mg/5ml', 'penicillines'),
    ('Pyostacine',       'Pristinamycine',                    'comprimé',               '500mg',     'streptogramines'),
    ('Rocéphine',        'Ceftriaxone',                       'poudre injectable',      '1g',        'cephalosporines'),
    ('Orelox',           'Cefpodoxime',                       'comprimé',               '200mg',     'cephalosporines'),
    ('Oroken',           'Ceftibuten',                        'sachet',                 '400mg',     'cephalosporines'),
    ('Bactrim Forte',    'Sulfaméthoxazole + Triméthoprime',  'comprimé',               '800mg/160mg','sulfamides'),
    ('Birodogyl',        'Spiramycine + Métronidazole',       'comprimé',               '1.5MUI/250mg','antibiotique-mixte'),
    ('Flagyl',           'Métronidazole',                     'comprimé',               '500mg',     'nitroimidazoles'),
    ('Doxyval',          'Doxycycline',                       'comprimé',               '100mg',     'cyclines'),
    ('Vibramycine',      'Doxycycline',                       'comprimé',               '100mg',     'cyclines'),
    ('Ciflox',           'Ciprofloxacine',                    'comprimé',               '500mg',     'fluoroquinolones'),
    ('Tavanic',          'Lévofloxacine',                     'comprimé',               '500mg',     'fluoroquinolones'),
    ('Monuril',          'Fosfomycine',                       'sachet',                 '3g',        'antibiotique-urinaire'),

    -- Antiviraux / antifongiques
    ('Zovirax',          'Aciclovir',                         'comprimé',               '800mg',     'antiviral'),
    ('Zovirax',          'Aciclovir',                         'crème',                  '5%',        'antiviral-topique'),
    ('Mycostatine',      'Nystatine',                         'suspension',             '100000UI/ml','antifongique'),
    ('Triflucan',        'Fluconazole',                       'gélule',                 '150mg',     'antifongique'),
    ('Lamisil',          'Terbinafine',                       'comprimé',               '250mg',     'antifongique'),
    ('Pevaryl',          'Éconazole',                         'crème',                  '1%',        'antifongique-topique'),

    -- Antihistaminiques
    ('Aerius',           'Désloratadine',                     'comprimé',               '5mg',       'antihistaminique'),
    ('Clarytine',        'Loratadine',                        'comprimé',               '10mg',      'antihistaminique'),
    ('Zyrtec',           'Cétirizine',                        'comprimé',               '10mg',      'antihistaminique'),
    ('Polaramine',       'Dexchlorphéniramine',               'comprimé',               '2mg',       'antihistaminique-sedatif'),

    -- Pneumo / asthme
    ('Ventoline',        'Salbutamol',                        'aérosol',                '100µg/dose','bronchodilatateur'),
    ('Bricanyl',         'Terbutaline',                       'comprimé',               '5mg',       'bronchodilatateur'),
    ('Symbicort',        'Budésonide + Formotérol',           'aérosol',                '200/6µg',   'corticoide-inhale'),
    ('Seretide',         'Fluticasone + Salmétérol',          'aérosol',                '250/25µg',  'corticoide-inhale'),
    ('Singulair',        'Montélukast',                       'comprimé',               '10mg',      'antileucotriene'),
    ('Solupred',         'Prednisolone',                      'comprimé',               '20mg',      'corticoide'),
    ('Solupred',         'Prednisolone',                      'comprimé',               '5mg',       'corticoide'),
    ('Toplexil',         'Oxomémazine',                       'sirop',                  '0.33mg/ml', 'antitussif'),
    ('Mucomyst',         'Acétylcystéine',                    'sachet',                 '200mg',     'mucolytique'),
    ('Bisolvon',         'Bromhexine',                        'sirop',                  '4mg/5ml',   'expectorant'),

    -- Cardiologie / HTA
    ('Lopril',           'Captopril',                         'comprimé',               '25mg',      'iec'),
    ('Renitec',          'Énalapril',                         'comprimé',               '20mg',      'iec'),
    ('Triatec',          'Ramipril',                          'comprimé',               '5mg',       'iec'),
    ('Coversyl',         'Périndopril',                       'comprimé',               '5mg',       'iec'),
    ('Atacand',          'Candesartan',                       'comprimé',               '16mg',      'sartan'),
    ('Aprovel',          'Irbésartan',                        'comprimé',               '150mg',     'sartan'),
    ('Diovan',           'Valsartan',                         'comprimé',               '80mg',      'sartan'),
    ('Cozaar',           'Losartan',                          'comprimé',               '50mg',      'sartan'),
    ('Lasilix',          'Furosémide',                        'comprimé',               '20mg',      'diuretique'),
    ('Aldactone',        'Spironolactone',                    'comprimé',               '25mg',      'diuretique-epargneur'),
    ('Esidrex',          'Hydrochlorothiazide',               'comprimé',               '25mg',      'diuretique-thiazidique'),
    ('Tenormine',        'Aténolol',                          'comprimé',               '100mg',     'betabloquant'),
    ('Détensiel',        'Bisoprolol',                        'comprimé',               '5mg',       'betabloquant'),
    ('Sectral',          'Acébutolol',                        'comprimé',               '200mg',     'betabloquant'),
    ('Tildiem',          'Diltiazem',                         'comprimé',               '60mg',      'inhibiteur-calcique'),
    ('Loxen',            'Nicardipine',                       'gélule',                 '20mg',      'inhibiteur-calcique'),
    ('Adalate',          'Nifédipine',                        'gélule',                 '10mg',      'inhibiteur-calcique'),
    ('Cordarone',        'Amiodarone',                        'comprimé',               '200mg',     'antiarythmique'),
    ('Plavix',           'Clopidogrel',                       'comprimé',               '75mg',      'antiagregant'),
    ('Sintrom',          'Acénocoumarol',                     'comprimé',               '4mg',       'anticoagulant'),
    ('Préviscan',        'Fluindione',                        'comprimé',               '20mg',      'anticoagulant'),
    ('Eliquis',          'Apixaban',                          'comprimé',               '5mg',       'anticoagulant-aod'),
    ('Xarelto',          'Rivaroxaban',                       'comprimé',               '20mg',      'anticoagulant-aod'),
    ('Crestor',          'Rosuvastatine',                     'comprimé',               '10mg',      'statine'),
    ('Zocor',            'Simvastatine',                      'comprimé',               '40mg',      'statine'),

    -- Diabète
    ('Glucophage',       'Metformine',                        'comprimé',               '850mg',     'antidiabetique'),
    ('Diamicron LM',     'Gliclazide',                        'comprimé LM',            '30mg',      'antidiabetique-sulfamide'),
    ('Janumet',          'Sitagliptine + Metformine',         'comprimé',               '50/1000mg', 'antidiabetique'),
    ('Januvia',          'Sitagliptine',                      'comprimé',               '100mg',     'antidiabetique-dpp4'),
    ('Ozempic',          'Sémaglutide',                       'stylo',                  '1mg',       'antidiabetique-glp1'),
    ('Lantus',           'Insuline glargine',                 'stylo',                  '100UI/ml',  'insuline'),
    ('Humalog',          'Insuline lispro',                   'stylo',                  '100UI/ml',  'insuline-rapide'),

    -- Gastro
    ('Mopral',           'Oméprazole',                        'gélule',                 '10mg',      'ipp'),
    ('Inipomp',          'Pantoprazole',                      'comprimé',               '40mg',      'ipp'),
    ('Lanzor',           'Lansoprazole',                      'gélule',                 '30mg',      'ipp'),
    ('Maalox',           'Hydroxyde alu/Mg',                  'sachet',                 '1 dose',    'antiacide'),
    ('Gaviscon',         'Alginate de sodium',                'suspension',             '10ml',      'antiacide'),
    ('Smecta',           'Diosmectite',                       'sachet',                 '3g',        'antidiarrheique'),
    ('Tiorfan',          'Racécadotril',                      'gélule',                 '100mg',     'antidiarrheique'),
    ('Imodium',          'Lopéramide',                        'gélule',                 '2mg',       'antidiarrheique'),
    ('Forlax',           'Macrogol',                          'sachet',                 '10g',       'laxatif'),
    ('Duphalac',         'Lactulose',                         'sachet',                 '10g',       'laxatif'),
    ('Spasfon Lyoc',     'Phloroglucinol',                    'lyoc',                   '160mg',     'antispasmodique'),
    ('Debridat',         'Trimébutine',                       'comprimé',               '100mg',     'antispasmodique'),
    ('Primpéran',        'Métoclopramide',                    'comprimé',               '10mg',      'antiemetique'),
    ('Motilium',         'Dompéridone',                       'comprimé',               '10mg',      'antiemetique'),
    ('Vogalène',         'Métopimazine',                      'comprimé',               '7.5mg',     'antiemetique'),

    -- Endocrinologie
    ('Lévothyrox',       'Lévothyroxine',                     'comprimé',               '100µg',     'thyroide'),
    ('Lévothyrox',       'Lévothyroxine',                     'comprimé',               '50µg',      'thyroide'),
    ('Néo-mercazole',    'Carbimazole',                       'comprimé',               '5mg',       'antithyroidien'),

    -- Vitamines / minéraux
    ('Tardyferon',       'Sulfate de fer',                    'comprimé',               '80mg',      'fer'),
    ('Spéciafoldine',    'Acide folique',                     'comprimé',               '5mg',       'vitamine'),
    ('ZymaD',            'Vitamine D3',                       'sirop',                  '100000UI',  'vitamine'),
    ('Uvedose',          'Vitamine D3',                       'ampoule',                '100000UI',  'vitamine'),
    ('Stérogyl',         'Vitamine D2',                       'gouttes',                '0.4mg/ml',  'vitamine'),

    -- Psychiatrie
    ('Lexomil',          'Bromazépam',                        'comprimé',               '6mg',       'benzodiazepine'),
    ('Tranxene',         'Clorazépate',                       'gélule',                 '5mg',       'benzodiazepine'),
    ('Lysanxia',         'Prazépam',                          'comprimé',               '10mg',      'benzodiazepine'),
    ('Lexapro',          'Escitalopram',                      'comprimé',               '10mg',      'antidepresseur-isrs'),
    ('Deroxat',          'Paroxétine',                        'comprimé',               '20mg',      'antidepresseur-isrs'),
    ('Effexor LP',       'Venlafaxine',                       'comprimé LP',            '75mg',      'antidepresseur-irsna'),
    ('Zoloft',           'Sertraline',                        'comprimé',               '50mg',      'antidepresseur-isrs'),
    ('Risperdal',        'Rispéridone',                       'comprimé',               '2mg',       'antipsychotique'),
    ('Stilnox',          'Zolpidem',                          'comprimé',               '10mg',      'hypnotique'),

    -- Gynéco / urologie
    ('Diane 35',         'Cyprotérone + Éthinylestradiol',    'comprimé',               '2mg/35µg',  'contraceptif-acne'),
    ('Microval',         'Lévonorgestrel',                    'comprimé',               '0.03mg',    'contraceptif'),
    ('Norlevo',          'Lévonorgestrel',                    'comprimé',               '1.5mg',     'contraception-urgence'),
    ('Vésicare',         'Solifénacine',                      'comprimé',               '5mg',       'urologie'),
    ('Permixon',         'Serenoa repens',                    'gélule',                 '160mg',     'phytotherapie-prostate'),
    ('Xatral LP',        'Alfuzosine',                        'comprimé LP',            '10mg',      'alphabloquant'),

    -- Dermatologie
    ('Kétoderm',         'Kétoconazole',                      'shampoing',              '2%',        'antifongique-topique'),
    ('Triderm',          'Bétaméthasone + gentamicine + clotrimazole','crème',           '15g',       'corticoide-topique'),
    ('Diprosone',        'Bétaméthasone',                     'crème',                  '0.05%',     'corticoide-topique'),
    ('Locapred',         'Désonide',                          'crème',                  '0.1%',      'corticoide-topique')
) AS x (commercial, dci, form, dosage, tags)
WHERE NOT EXISTS (
    SELECT 1 FROM catalog_medication m
    WHERE m.commercial_name = x.commercial AND m.dci = x.dci AND m.dosage = x.dosage
);

-- =============================================================================
-- LAB TESTS — common biology orders (codes inspired by NABM Maroc)
-- =============================================================================

INSERT INTO catalog_lab_test (id, code, name, category)
SELECT gen_random_uuid(), x.code, x.name, x.category
FROM (VALUES
    -- Hématologie
    ('VS',         'Vitesse de sédimentation (VS)',                    'hematologie'),
    ('FERRITINE',  'Ferritine sérique',                                'hematologie'),
    ('FER',        'Fer sérique + capacité de fixation',               'hematologie'),
    ('VIT_B12',    'Vitamine B12',                                     'hematologie'),
    ('FOLATES',    'Folates (B9)',                                     'hematologie'),
    ('GROUPE_RH',  'Groupe sanguin + Rhésus',                          'hematologie'),
    ('RAI',        'RAI (recherche d''agglutinines irrégulières)',     'hematologie'),
    ('RETICULO',   'Réticulocytes',                                    'hematologie'),
    -- Inflammation / infection
    ('PCT',        'Procalcitonine (PCT)',                             'inflammation'),
    ('SERO_HIV',   'Sérologie VIH (Combo Ag p24/Ac)',                  'serologie'),
    ('SERO_HEPB',  'Sérologie hépatite B (AgHBs, Ac anti-HBs, anti-HBc)','serologie'),
    ('SERO_HEPC',  'Sérologie hépatite C (Ac anti-VHC)',               'serologie'),
    ('SERO_SYPH',  'Sérologie syphilis (TPHA-VDRL)',                   'serologie'),
    ('SERO_TOXO',  'Sérologie toxoplasmose (IgG/IgM)',                 'serologie'),
    ('SERO_RUB',   'Sérologie rubéole (IgG/IgM)',                      'serologie'),
    -- Diabète / métabolisme
    ('GLY_PP',     'Glycémie post-prandiale',                          'diabete'),
    ('HGPO',       'Hyperglycémie provoquée par voie orale (HGPO)',    'diabete'),
    ('FRUCTOS',    'Fructosamine',                                     'diabete'),
    -- Lipides
    ('TG',         'Triglycérides',                                    'lipides'),
    ('HDL',        'HDL cholestérol',                                  'lipides'),
    ('LDL',        'LDL cholestérol',                                  'lipides'),
    -- Rein / iono
    ('IONO_S',     'Ionogramme sanguin (Na, K, Cl)',                   'rein'),
    ('IONO_U',     'Ionogramme urinaire',                              'rein'),
    ('CALCIUM',    'Calcémie',                                         'rein'),
    ('MAGNESIUM',  'Magnésémie',                                       'rein'),
    ('PHOSPHORE',  'Phosphorémie',                                     'rein'),
    ('PROT_24H',   'Protéinurie des 24h',                              'rein'),
    ('MICROALB',   'Microalbuminurie',                                 'rein'),
    -- Foie / pancréas
    ('BILAN_HEP',  'Bilan hépatique (ASAT, ALAT, GGT, PAL)',           'foie'),
    ('BILIRUBINE', 'Bilirubine totale + conjuguée',                    'foie'),
    ('LIPASE',     'Lipase',                                           'pancreas'),
    ('AMYLASE',    'Amylase',                                          'pancreas'),
    -- Thyroïde / endocrino
    ('T4L',        'T4 libre',                                         'thyroide'),
    ('T3L',        'T3 libre',                                         'thyroide'),
    ('AC_TPO',     'Anticorps anti-TPO',                               'thyroide'),
    ('CORTISOL_8H','Cortisol à 8h',                                    'endocrino'),
    ('PROLACTINE', 'Prolactine',                                       'endocrino'),
    -- Marqueurs cardiaques / coag
    ('TROPO',      'Troponine ultra-sensible',                         'cardiaque'),
    ('BNP',        'BNP / NT-proBNP',                                  'cardiaque'),
    ('D_DIMERES',  'D-Dimères',                                        'coagulation'),
    ('TCA',        'TCA (temps de céphaline activée)',                 'coagulation'),
    ('FIBRINOGENE','Fibrinogène',                                      'coagulation'),
    -- Marqueurs tumoraux
    ('PSA',        'PSA total + libre',                                'oncologie'),
    ('CA125',      'CA 125',                                           'oncologie'),
    ('CA19_9',     'CA 19-9',                                          'oncologie'),
    ('AFP',        'Alpha-foetoprotéine (AFP)',                        'oncologie'),
    ('CEA',        'ACE (antigène carcino-embryonnaire)',              'oncologie'),
    -- Gynéco / grossesse
    ('BHCG',       'β-hCG quantitatif',                                'gynecologie'),
    ('FROTTIS',    'Frottis cervico-vaginal',                          'gynecologie'),
    -- Autres bactério / parasito
    ('COPRO',      'Coproculture',                                     'bacteriologie'),
    ('PARASITO',   'Examen parasitologique des selles',                'parasitologie'),
    ('CHLAMYDIA',  'PCR Chlamydia trachomatis',                        'bacteriologie'),
    ('STREPTO_A',  'Test rapide angine (Streptocoque A)',              'bacteriologie'),
    -- Vitamines
    ('VIT_D',      'Vitamine D 25-OH',                                 'vitamines'),
    -- Allergologie
    ('IGE_TOT',    'IgE totales',                                      'allergologie'),
    ('PHADIATOP',  'Phadiatop (mélange aéroallergènes)',               'allergologie')
) AS x (code, name, category)
WHERE NOT EXISTS (SELECT 1 FROM catalog_lab_test l WHERE l.code = x.code);

-- =============================================================================
-- IMAGING — common general-practice orders
-- =============================================================================

INSERT INTO catalog_imaging_exam (id, code, name, modality)
SELECT gen_random_uuid(), x.code, x.name, x.modality
FROM (VALUES
    -- Radio
    ('RADIO_BASS',  'Radiographie du bassin de face',              'RADIO'),
    ('RADIO_MEM_INF','Radiographie du membre inférieur',           'RADIO'),
    ('RADIO_MEM_SUP','Radiographie du membre supérieur',           'RADIO'),
    ('RADIO_GENOU', 'Radiographie du genou (face + profil)',       'RADIO'),
    ('RADIO_EPAULE','Radiographie de l''épaule',                   'RADIO'),
    ('RADIO_CRANE', 'Radiographie du crâne',                       'RADIO'),
    ('RADIO_SINUS', 'Radiographie des sinus',                      'RADIO'),
    ('RADIO_DENT',  'Panoramique dentaire',                        'RADIO'),
    ('RADIO_RACH_C','Radiographie rachis cervical',                'RADIO'),
    ('RADIO_RACH_D','Radiographie rachis dorsal',                  'RADIO'),
    -- Échographie
    ('ECHO_REIN',   'Échographie rénale et vésicale',              'ECHO'),
    ('ECHO_THYR',   'Échographie thyroïdienne',                    'ECHO'),
    ('ECHO_MAMM',   'Échographie mammaire',                        'ECHO'),
    ('ECHO_OBSTE',  'Échographie obstétricale',                    'ECHO'),
    ('ECHO_DOPP_MI','Écho-doppler veineux des membres inférieurs', 'ECHO'),
    ('ECHO_DOPP_TSA','Écho-doppler des troncs supra-aortiques',    'ECHO'),
    ('ECHO_PROST',  'Échographie prostatique',                     'ECHO'),
    ('ECHO_PARTIES_M','Échographie des parties molles',            'ECHO'),
    -- Mammographie
    ('MAMMO',       'Mammographie bilatérale',                     'MAMMO'),
    -- Scanner
    ('SCAN_THX',    'Scanner thoracique',                          'SCANNER'),
    ('SCAN_ABDO',   'Scanner abdomino-pelvien',                    'SCANNER'),
    ('SCAN_RACH_L', 'Scanner rachis lombaire',                     'SCANNER'),
    ('SCAN_SINUS',  'Scanner des sinus',                           'SCANNER'),
    ('SCAN_AURI',   'Scanner des oreilles',                        'SCANNER'),
    ('ANGIOSCAN',   'Angio-scanner thoracique',                    'SCANNER'),
    -- IRM
    ('IRM_CERE',    'IRM cérébrale',                               'IRM'),
    ('IRM_RACH_C',  'IRM rachis cervical',                         'IRM'),
    ('IRM_RACH_L',  'IRM rachis lombaire',                         'IRM'),
    ('IRM_EPAULE',  'IRM de l''épaule',                            'IRM'),
    ('IRM_HANCHE',  'IRM de la hanche',                            'IRM'),
    ('IRM_PELV',    'IRM pelvienne',                               'IRM'),
    ('IRM_ABDO',    'IRM abdominale',                              'IRM'),
    -- Médecine nucléaire / explorations
    ('SCINTI_OS',   'Scintigraphie osseuse',                       'MEDECINE_NUCLEAIRE'),
    ('SCINTI_THYR', 'Scintigraphie thyroïdienne',                  'MEDECINE_NUCLEAIRE'),
    ('FIBRO_GASTRO','Fibroscopie œso-gastro-duodénale',            'ENDOSCOPIE'),
    ('COLOSCOPIE',  'Coloscopie',                                  'ENDOSCOPIE')
) AS x (code, name, modality)
WHERE NOT EXISTS (SELECT 1 FROM catalog_imaging_exam i WHERE i.code = x.code);
