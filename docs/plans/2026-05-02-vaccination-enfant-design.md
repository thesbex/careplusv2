# Module Vaccination enfant — Design

**Date** : 2026-05-02
**Statut** : design validé, prêt à implémentation
**Origine** : demande terrain (intégrer un module Vaccination enfant + un module Suivi de grossesse). Ce document couvre la **vaccination enfant uniquement** ; la grossesse fera l'objet d'un design séparé après livraison + retour pilote de ce module (décision Q2).

## Contexte projet

- careplus = SICM mono-cabinet pour médecin généraliste marocain.
- Items déjà présents au backlog (`docs/BACKLOG.md`) : `Clinical > Vaccination schedule + reminders` (ligne 300) et `Pregnancy vertical` (lignes 337-342).
- ADRs en vigueur pertinents : ADR-013 (vitals élargi à SECRETAIRE/ASSISTANT — référence pour discuter RBAC), ADR-018 (régression frontend aux frontières J-day), ADR-019 (auth tokens), ADR-020 (packaging mono-process), ADR-021 (parallel-sync delivery).

## Recherche marché — synthèse

### Maroc (Programme National d'Immunisation, ex-PEV depuis 1981)

Calendrier officiel rappel (sources : sante.gov.ma, guide marocain de vaccinologie, Académie nationale de médecine FR) :

| Âge | Vaccins |
|---|---|
| Naissance | BCG + HepB1 |
| 2 mois | Pentavalent/Hexavalent (DTCaP-Hib-HepB) D1 + VPO/VPI + Pneumo + Rotavirus |
| 4 mois | idem D2 |
| 12 mois | ROR1 + HepB3 + Pneumo rappel |
| 18 mois | DTCP rappel 1 |
| 5 ans | ROR2 + DTP rappel 2 |
| 11 ans (filles, depuis 2022) | HPV |

Spécificités marché Maroc :
- Pas de registre national électronique en 2026 → carnet de santé papier reste l'original légal.
- Vaccins gratuits en public, payants en privé.
- Campagnes rattrapage ponctuelles (la dernière oct 2024 → jan 2025 pour rougeole) → le calendrier *bouge* en pratique.

### EMR pédia internationaux (CharmHealth, CureMD, DocVilla, Eka, MicroMD)

Features standard observées :
- Tracking par CVX code, fabricant, n° lot, dose, voie, site, date.
- Calendrier visuel : à jour / en retard / à venir.
- Reminders auto J-7 / J / overdue.
- Catch-up logic après dose ratée.
- Soumission registre d'État (non applicable Maroc).
- Carnet PDF exportable.

## Décisions de design (issues du brainstorming Q1-Q8)

| # | Question | Décision | Rationale |
|---|---|---|---|
| Q1 | Profondeur clinique | **C — hybride** : MVP GP-friendly maintenant, riche v2 selon retour pilote | Public primaire = GP marocain, pas pédiatre/gynéco. La profondeur B se construit au-dessus de A sans casser le schéma. |
| Q2 | Couplage Vaccination/Grossesse | **A — séquentiel** : Vaccination d'abord, Grossesse ensuite | Volume d'usage Vaccination > Grossesse, MVP plus simple, retour pilote avant 2e investissement. |
| Q3 | Source du calendrier | **B — PNI seedé + éditable Paramétrage** | Le calendrier *bouge* (campagne rattrapage rougeole 2024) et les vaccins hors-PNI (Varicelle, HepA, Grippe, voyage) sont demandés en privé marocain. |
| Q4 | Saisie d'une dose | **B — vaccin + date + lot + voie + site + administrateur** | Le carnet papier marocain demande ces champs ; lot critique pour retraits fournisseur. Stock vaccin = sprint dédié post-pilote. |
| Q5 | Mécanisme de rappels | **B — tableau de bord cabinet** (avec porte ouverte vers C plus tard) | A insuffisant (passif), C dépend du module Notifications (pas encore livré). B se construit avec briques existantes ; event `VaccinationDueEvent` publié dès le MVP pour brancher SMS/email plus tard sans réécriture. |
| Q6 | CI / retards / dose hors calendrier | **B — report + motif** | A trop pauvre pour trier la worklist, C demande un design CI vaccinale dédié (temporaire vs permanente, dose-spécifique vs famille-spécifique) hors-scope MVP. Note libre du dossier couvre les rares CI permanentes en attendant v2. |
| Q7 | Carnet PDF | **A — tabulaire simple** | Le carnet papier reste l'original légal ; careplus produit un récapitulatif. B (mimétique) demande un design dédié sans gabarit officiel publié. C (courrier transition) redondant avec futur courrier de liaison générique. |
| Q8 | RBAC | **C — MEDECIN/ASSISTANT/ADMIN saisissent, SECRETAIRE en lecture, MEDECIN/ADMIN éditent référentiel + reportent/annulent** | Réalité cabinet Maroc : l'infirmier (ASSISTANT) vaccine sous délégation. Plus restrictif que vitals (ADR-013) car acte avec CI possible. |

