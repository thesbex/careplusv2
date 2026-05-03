-- Reference data required in EVERY environment (dev, test, prod).
-- Unlike R__seed_dev.sql, this is production data (roles, holidays, default templates).

-- -----------------------------------------------------------------------------
-- identity_role — the 4 roles of the system
-- -----------------------------------------------------------------------------
INSERT INTO identity_role (id, code, label_fr) VALUES
    ('00000000-0000-0000-0000-000000000001', 'SECRETAIRE',  'Secrétaire'),
    ('00000000-0000-0000-0000-000000000002', 'ASSISTANT',   'Assistant(e) médical(e)'),
    ('00000000-0000-0000-0000-000000000003', 'MEDECIN',     'Médecin'),
    ('00000000-0000-0000-0000-000000000004', 'ADMIN',       'Administrateur');

-- -----------------------------------------------------------------------------
-- scheduling_holiday — Morocco public holidays 2026
-- -----------------------------------------------------------------------------
INSERT INTO scheduling_holiday (id, date, label) VALUES
    (gen_random_uuid(), '2026-01-01', 'Nouvel an'),
    (gen_random_uuid(), '2026-01-11', 'Manifeste de l''indépendance'),
    (gen_random_uuid(), '2026-01-14', 'Amazigh New Year'),
    (gen_random_uuid(), '2026-03-20', 'Aïd El Fitr (date approximative)'),
    (gen_random_uuid(), '2026-03-21', 'Aïd El Fitr (date approximative)'),
    (gen_random_uuid(), '2026-05-01', 'Fête du travail'),
    (gen_random_uuid(), '2026-05-27', 'Aïd El Adha (date approximative)'),
    (gen_random_uuid(), '2026-05-28', 'Aïd El Adha (date approximative)'),
    (gen_random_uuid(), '2026-06-16', 'Nouvel an Hégire (date approximative)'),
    (gen_random_uuid(), '2026-07-30', 'Fête du Trône'),
    (gen_random_uuid(), '2026-08-14', 'Allégeance Oued Eddahab'),
    (gen_random_uuid(), '2026-08-20', 'Révolution du Roi et du Peuple'),
    (gen_random_uuid(), '2026-08-21', 'Fête de la Jeunesse'),
    (gen_random_uuid(), '2026-08-25', 'Aïd Al Mawlid (date approximative)'),
    (gen_random_uuid(), '2026-11-06', 'Marche Verte'),
    (gen_random_uuid(), '2026-11-18', 'Fête de l''Indépendance');

-- -----------------------------------------------------------------------------
-- catalog_insurance — Moroccan insurances
-- -----------------------------------------------------------------------------
INSERT INTO catalog_insurance (id, code, name, kind) VALUES
    (gen_random_uuid(), 'AMO_CNSS',   'AMO CNSS (salariés du privé)', 'AMO'),
    (gen_random_uuid(), 'AMO_CNOPS',  'AMO CNOPS (fonctionnaires)',   'AMO'),
    (gen_random_uuid(), 'RMA',        'RMA',                           'MUTUELLE'),
    (gen_random_uuid(), 'SAHAM',      'Saham Assurance (Sanlam)',      'MUTUELLE'),
    (gen_random_uuid(), 'WAFA',       'Wafa Assurance',                'MUTUELLE'),
    (gen_random_uuid(), 'ATLANTA',    'AtlantaSanad Assurance',        'MUTUELLE'),
    (gen_random_uuid(), 'MCMA',       'MCMA',                          'MUTUELLE'),
    (gen_random_uuid(), 'AXA',        'AXA Assurance Maroc',           'MUTUELLE'),
    (gen_random_uuid(), 'AUTRE',      'Autre assurance',               'PRIVEE'),
    (gen_random_uuid(), 'SANS',       'Sans assurance (payant)',       'PRIVEE');

