-- =============================================================================
-- V011 — Référentiel médicaments commercialisés au Maroc
-- =============================================================================
-- Sources : DMP (Direction du Médicament et de la Pharmacie, Ministère de la
-- Santé) et bases publiques (Vidal MA, Pharmacie.ma). Liste non exhaustive,
-- ciblant les molécules les plus prescrites en médecine générale.
--
-- Stratégie : on insère en INSERT … WHERE NOT EXISTS pour rester idempotent
-- avec les précédents seeds dev (R__seed_dev.sql) qui pouvaient avoir déjà
-- ajouté quelques entrées de la même liste. Le tag pharmacologique est utilisé
-- côté backend pour le contrôle d'allergies (penicillines, sulfamides, ains, …).

INSERT INTO catalog_medication (id, commercial_name, dci, form, dosage, tags, favorite)
SELECT gen_random_uuid(), x.commercial, x.dci, x.form, x.dosage, x.tags, x.fav
FROM (VALUES
    -- ── Antalgiques / antipyrétiques ─────────────────────────────────────
    ('Doliprane',         'Paracétamol',                    'comprimé',     '1g',       'antalgique', TRUE),
    ('Doliprane',         'Paracétamol',                    'comprimé',     '500mg',    'antalgique', TRUE),
    ('Doliprane',         'Paracétamol',                    'sachet',       '1g',       'antalgique', FALSE),
    ('Doliprane',         'Paracétamol',                    'sirop',        '2,4%',     'antalgique', FALSE),
    ('Efferalgan',        'Paracétamol',                    'comprimé eff', '500mg',    'antalgique', TRUE),
    ('Efferalgan',        'Paracétamol',                    'comprimé eff', '1g',       'antalgique', TRUE),
    ('Dafalgan',          'Paracétamol',                    'comprimé',     '500mg',    'antalgique', TRUE),
    ('Dafalgan',          'Paracétamol',                    'comprimé',     '1g',       'antalgique', TRUE),
    ('Panadol',           'Paracétamol',                    'comprimé',     '500mg',    'antalgique', TRUE),
    ('Aspégic',           'Acide acétylsalicylique',        'sachet',       '1000mg',   'aspirine',   FALSE),
    ('Aspégic',           'Acide acétylsalicylique',        'sachet',       '500mg',    'aspirine',   FALSE),
    ('Aspirine UPSA',     'Acide acétylsalicylique',        'comprimé eff', '500mg',    'aspirine',   FALSE),
    ('Kardégic',          'Acide acétylsalicylique',        'sachet',       '75mg',     'aspirine',   FALSE),

    -- ── AINS ──────────────────────────────────────────────────────────────
    ('Brufen',            'Ibuprofène',                     'comprimé',     '400mg',    'ains',       TRUE),
    ('Brufen',            'Ibuprofène',                     'comprimé',     '600mg',    'ains',       TRUE),
    ('Brufen',            'Ibuprofène',                     'sirop',        '20mg/ml',  'ains',       FALSE),
    ('Advil',             'Ibuprofène',                     'comprimé',     '200mg',    'ains',       FALSE),
    ('Advil',             'Ibuprofène',                     'comprimé',     '400mg',    'ains',       TRUE),
    ('Nurofen',           'Ibuprofène',                     'comprimé',     '400mg',    'ains',       FALSE),
    ('Spedifen',          'Ibuprofène',                     'comprimé',     '400mg',    'ains',       FALSE),
    ('Voltarène',         'Diclofénac',                     'comprimé LP',  '75mg',     'ains',       TRUE),
    ('Voltarène',         'Diclofénac',                     'comprimé LP',  '100mg',    'ains',       TRUE),
    ('Voltarène',         'Diclofénac',                     'gel',          '1%',       'ains',       FALSE),
    ('Olfen',             'Diclofénac',                     'comprimé',     '50mg',     'ains',       FALSE),
    ('Naprosyne',         'Naproxène',                      'comprimé',     '500mg',    'ains',       FALSE),
    ('Apranax',           'Naproxène',                      'comprimé',     '550mg',    'ains',       FALSE),
    ('Mobic',             'Méloxicam',                      'comprimé',     '15mg',     'ains',       FALSE),
    ('Feldene',           'Piroxicam',                      'comprimé',     '20mg',     'ains',       FALSE),
    ('Celebrex',          'Célécoxib',                      'gélule',       '200mg',    'ains',       FALSE),
    ('Arcoxia',           'Etoricoxib',                     'comprimé',     '90mg',     'ains',       FALSE),
    ('Profénid',          'Kétoprofène',                    'comprimé LP',  '200mg',    'ains',       FALSE),
    ('Bi-profénid',       'Kétoprofène',                    'comprimé LP',  '150mg',    'ains',       FALSE),
    ('Indocid',           'Indométacine',                   'gélule',       '25mg',     'ains',       FALSE),

    -- ── Antalgiques de palier 2 / 3 ──────────────────────────────────────
    ('Tramadol',          'Tramadol',                       'comprimé',     '50mg',     'opioide',    FALSE),
    ('Topalgic',          'Tramadol',                       'comprimé LP',  '100mg',    'opioide',    FALSE),
    ('Ixprim',            'Tramadol+Paracétamol',           'comprimé',     '37,5+325mg','opioide',   FALSE),
    ('Doliprane Codéiné', 'Paracétamol+Codéine',            'comprimé',     '500+30mg', 'opioide',    FALSE),
    ('Codoliprane',       'Paracétamol+Codéine',            'comprimé',     '400+20mg', 'opioide',    FALSE),

    -- ── Antispasmodiques ─────────────────────────────────────────────────
    ('Spasfon',           'Phloroglucinol',                 'comprimé',     '80mg',     'antispas',   TRUE),
    ('Spasfon Lyoc',      'Phloroglucinol',                 'lyophilisat',  '80mg',     'antispas',   FALSE),
    ('Spasmoplus',        'Tiémonium',                      'comprimé',     '50mg',     'antispas',   FALSE),
    ('Buscopan',          'Butylscopolamine',               'comprimé',     '10mg',     'antispas',   FALSE),
    ('Debridat',          'Trimébutine',                    'comprimé',     '100mg',    'antispas',   FALSE),
    ('Debridat',          'Trimébutine',                    'comprimé',     '200mg',    'antispas',   FALSE),

    -- ── Bêta-lactamines / pénicillines (allergène majeur) ────────────────
    ('Clamoxyl',          'Amoxicilline',                   'gélule',       '500mg',    'penicillines', TRUE),
    ('Clamoxyl',          'Amoxicilline',                   'comprimé',     '1g',       'penicillines', TRUE),
    ('Clamoxyl',          'Amoxicilline',                   'sirop',        '125mg/5ml','penicillines', FALSE),
    ('Clamoxyl',          'Amoxicilline',                   'sirop',        '250mg/5ml','penicillines', FALSE),
    ('Amoxil',            'Amoxicilline',                   'gélule',       '500mg',    'penicillines', FALSE),
    ('Hiconcil',          'Amoxicilline',                   'gélule',       '500mg',    'penicillines', FALSE),
    ('Augmentin',         'Amoxicilline+Acide clavulanique','comprimé',     '500+62,5mg','penicillines', TRUE),
    ('Augmentin',         'Amoxicilline+Acide clavulanique','comprimé',     '1g',       'penicillines', TRUE),
    ('Augmentin',         'Amoxicilline+Acide clavulanique','sachet',       '500+62,5mg','penicillines',FALSE),
    ('Augmentin',         'Amoxicilline+Acide clavulanique','sirop',        '100mg/12,5mg','penicillines',FALSE),
    ('Ciblor',            'Amoxicilline+Acide clavulanique','comprimé',     '1g',       'penicillines', FALSE),
    ('Oroken',            'Céfixime',                       'comprimé',     '200mg',    'cephalosporines', FALSE),
    ('Oroken',            'Céfixime',                       'sirop',        '40mg/5ml', 'cephalosporines', FALSE),
    ('Zinnat',            'Céfuroxime',                     'comprimé',     '500mg',    'cephalosporines', FALSE),
    ('Rocéphine',         'Ceftriaxone',                    'injectable',   '1g',       'cephalosporines', FALSE),
    ('Pyostacine',        'Pristinamycine',                 'comprimé',     '500mg',    'macrolides', FALSE),

    -- ── Macrolides ───────────────────────────────────────────────────────
    ('Zithromax',         'Azithromycine',                  'comprimé',     '500mg',    'macrolides', TRUE),
    ('Zithromax',         'Azithromycine',                  'sirop',        '40mg/ml',  'macrolides', FALSE),
    ('Rovamycine',        'Spiramycine',                    'comprimé',     '3MUI',     'macrolides', FALSE),
    ('Naxy',              'Clarithromycine',                'comprimé',     '500mg',    'macrolides', FALSE),
    ('Zeclar',            'Clarithromycine',                'comprimé',     '500mg',    'macrolides', FALSE),
    ('Rulid',             'Roxithromycine',                 'comprimé',     '150mg',    'macrolides', FALSE),

    -- ── Quinolones ───────────────────────────────────────────────────────
    ('Ciflox',            'Ciprofloxacine',                 'comprimé',     '500mg',    'quinolones', FALSE),
    ('Tavanic',           'Lévofloxacine',                  'comprimé',     '500mg',    'quinolones', FALSE),
    ('Oflocet',           'Ofloxacine',                     'comprimé',     '200mg',    'quinolones', FALSE),

    -- ── Antibactériens divers ────────────────────────────────────────────
    ('Bactrim',           'Sulfaméthoxazole+Triméthoprime', 'comprimé',     '800+160mg','sulfamides', FALSE),
    ('Flagyl',            'Métronidazole',                  'comprimé',     '500mg',    'imidazoles', FALSE),
    ('Flagyl',            'Métronidazole',                  'sirop',        '125mg/5ml','imidazoles', FALSE),
    ('Furadantine',       'Nitrofurantoïne',                'gélule',       '50mg',     'antibacterien', FALSE),
    ('Monuril',           'Fosfomycine',                    'sachet',       '3g',       'antibacterien', FALSE),

    -- ── IPP / antiacides ─────────────────────────────────────────────────
    ('Inexium',           'Esoméprazole',                   'comprimé',     '20mg',     'ipp',         TRUE),
    ('Inexium',           'Esoméprazole',                   'comprimé',     '40mg',     'ipp',         TRUE),
    ('Mopral',            'Oméprazole',                     'gélule',       '20mg',     'ipp',         TRUE),
    ('Lanzor',            'Lansoprazole',                   'gélule',       '30mg',     'ipp',         FALSE),
    ('Pariet',            'Rabéprazole',                    'comprimé',     '20mg',     'ipp',         FALSE),
    ('Eupantol',          'Pantoprazole',                   'comprimé',     '40mg',     'ipp',         FALSE),
    ('Maalox',            'Hydroxydes Al/Mg',               'comprimé',     '—',        'antiacide',  FALSE),
    ('Gaviscon',          'Alginate+Bicarbonate',           'sachet',       '10ml',     'antiacide',  FALSE),
    ('Gastropulgite',     'Attapulgite',                    'sachet',       '2,5g',     'antiacide',  FALSE),

    -- ── Anti-diarrhéiques / laxatifs ─────────────────────────────────────
    ('Smecta',            'Diosmectite',                    'sachet',       '3g',       'antidiarrh', TRUE),
    ('Imodium',           'Lopéramide',                     'gélule',       '2mg',      'antidiarrh', FALSE),
    ('Tiorfan',           'Racécadotril',                   'gélule',       '100mg',    'antidiarrh', FALSE),
    ('Forlax',            'Macrogol',                       'sachet',       '10g',      'laxatif',    FALSE),
    ('Duphalac',          'Lactulose',                      'sirop',        '10g/15ml', 'laxatif',    FALSE),
    ('Movicol',           'Macrogol',                       'sachet',       '13,8g',    'laxatif',    FALSE),

    -- ── Antiémétiques ────────────────────────────────────────────────────
    ('Motilium',          'Dompéridone',                    'comprimé',     '10mg',     'antiemet',   TRUE),
    ('Primpéran',         'Métoclopramide',                 'comprimé',     '10mg',     'antiemet',   FALSE),
    ('Vogalène',          'Métopimazine',                   'comprimé',     '15mg',     'antiemet',   FALSE),
    ('Zophren',           'Ondansétron',                    'comprimé',     '4mg',      'antiemet',   FALSE),

    -- ── Antihistaminiques / allergie ─────────────────────────────────────
    ('Aerius',            'Desloratadine',                  'comprimé',     '5mg',      'antihistam', TRUE),
    ('Zyrtec',            'Cétirizine',                     'comprimé',     '10mg',     'antihistam', TRUE),
    ('Clarityne',         'Loratadine',                     'comprimé',     '10mg',     'antihistam', FALSE),
    ('Polaramine',        'Dexchlorphéniramine',            'comprimé',     '2mg',      'antihistam', FALSE),
    ('Atarax',            'Hydroxyzine',                    'comprimé',     '25mg',     'antihistam', FALSE),

    -- ── Bronchodilatateurs / asthme ──────────────────────────────────────
    ('Ventoline',         'Salbutamol',                     'spray',        '100µg',    'bronchodil', TRUE),
    ('Ventoline',         'Salbutamol',                     'sirop',        '2mg/5ml',  'bronchodil', FALSE),
    ('Bricanyl',          'Terbutaline',                    'comprimé',     '5mg',      'bronchodil', FALSE),
    ('Sérétide',          'Salmétérol+Fluticasone',         'spray',        '25/125µg', 'bronchodil', FALSE),
    ('Symbicort',         'Formotérol+Budésonide',          'spray',        '160/4,5µg','bronchodil', FALSE),
    ('Singulair',         'Montélukast',                    'comprimé',     '10mg',     'antileuco',  FALSE),

    -- ── Antitussifs / mucolytiques ───────────────────────────────────────
    ('Bisolvon',          'Bromhexine',                     'sirop',        '4mg/5ml',  'mucolytique', FALSE),
    ('Mucomyst',          'N-acétylcystéine',               'sachet',       '200mg',    'mucolytique', FALSE),
    ('Fluimucil',         'N-acétylcystéine',               'comprimé eff', '600mg',    'mucolytique', FALSE),
    ('Toplexil',          'Oxomémazine',                    'sirop',        '0,33mg/ml','antitussif',  FALSE),

    -- ── Cardio : antihypertenseurs / statines ────────────────────────────
    ('Triatec',           'Ramipril',                       'comprimé',     '5mg',      'iec',         FALSE),
    ('Triatec',           'Ramipril',                       'comprimé',     '10mg',     'iec',         FALSE),
    ('Coversyl',          'Périndopril',                    'comprimé',     '5mg',      'iec',         FALSE),
    ('Renitec',           'Énalapril',                      'comprimé',     '20mg',     'iec',         FALSE),
    ('Tareg',             'Valsartan',                      'comprimé',     '80mg',     'sartan',      FALSE),
    ('Cozaar',            'Losartan',                       'comprimé',     '50mg',     'sartan',      FALSE),
    ('Aprovel',           'Irbésartan',                     'comprimé',     '150mg',    'sartan',      FALSE),
    ('Amlor',             'Amlodipine',                     'gélule',       '5mg',      'inhibcal',    TRUE),
    ('Amlor',             'Amlodipine',                     'gélule',       '10mg',     'inhibcal',    TRUE),
    ('Loxen',             'Nicardipine',                    'gélule',       '50mg',     'inhibcal',    FALSE),
    ('Adalate',           'Nifédipine',                     'gélule',       '20mg',     'inhibcal',    FALSE),
    ('Lopressor',         'Métoprolol',                     'comprimé',     '100mg',    'betabloq',    FALSE),
    ('Détensiel',         'Bisoprolol',                     'comprimé',     '5mg',      'betabloq',    FALSE),
    ('Aténolol',          'Aténolol',                       'comprimé',     '100mg',    'betabloq',    FALSE),
    ('Lasilix',           'Furosémide',                     'comprimé',     '40mg',     'diuretique',  FALSE),
    ('Aldactone',         'Spironolactone',                 'comprimé',     '25mg',     'diuretique',  FALSE),
    ('Esidrex',           'Hydrochlorothiazide',            'comprimé',     '25mg',     'diuretique',  FALSE),
    ('Tahor',             'Atorvastatine',                  'comprimé',     '20mg',     'statine',     TRUE),
    ('Tahor',             'Atorvastatine',                  'comprimé',     '40mg',     'statine',     FALSE),
    ('Crestor',           'Rosuvastatine',                  'comprimé',     '10mg',     'statine',     FALSE),
    ('Zocor',             'Simvastatine',                   'comprimé',     '20mg',     'statine',     FALSE),
    ('Plavix',            'Clopidogrel',                    'comprimé',     '75mg',     'antiagr',     FALSE),

    -- ── Diabète ──────────────────────────────────────────────────────────
    ('Glucophage',        'Metformine',                     'comprimé',     '500mg',    'antidiab',    TRUE),
    ('Glucophage',        'Metformine',                     'comprimé',     '850mg',    'antidiab',    TRUE),
    ('Glucophage',        'Metformine',                     'comprimé',     '1000mg',   'antidiab',    TRUE),
    ('Diamicron',         'Gliclazide',                     'comprimé LM',  '60mg',     'antidiab',    FALSE),
    ('Daonil',            'Glibenclamide',                  'comprimé',     '5mg',      'antidiab',    FALSE),
    ('Janumet',           'Sitagliptine+Metformine',        'comprimé',     '50/1000mg','antidiab',    FALSE),
    ('Lantus',            'Insuline glargine',              'stylo',        '100UI/ml', 'insuline',    FALSE),
    ('NovoRapid',         'Insuline asparte',               'stylo',        '100UI/ml', 'insuline',    FALSE),

    -- ── Anxiolytiques / hypnotiques / antidépresseurs ───────────────────
    ('Lexomil',           'Bromazépam',                     'comprimé',     '6mg',      'benzo',       FALSE),
    ('Xanax',             'Alprazolam',                     'comprimé',     '0,25mg',   'benzo',       FALSE),
    ('Xanax',             'Alprazolam',                     'comprimé',     '0,5mg',    'benzo',       FALSE),
    ('Tranxène',          'Clorazépate',                    'gélule',       '5mg',      'benzo',       FALSE),
    ('Lysanxia',          'Prazépam',                       'comprimé',     '10mg',     'benzo',       FALSE),
    ('Stilnox',           'Zolpidem',                       'comprimé',     '10mg',     'hypnotique',  FALSE),
    ('Imovane',           'Zopiclone',                      'comprimé',     '7,5mg',    'hypnotique',  FALSE),
    ('Deroxat',           'Paroxétine',                     'comprimé',     '20mg',     'isrs',        FALSE),
    ('Prozac',            'Fluoxétine',                     'gélule',       '20mg',     'isrs',        FALSE),
    ('Zoloft',            'Sertraline',                     'comprimé',     '50mg',     'isrs',        FALSE),
    ('Seroplex',          'Escitalopram',                   'comprimé',     '10mg',     'isrs',        FALSE),
    ('Effexor',           'Venlafaxine',                    'gélule LP',    '75mg',     'irsna',       FALSE),

    -- ── Corticoïdes ──────────────────────────────────────────────────────
    ('Solupred',          'Prednisolone',                   'comprimé',     '20mg',     'corticoide',  TRUE),
    ('Solupred',          'Prednisolone',                   'comprimé',     '5mg',      'corticoide',  FALSE),
    ('Cortancyl',         'Prednisone',                     'comprimé',     '20mg',     'corticoide',  FALSE),
    ('Médrol',            'Méthylprednisolone',             'comprimé',     '16mg',     'corticoide',  FALSE),
    ('Célestène',         'Bétaméthasone',                  'comprimé',     '0,5mg',    'corticoide',  FALSE),

    -- ── Vitamines et minéraux ────────────────────────────────────────────
    ('Tot’héma',          'Fer+Manganèse+Cuivre',           'ampoule',      '10ml',     'vitamine',    FALSE),
    ('Tardyferon',        'Sulfate ferreux',                'comprimé',     '80mg',     'vitamine',    FALSE),
    ('Speciafoldine',     'Acide folique',                  'comprimé',     '5mg',      'vitamine',    FALSE),
    ('Uvedose',           'Vitamine D3',                    'ampoule',      '100 000UI','vitamine',    TRUE),
    ('Magné B6',          'Magnésium+Vit B6',               'comprimé',     '—',        'vitamine',    FALSE),
    ('Calperos',          'Carbonate de calcium',           'comprimé',     '500mg',    'vitamine',    FALSE),

    -- ── Anti-fongiques ───────────────────────────────────────────────────
    ('Mycoster',          'Cyclopiroxolamine',              'crème',        '1%',       'antifong',    FALSE),
    ('Pevaryl',           'Éconazole',                      'crème',        '1%',       'antifong',    FALSE),
    ('Triflucan',         'Fluconazole',                    'gélule',       '150mg',    'antifong',    FALSE),
    ('Lamisil',           'Terbinafine',                    'comprimé',     '250mg',    'antifong',    FALSE),

    -- ── Anti-viraux ──────────────────────────────────────────────────────
    ('Zovirax',           'Aciclovir',                      'crème',        '5%',       'antiviral',   FALSE),
    ('Zovirax',           'Aciclovir',                      'comprimé',     '200mg',    'antiviral',   FALSE),

    -- ── Gynéco / contraception / ménopause ───────────────────────────────
    ('Microval',          'Lévonorgestrel',                 'comprimé',     '30µg',     'contracep',   FALSE),
    ('Norlevo',           'Lévonorgestrel',                 'comprimé',     '1,5mg',    'contracep',   FALSE),
    ('Diane 35',          'Cyprotérone+Ethinyl',            'comprimé',     '2/0,035mg','contracep',   FALSE),
    ('Duphaston',         'Dydrogestérone',                 'comprimé',     '10mg',     'progestatif', FALSE),

    -- ── Thyroïde ─────────────────────────────────────────────────────────
    ('Lévothyrox',        'Lévothyroxine',                  'comprimé',     '50µg',     'thyroide',    TRUE),
    ('Lévothyrox',        'Lévothyroxine',                  'comprimé',     '100µg',    'thyroide',    TRUE),
    ('Néo-mercazole',     'Carbimazole',                    'comprimé',     '5mg',      'thyroide',    FALSE),

    -- ── Anticoagulants ───────────────────────────────────────────────────
    ('Sintrom',           'Acénocoumarol',                  'comprimé',     '4mg',      'avk',         FALSE),
    ('Préviscan',         'Fluindione',                     'comprimé',     '20mg',     'avk',         FALSE),
    ('Lovenox',           'Énoxaparine',                    'injectable',   '4000UI',   'hbpm',        FALSE),
    ('Eliquis',           'Apixaban',                       'comprimé',     '5mg',      'aod',         FALSE),
    ('Xarelto',           'Rivaroxaban',                    'comprimé',     '20mg',     'aod',         FALSE),

    -- ── Ophtalmo / ORL ───────────────────────────────────────────────────
    ('Tobradex',          'Tobramycine+Dexaméthasone',      'collyre',      '5ml',      'collyre',     FALSE),
    ('Sterdex',           'Oxytétracycline+Dexa',           'pommade oph',  '—',        'collyre',     FALSE),
    ('Naphazoline',       'Naphazoline',                    'collyre',      '0,1%',     'collyre',     FALSE),
    ('Otipax',            'Phénazone+Lidocaïne',            'gouttes ORL',  '15ml',     'orl',         FALSE),

    -- ── Goutte / urique ──────────────────────────────────────────────────
    ('Zyloric',           'Allopurinol',                    'comprimé',     '300mg',    'goutte',      FALSE),
    ('Colchicine',        'Colchicine',                     'comprimé',     '1mg',      'goutte',      FALSE)
) AS x(commercial, dci, form, dosage, tags, fav)
WHERE NOT EXISTS (
    SELECT 1 FROM catalog_medication m
    WHERE m.commercial_name = x.commercial
      AND m.dci             = x.dci
      AND m.form            = x.form
      AND m.dosage          = x.dosage
);