## Modèle de données

### Trois tables nouvelles

**`vaccine_catalog`** — référentiel des vaccins (éditable Paramétrage)
- `id` UUID PK
- `code` VARCHAR (`BCG`, `PENTA`, `ROR`, `HPV`, …)
- `name_fr` VARCHAR
- `manufacturer_default` VARCHAR (nullable)
- `route_default` ENUM(IM/SC/PO/ID)
- `is_pni` BOOLEAN (true = seedé Maroc, lecture seule sur DELETE)
- `active` BOOLEAN
- audit cols + `version`

Seedé via `R__seed_vaccine_catalog.sql` avec ~12 vaccins du PNI marocain (idempotent).

**`vaccine_schedule_dose`** — doses planifiées du calendrier (template global, éditable Paramétrage)
- `id` UUID PK
- `vaccine_id` FK → `vaccine_catalog`
- `dose_number` SMALLINT (1, 2, 3, R1, R2, …)
- `target_age_days` INT (0=naissance, 60=2 mois, 365=12 mois, …)
- `tolerance_days` INT (default 30, sert au calcul "en retard")
- `label_fr` VARCHAR
- audit cols
- UNIQUE(vaccine_id, dose_number)

Seedé : ~25 lignes pour le PNI marocain.

**`vaccination_dose`** — doses réellement administrées/planifiées par patient
- `id` UUID PK
- `patient_id` FK
- `schedule_dose_id` FK nullable (null = dose hors calendrier — rattrapage, hors-PNI)
- `vaccine_id` FK
- `dose_number` SMALLINT
- `status` ENUM(PLANNED, ADMINISTERED, DEFERRED, SKIPPED)
- `administered_at` TIMESTAMPTZ nullable
- `lot_number` VARCHAR nullable
- `route` ENUM nullable
- `site` VARCHAR nullable (deltoïde G/D, vaste latéral G/D, oral, ID)
- `administered_by` FK identity_user nullable
- `deferral_reason` VARCHAR nullable
- `notes` TEXT nullable
- audit cols + `version`
- index sur (patient_id, vaccine_id, dose_number)

### Colonne ajoutée à `patient_patient`

`vaccination_started_at` TIMESTAMPTZ nullable — date de la première dose saisie ; sert au matérialisateur de calendrier.

### Stratégie clé : matérialisation à la volée

Les rows en statut `PLANNED` ne sont **pas** matérialisées en base au create patient. Le calendrier est calculé à la volée à partir de `vaccine_schedule_dose × patient.birth_date − rows vaccination_dose existantes`. Cela évite des milliers de rows fantômes pour les patients adultes qui n'auront jamais de calendrier pédiatrique.

## API REST

Module Spring : `ma.careplus.vaccination` (`domain` / `application` / `infrastructure.web` / `infrastructure.persistence`).

### Endpoints patient — `/api/patients/{patientId}/vaccinations`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/patients/{id}/vaccinations` | tous | Calendrier matérialisé : doses ADMINISTERED + DEFERRED + SKIPPED depuis BDD ∪ doses PLANNED calculées à la volée. Tri `targetDate`. |
| POST | `/api/patients/{id}/vaccinations` | MEDECIN/ASSISTANT/ADMIN | Saisir une dose ADMINISTERED. Si `scheduleDoseId` fourni → liée au planning ; sinon dose libre. |
| PUT | `/api/patients/{id}/vaccinations/{doseId}` | MEDECIN/ADMIN | Modifier une dose saisie. Optimistic locking via `version`. |
| POST | `/api/patients/{id}/vaccinations/{doseId}/defer` | MEDECIN/ASSISTANT/ADMIN | PLANNED → DEFERRED avec `reason`. Crée la row si elle n'existait qu'à la volée. |
| POST | `/api/patients/{id}/vaccinations/{doseId}/skip` | MEDECIN/ADMIN | DEFERRED/PLANNED → SKIPPED. |
| DELETE | `/api/patients/{id}/vaccinations/{doseId}` | MEDECIN/ADMIN | Soft-delete. |
| GET | `/api/patients/{id}/vaccinations/booklet` | tous | PDF carnet (réutilise pattern `PrescriptionPdfService` + nouveau template `vaccination-booklet.html`). |