-- -----------------------------------------------------------------------------
-- catalog_act — base acts with default tariffs (paramétrable later)
-- -----------------------------------------------------------------------------
INSERT INTO catalog_act (id, code, name, default_price, vat_rate) VALUES
    (gen_random_uuid(), 'CONS_GEN',       'Consultation généraliste',       200.00, 0),
    (gen_random_uuid(), 'CONS_SUIVI',     'Consultation de suivi',          150.00, 0),
    (gen_random_uuid(), 'CONS_URG',       'Consultation urgence',           300.00, 0),
    (gen_random_uuid(), 'CERT_MED',       'Certificat médical',             100.00, 0),
    (gen_random_uuid(), 'CERT_APT',       'Certificat d''aptitude',         150.00, 0),
    (gen_random_uuid(), 'VISITE_DOM',     'Visite à domicile',              350.00, 0),
    (gen_random_uuid(), 'INJECTION',      'Injection / pansement',           50.00, 0),
    (gen_random_uuid(), 'ECG',            'Électrocardiogramme',            200.00, 0),
    (gen_random_uuid(), 'FROTTIS',        'Frottis cervico-vaginal',        200.00, 0);

-- -----------------------------------------------------------------------------
-- scheduling_appointment_reason — default reasons (link to acts later if needed)
-- -----------------------------------------------------------------------------
INSERT INTO scheduling_appointment_reason (id, code, label, duration_minutes, color_hex) VALUES
    (gen_random_uuid(), 'PREMIERE',   'Première consultation',  30, '#4CAF50'),
    (gen_random_uuid(), 'SUIVI',      'Consultation de suivi',  15, '#2196F3'),
    (gen_random_uuid(), 'CERTIFICAT', 'Certificat médical',      5, '#FF9800'),
    (gen_random_uuid(), 'VACCIN',     'Vaccination',            10, '#9C27B0'),
    (gen_random_uuid(), 'URGENCE',    'Urgence',                20, '#F44336'),
    (gen_random_uuid(), 'CONTROLE',   'Contrôle',               15, '#00BCD4');

-- -----------------------------------------------------------------------------
-- scheduling_working_hours — default Mon-Sat 9-13 / 15-19
-- -----------------------------------------------------------------------------
INSERT INTO scheduling_working_hours (id, day_of_week, start_time, end_time) VALUES
    (gen_random_uuid(), 1, '09:00', '13:00'), (gen_random_uuid(), 1, '15:00', '19:00'),
    (gen_random_uuid(), 2, '09:00', '13:00'), (gen_random_uuid(), 2, '15:00', '19:00'),
    (gen_random_uuid(), 3, '09:00', '13:00'), (gen_random_uuid(), 3, '15:00', '19:00'),
    (gen_random_uuid(), 4, '09:00', '13:00'), (gen_random_uuid(), 4, '15:00', '19:00'),
    (gen_random_uuid(), 5, '09:00', '13:00'), (gen_random_uuid(), 5, '15:00', '19:00'),
    (gen_random_uuid(), 6, '09:00', '13:00');