### Endpoints worklist — `/api/vaccinations/queue`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/vaccinations/queue?status=OVERDUE\|DUE_SOON\|UPCOMING&from=&to=&vaccineCode=` | MEDECIN/ASSISTANT/ADMIN/SECRETAIRE | Liste agrégée des doses dues calculée à la volée sur l'ensemble des patients pédiatriques (DDN < 18 ans). Pagination. Tri urgence DESC. |

### Endpoints référentiel — `/api/vaccinations/catalog` + `/schedule`

| Verbe | Path | Rôle |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/vaccinations/catalog` (vaccins) | GET tous, mutations MEDECIN/ADMIN |
| GET/POST/PUT/DELETE | `/api/vaccinations/schedule` (doses planifiées) | GET tous, mutations MEDECIN/ADMIN |

### Événement

`VaccinationDueEvent(patientId, doseId, dueAt)` publié par un job calendrier (cron J-7 sur tous les patients pédiatriques). Pas consommé en MVP — listener vide en place pour brancher Notifications plus tard sans réécriture.

## Frontend — slice `features/vaccination/`

### 1. Onglet "Vaccination" dans `DossierPage` (desktop + mobile)

Nouvel onglet entre "Prescriptions" et "Factures".

- **Calendrier visuel** : timeline verticale par âge (Naissance → 5 ans → 11 ans).
- Code couleur : vert = ADMINISTERED, ambre = DUE_SOON (dans tolérance), rouge = OVERDUE, gris = UPCOMING (future), barré = SKIPPED, hachuré = DEFERRED avec raison en tooltip.
- Clic carte → drawer `RecordDoseDrawer` (form vaccine pré-rempli + date + lot + voie + site + administrateur + notes).
- Boutons "Reporter" / "Marquer non administrée" / "Modifier" selon RBAC.
- Header : bouton **"Imprimer carnet"** → `GET /booklet` blob → `window.open(URL.createObjectURL)` (pattern `CertificatDialog`).

### 2. Page `/vaccinations` — worklist transversale

- Route `RequireRole={['MEDECIN','ASSISTANT','ADMIN','SECRETAIRE']}`.
- 3 onglets : "En retard" (rouge, badge count), "Dues cette semaine", "Dues ce mois".
- Tableau : avatar | nom enfant | âge | vaccin | dose | date prévue | jours de retard | bouton "Saisir dose" (drawer pré-rempli).
- Filtres toolbar : praticien, vaccin, tranche d'âge.
- Item "Vaccinations" ajouté au Sidebar avec badge count rouge si overdue > 0 (refresh polling 30s, alignée sur SalleAttente).

### 3. Onglet "Vaccinations" dans `ParametragePage`

Nouvel onglet à côté de "Tarifs" / "Droits d'accès".
- Section 1 : référentiel vaccins (table éditable — code, nom, fabricant défaut, voie défaut, flag PNI lecture seule pour les seedés).
- Section 2 : calendrier (table éditable — vaccin, n° dose, âge cible jours, tolérance jours, libellé).

### Hooks

- `useVaccinationCalendar(patientId)`
- `useRecordDose`
- `useDeferDose`
- `useSkipDose`
- `useVaccinationQueue(filters)`
- `useVaccinationCatalog`
- `useVaccinationSchedule`

### Mobile parity

- `DossierPage.mobile.tsx` reçoit le même onglet en bottom-sheet.
- `/vaccinations` mobile = liste cartes plein écran avec tap → drawer plein écran.

## Tests d'intégration — `VaccinationIT.java`

Pattern : Testcontainers Postgres + TestRestTemplate (aligné `BillingIT`/`CatalogIT`).

Scénarios obligatoires (tous verts avant merge) :

1. **Calendrier matérialisé sur enfant 0 mois** — créer patient DDN aujourd'hui → GET → 25 doses PLANNED, 0 row en `vaccination_dose`.
2. **Saisir dose ADMINISTERED** — POST BCG D1 lot=`ABC123` → 201, GET → BCG ADMINISTERED + 24 PLANNED.
3. **Lot obligatoire** — POST sans `lotNumber` → 400 PARAM_INVALID.
4. **Idempotence** — saisir 2× même (vaccine, dose_number) → 409.
5. **Reporter** — POST `/defer` reason="fièvre" → DEFERRED + reason persisté, hachuré dans le calendar.
6. **Skipper** — POST `/skip` MEDECIN → SKIPPED. ASSISTANT → 403.
7. **Dose hors calendrier** — POST sans `scheduleDoseId` (rattrapage rougeole T10) → row créée, marquée "supplémentaire".
8. **Worklist OVERDUE** — 3 enfants âges 3/8/14 mois sans dose → GET `/queue?status=OVERDUE` → 3 listés, plus en retard en tête.
9. **Tolérance** — enfant 65j, BCG attendu J0 tolérance 30j → OVERDUE. Enfant 25j → DUE_SOON.
10. **RBAC matrix** — POST SECRETAIRE 403 ; PUT ASSISTANT 403 ; DELETE ASSISTANT 403.
11. **Edit référentiel** — POST `/catalog` MEDECIN 201, ASSISTANT 403, SECRETAIRE 403.
12. **PNI lecture seule** — DELETE vaccin `is_pni=true` → 422.
13. **PDF carnet** — GET `/booklet` → bytes non vides, magic `%PDF`, contient nom patient + ≥1 ligne par dose ADMINISTERED.
14. **Soft-delete** — DELETE → row marked deleted_at, calendar n'affiche plus, dose redevient PLANNED dans le calcul.
15. **Patient adulte** — DDN 1980 → calendar = 0 doses (HPV non-pertinente >25 ans, le reste hors tolérance).

### Manual QA après merge (agent `manual-qa`)

- Walk desktop : nouveau bébé → onglet Vaccination → saisir BCG → carte verte + lot persisté → imprimer carnet PDF.
- Walk mobile 390px : même scénario en bottom-sheet.
- Walk worklist : `/vaccinations` filtré OVERDUE → "Saisir dose" depuis queue → drawer pré-rempli.
- Walk Paramétrage : ajouter Méningo ACWY → vérifier qu'il apparaît dans le drawer.

## Plan d'implémentation séquentiel

1 commit feature + 1 commit IT par étape (`feedback_ship_order.md`).

### Étape 1 — Backend schéma + référentiel (~1.5 j)
- `V015__vaccination_module.sql` : 3 tables + colonne patient + indexes + triggers.
- `R__seed_vaccine_catalog.sql` : seed PNI Maroc idempotent.
- Domain : entités + enums.
- Repos + `VaccinationCatalogService` (CRUD).
- Endpoints `/catalog` + `/schedule` + RBAC.
- IT : seed appliqué + CRUD référentiel + RBAC.

### Étape 2 — Backend dossier patient (~1.5 j)
- `VaccinationService.materializeCalendar(patientId)`.
- `recordDose`, `deferDose`, `skipDose`, `updateDose`, `softDelete`.
- `PatientVaccinationController`.
- `VaccinationDueEvent` (publié, listener vide).
- IT : 15 scénarios.

### Étape 3 — Backend worklist + PDF (~1 j)
- `VaccinationQueryService.queue(filters)`.
- `/vaccinations/queue`.
- `vaccination-booklet.html` Thymeleaf + `VaccinationBookletPdfService`.
- IT : worklist + PDF magic bytes.

### Étape 4 — Frontend dossier patient (~1.5 j)
- Slice `features/vaccination/` : hooks + drawer + tab.
- `DossierPage` desktop + mobile.
- design-parity-auditor sur l'onglet.

### Étape 5 — Frontend worklist + Paramétrage (~1.5 j)
- Page `/vaccinations` + sidebar item + badge count.
- `VaccinationCatalogTab` + `VaccinationScheduleTab` dans `ParametragePage`.
- Tests Playwright pour les 4 walks.

### Étape 6 — Manual QA + commit final (~0.5 j)
- Agent `manual-qa` walk desktop + mobile.
- Mise à jour `docs/PROGRESS.md`, `docs/API.md`, `docs/DECISIONS.md` (nouvel ADR « Module vaccination — calendrier matérialisé à la volée »).
- Retrait des items du `BACKLOG.md` ligne 300.

**Total : ~7.5 jours.**

## Suivi de grossesse — note pour plus tard

Module séparé, à designer après livraison + retour pilote du module Vaccination (décision Q2 — séquentiel). Brique de recherche marché déjà capturée :
- 4 CPN minimum (protocole national Maroc), souvent étendu à 7-9 en privé.
- 3 échographies obligatoires (datation T1 7-8 SA, morpho T2 20-24 SA, croissance T3 32 SA).
- Bilans T1 (GS, sérologies toxo/rubéole/HepB/HIV/syphilis), HGPO 24-28 SA, NFS + strepto B T3.
- Dépistage T21 T1, vaccination DTCaP enceinte, surveillance TA/poids/HU/BCF, post-partum 6-8 semaines.
- EMR OB-GYN intl (CureMD, MicroMD, astraia, Meditab) : DDR → DPA Naegele auto, SA auto, biométrie BPD/FL/AC/EFW, FMF risk, templates trimestre, PDF carnet, DICOM.

Item au backlog `Pregnancy vertical` (lignes 337-342) reste actif jusqu'au design dédié.