-- -----------------------------------------------------------------------------
-- configuration_document_template — minimal defaults (user customizes in admin)
-- -----------------------------------------------------------------------------
INSERT INTO configuration_document_template (id, type, html_template, page_format, variables_json) VALUES
    (
      gen_random_uuid(),
      'ORDONNANCE',
      '<html><head><meta charset="UTF-8"/><style>body{font-family:sans-serif;font-size:12pt}</style></head>'
      '<body><div class="header"><h2>[[${cabinet.name}]]</h2><p>[[${cabinet.address}]] — [[${cabinet.city}]]<br/>'
      'Tél: [[${cabinet.phone}]] &nbsp; INPE: [[${cabinet.inpe}]]</p></div>'
      '<h3>ORDONNANCE</h3><p>Date: [[${prescription.issuedAt}]]</p>'
      '<p>Patient: [[${patient.fullName}]] — Âge: [[${patient.age}]] ans</p>'
      '<div th:each="line : ${lines}"><p>[[${line.display}]]</p></div>'
      '<div class="footer" style="margin-top:60px;text-align:right">Dr. [[${practitioner.fullName}]]</div></body></html>',
      'A4',
      '{"cabinet":["name","address","city","phone","inpe"],"prescription":["issuedAt"],"patient":["fullName","age"],"practitioner":["fullName"],"lines":["display"]}'::jsonb
    ),
    (
      gen_random_uuid(),
      'CERTIFICAT',
      '<html><head><meta charset="UTF-8"/></head><body>'
      '<h2>[[${cabinet.name}]]</h2><h3>CERTIFICAT MÉDICAL</h3>'
      '<p>Je soussigné Dr. [[${practitioner.fullName}]] certifie avoir examiné ce jour [[${issuedAt}]], '
      'M./Mme [[${patient.fullName}]], né(e) le [[${patient.birthDate}]].</p>'
      '<p th:utext="${body}"></p><p style="margin-top:60px;text-align:right">Dr. [[${practitioner.fullName}]]</p>'
      '</body></html>',
      'A4',
      '{"cabinet":["name"],"practitioner":["fullName"],"patient":["fullName","birthDate"],"issuedAt":[],"body":[]}'::jsonb
    ),
    (
      gen_random_uuid(),
      'BON_ANALYSE',
      '<html><body><h2>[[${cabinet.name}]]</h2><h3>BON D''ANALYSES BIOLOGIQUES</h3>'
      '<p>Patient: [[${patient.fullName}]] — Date: [[${issuedAt}]]</p>'
      '<ul><li th:each="t : ${tests}">[[${t.name}]]</li></ul>'
      '<p style="margin-top:40px;text-align:right">Dr. [[${practitioner.fullName}]]</p></body></html>',
      'A4',
      '{"cabinet":["name"],"practitioner":["fullName"],"patient":["fullName"],"issuedAt":[],"tests":["name"]}'::jsonb
    ),
    (
      gen_random_uuid(),
      'BON_RADIO',
      '<html><body><h2>[[${cabinet.name}]]</h2><h3>BON D''IMAGERIE MÉDICALE</h3>'
      '<p>Patient: [[${patient.fullName}]] — Date: [[${issuedAt}]]</p>'
      '<ul><li th:each="e : ${exams}">[[${e.name}]]</li></ul>'
      '<p style="margin-top:40px;text-align:right">Dr. [[${practitioner.fullName}]]</p></body></html>',
      'A4',
      '{"cabinet":["name"],"practitioner":["fullName"],"patient":["fullName"],"issuedAt":[],"exams":["name"]}'::jsonb
    ),
    (
      gen_random_uuid(),
      'FACTURE',
      '<html><body><h2>[[${cabinet.name}]]</h2><p>ICE: [[${cabinet.ice}]] — INPE: [[${cabinet.inpe}]]</p>'
      '<h3>FACTURE N° [[${invoice.number}]]</h3>'
      '<p>Date: [[${invoice.issuedAt}]]<br/>Patient: [[${patient.fullName}]]</p>'
      '<table><thead><tr><th>Acte</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>'
      '<tbody><tr th:each="l : ${lines}"><td>[[${l.description}]]</td><td>[[${l.quantity}]]</td>'
      '<td>[[${l.unitPrice}]]</td><td>[[${l.lineTotal}]]</td></tr></tbody></table>'
      '<p style="text-align:right;font-weight:bold">Total: [[${invoice.total}]] MAD</p></body></html>',
      'A4',
      '{"cabinet":["name","ice","inpe"],"invoice":["number","issuedAt","total"],"patient":["fullName"],"lines":["description","quantity","unitPrice","lineTotal"]}'::jsonb
    );

-- -----------------------------------------------------------------------------
-- configuration_clinic_settings — one-row placeholder (overridden by onboarding)
-- -----------------------------------------------------------------------------
INSERT INTO configuration_clinic_settings (id, name, address, city, phone) VALUES
    (gen_random_uuid(), 'Cabinet (à configurer)', 'Adresse à définir', 'Casablanca', '+212 5 22 00 00 00');

-- -----------------------------------------------------------------------------
-- billing_invoice_sequence — initialize counter for current year
-- -----------------------------------------------------------------------------
INSERT INTO billing_invoice_sequence (year, next_value)
VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::INT, 1);
