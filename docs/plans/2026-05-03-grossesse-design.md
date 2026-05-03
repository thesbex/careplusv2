# Module Grossesse / Suivi prénatal — Design

**Date** : 2026-05-03
**Statut** : design validé, prêt à implémentation
**Origine** : demande terrain (BACKLOG `Pregnancy vertical`, brainstorming Q1-Q8 figé via décisions ci-dessous le 2026-05-03).

## Contexte projet

- careplus = SICM mono-cabinet pour médecin généraliste marocain.
- Module #3 de la wave QA7 (après Vaccination V022 livré 2026-05-03 et Stock V024-V025).
- ADRs en vigueur : ADR-013 (RBAC modulaire), ADR-018 (régression frontend J-day), ADR-021 (parallel-sync), ADR-026/028 (matérialisation à la volée + PageView), ADR-029 (Vaccination — table dédiée, badge dossier en jointure).
- Prochaine migration libre : **V026**.

## Recherche marché — synthèse

### OMS — recommandations CPN 2016 (référence retenue)
- **8 visites prénatales** minimum pour grossesse normale (ancien standard 4 visites OMS 2002 abandonné — augmente la mortalité maternelle/fœtale).
- Calendrier-cible : SA 12, SA 20, SA 26, SA 30, SA 34, SA 36, SA 38, SA 40.
- Biométrie systématique chaque visite : poids, TA, BU, HU à partir de SA 20, BCF à partir de SA 12, MAF à partir de SA 24.
- 3 échographies recommandées : datation/clarté nucale (11-13 SA+6), morpho (20-22 SA), croissance (32 SA).

### Maroc — Ministère de la Santé (programme PSGA)
- Programme de Surveillance de la Grossesse et de l'Accouchement aligné OMS.
- Sérologies obligatoires T1 : groupage ABO+Rh + RAI + sérologie syphilis (TPHA-VDRL) + sérologie HIV (consentement) + sérologie rubéole + sérologie toxoplasmose + AgHBs + glycémie à jeun + BU + ECBU si BU+.
- Bilan T2 : NFS, sérologie toxoplasmose (si négative T1), HGPO 75 g entre SA 24-28.
- Bilan T3 : NFS, RAI (si Rh-), prélèvement vaginal strepto B SA 35-37, sérologies à recontrôler si négatives.
- Vaccination antitétanique mère : dTcaP recommandé chaque grossesse (cohérence avec module Vaccination V022).

### EMR obstétricaux internationaux (Athena, eClinicalWorks, Epic OB)
- Tous séparent dossier obstétrical du dossier médical général (table dédiée).
- Calcul DPA = règle de Naegele (DDR + 280 j) avec correction par écho T1 si écart > 7 j.
- Tracking gravidité (G), parité (P), avortements (A), enfants vivants (V) format `G_P_A_V`.
- Score de risque obstétrical = scope C, hors MVP.

## Décisions de design (issues du brainstorming Q1-Q8)

| # | Question | Décision | Rationale |
|---|---|---|---|
| Q1 | Profondeur fonctionnelle | **B Standard** : DDR/DPA + plan visites OMS auto + biométrie obstétricale + 3 échos + bio panel par trimestre + alertes basiques + clôture avec lien Vaccination | A trop minimaliste pour un module dédié ; C nécessite cabinet pilote gyneco-obstétrique réel pour valider les courbes percentiles et scores de risque. |
| Q2 | Modèle patient | **Table `pregnancy` 1-N par patiente, sans champ sur `patient_patient`** | Préserve historique G/P. Badge "Grossesse en cours · X SA" calculé en jointure. Le calcul gravidité/parité (G3P2) se fait par agrégation. |
| Q3 | Grossesses multiples (jumeaux) | **Hors MVP** : 1 ligne `pregnancy` = 1 grossesse, JSON `fetuses` minimal `[{label}]` avec 1 fœtus par défaut | Vrai support multi-fœtus (biométrie séparée par fœtus, alertes différentielles) = scope C. À écrire en post-pilote si signal. |
| Q4 | RBAC | **MEDECIN** déclare/clôture/biométrie obstétricale (TV, frottis) · **ASSISTANT** saisit constantes obstétricales (poids, TA, BU, HU, BCF, MAF) · **SECRETAIRE** crée RDV `SUIVI_GROSSESSE` · lecture pour tous | Aligné Vaccination où ASSISTANT enregistre la dose mais MEDECIN seul prescrit. |
| Q5 | Normes de référence | **OMS 2016 + adaptations Min Santé Maroc PSGA** | OMS = standard international, PSGA = légalement applicable au Maroc. HAS française non applicable. ADR-031 à écrire. |
| Q6 | Plan de visites auto-généré | **Auto-créé à la déclaration, modifiable** | 8 lignes `pregnancy_visit_plan` générées (SA 12, 20, 26, 30, 34, 36, 38, 40). Le médecin peut décaler/supprimer/ajouter. RDV `SUIVI_GROSSESSE` se relie automatiquement à la visite planifiée la plus proche dans la fenêtre de tolérance. |
| Q7 | Alertes seuils | **Hardcodés v1** : HTA gravidique (TA ≥ 140/90), GAJ ≥ 0,92 g/L, glycémie post-charge HGPO ≥ 1,53 g/L à 1 h, terme dépassé (≥ 41 SA), pas de visite depuis > 6 sem en T3, BCF absent à partir de SA 12, BU positive (sucre/protéines/leuco) | Paramétrabilité = scope creep MVP. Seuils OMS stables. v2 onglet Paramétrage Grossesse si signal terrain. |
| Q8 | Bio panel par trimestre | **Bouton "Prescrire bilan T1/T2/T3"** dans la fiche grossesse → ouvre `PrescriptionDrawer` pré-rempli depuis modèles (QA6-2) | Pas d'auto-création silencieuse (médecin ajuste selon contexte — sérologies déjà connues, allergies, etc.). Réutilise modèles d'ordonnance déjà livrés. |

### Décisions latérales

- **Clôture → fiche enfant Vaccination** : bouton manuel "Créer la fiche enfant" sur grossesse `TERMINEE` avec `outcome = ACCOUCHEMENT_VIVANT`. Pré-remplit nom de famille mère, sexe à choisir, DDN = `ended_at`. Lance la création via le module Vaccination (V022) qui auto-génère le calendrier PNI marocain.
- **Carnet maternité PDF** : **hors MVP**. Export PDF générique du dossier obstétrical suffit. Vrai carnet imprimable bilingue = post-pilote.
- **Articulation visite ↔ consultation** : une visite de grossesse = un type `AppointmentType.SUIVI_GROSSESSE` (ajouter à l'enum). Quand on démarre la consultation depuis ce RDV, l'onglet Grossesse de la consultation est pré-actif et propose la saisie biométrique.
- **Patient mâle** : guard service `422 PATIENT_NOT_FEMALE` à la création de grossesse (vérification `patient.sex = 'F'`).
- **Migration** : `V026__pregnancy_module.sql`.

## Modèle de données

### Quatre tables nouvelles

**`pregnancy`** — une grossesse par patiente (1-N, historique préservé)
- `id` UUID PK
- `patient_id` UUID NOT NULL REFERENCES patient_patient(id)
- `started_at` DATE NOT NULL — date de déclaration (≠ DDR ; le médecin peut déclarer à SA 14)
- `lmp_date` DATE NOT NULL — Last Menstrual Period (DDR)
- `due_date` DATE NOT NULL — DPA calculée auto (Naegele : `lmp_date + 280 days`), ajustable si écho T1 corrige
- `due_date_source` ENUM(`NAEGELE`, `ECHO_T1`) DEFAULT 'NAEGELE'
- `status` ENUM(`EN_COURS`, `TERMINEE`, `INTERROMPUE`) DEFAULT 'EN_COURS'
- `ended_at` DATE NULL — date de fin (accouchement, FCS, IVG, MFIU)
- `outcome` ENUM(`ACCOUCHEMENT_VIVANT`, `MORT_NEE`, `MFIU`, `FCS`, `IVG`, `GEU`, `MOLE`) NULL
- `child_patient_id` UUID NULL REFERENCES patient_patient(id) — lien vers fiche enfant créée
- `fetuses` JSONB DEFAULT `'[{"label":"Fœtus unique"}]'`
- `notes` TEXT
- `version` BIGINT DEFAULT 0
- audit cols (`created_at`, `updated_at`, `created_by`, `updated_by`)
- INDEX (patient_id, status) — récupération grossesse en cours
- CHECK (`ended_at IS NULL OR ended_at >= started_at`)
- CHECK (`status != 'EN_COURS' OR (ended_at IS NULL AND outcome IS NULL)`)

**`pregnancy_visit_plan`** — calendrier de visites planifiées (auto-généré + modifiable)
- `id` UUID PK
- `pregnancy_id` UUID NOT NULL REFERENCES pregnancy(id) ON DELETE CASCADE
- `target_sa_weeks` SMALLINT NOT NULL — SA cible (12, 20, 26, 30, 34, 36, 38, 40)
- `target_date` DATE NOT NULL — `lmp_date + (target_sa_weeks * 7)`
- `tolerance_days` INT NOT NULL DEFAULT 14
- `status` ENUM(`PLANIFIEE`, `HONOREE`, `MANQUEE`, `ANNULEE`) DEFAULT 'PLANIFIEE'
- `appointment_id` UUID NULL REFERENCES scheduling_appointment(id) — lien quand un RDV est rattaché
- `consultation_id` UUID NULL REFERENCES clinical_consultation(id) — lien quand la visite est honorée
- audit cols + `version`
- UNIQUE (pregnancy_id, target_sa_weeks)
- INDEX (pregnancy_id, status)

**`pregnancy_visit`** — données obstétricales saisies à chaque visite (1-N par grossesse)
- `id` UUID PK
- `pregnancy_id` UUID NOT NULL REFERENCES pregnancy(id) ON DELETE CASCADE
- `visit_plan_id` UUID NULL REFERENCES pregnancy_visit_plan(id) — visite ad-hoc si null
- `consultation_id` UUID NULL REFERENCES clinical_consultation(id) — saisie attachée à une consultation
- `recorded_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `sa_weeks` SMALLINT NOT NULL — SA au moment de la visite (calculé : `(recorded_at - lmp_date) / 7`)
- `sa_days` SMALLINT NOT NULL — SA jours additionnels
- `weight_kg` NUMERIC(5,2)
- `bp_systolic` SMALLINT
- `bp_diastolic` SMALLINT
- `urine_dip` JSONB — `{glucose, protein, leuco, nitrites, ketones, blood}` chaque champ booléen
- `fundal_height_cm` NUMERIC(4,1) — HU
- `fetal_heart_rate_bpm` SMALLINT — BCF
- `fetal_movements_perceived` BOOLEAN
- `presentation` ENUM(`CEPHALIQUE`, `SIEGE`, `TRANSVERSE`, `INDETERMINEE`) NULL — à partir de SA 32
- `notes` TEXT
- `recorded_by` UUID NOT NULL REFERENCES identity_user(id)
- audit cols + `version`
- INDEX (pregnancy_id, recorded_at DESC)

**`pregnancy_ultrasound`** — 3 échos obstétricales par grossesse
- `id` UUID PK
- `pregnancy_id` UUID NOT NULL REFERENCES pregnancy(id) ON DELETE CASCADE
- `kind` ENUM(`T1_DATATION`, `T2_MORPHO`, `T3_CROISSANCE`, `AUTRE`) NOT NULL
- `performed_at` DATE NOT NULL
- `sa_weeks_at_exam` SMALLINT NOT NULL
- `sa_days_at_exam` SMALLINT NOT NULL
- `findings` TEXT — résumé textuel (compte-rendu complet en pièce jointe)
- `document_id` UUID NULL REFERENCES patient_document(id) — PDF compte-rendu (réutilise V009)
- `biometry` JSONB — `{bip, pc, dat, lf, eg, percentile}` selon le kind
- `corrects_due_date` BOOLEAN DEFAULT FALSE — si T1 corrige la DPA
- `recorded_by` UUID NOT NULL REFERENCES identity_user(id)
- audit cols + `version`
- INDEX (pregnancy_id, kind)

### Colonne ajoutée à `scheduling_appointment` (enum extension)

`AppointmentType` enum étendu avec `SUIVI_GROSSESSE` (en plus de CONSULTATION/CONTROLE/URGENCE/SUIVI_VACCINAL).

### Vues calculées (pas matérialisées — query)

- **SA courante** : `FLOOR((CURRENT_DATE - lmp_date) / 7)` — calculée à la volée pour chaque grossesse `EN_COURS`.
- **G/P (gravidité/parité)** : `(COUNT(*), COUNT(* WHERE outcome IN ('ACCOUCHEMENT_VIVANT','MORT_NEE')))` agrégé sur `pregnancy WHERE patient_id = ?`.
- **Alertes actives** : query par grossesse joignant `pregnancy_visit` (dernier) + seuils hardcodés. Pas de table `pregnancy_alert` — recalcul à la volée pour éviter la dérive (cohérent ADR-026 stock).

### Stratégie clé : auto-génération du plan de visites à la déclaration

À la création d'une `pregnancy` :
1. Calculer `due_date = lmp_date + 280 j` (Naegele).
2. Insérer 8 lignes `pregnancy_visit_plan` avec `target_sa_weeks ∈ {12, 20, 26, 30, 34, 36, 38, 40}`, `target_date = lmp_date + (target_sa_weeks * 7)`, `tolerance_days = 14`.
3. Si `lmp_date` est dans le passé > 12 SA, les visites passées sont créées avec `status = 'MANQUEE'` (tracking de ce qui a été raté).
4. Quand un `scheduling_appointment` de type `SUIVI_GROSSESSE` est créé pour cette patiente, le service cherche la `pregnancy_visit_plan EN_COURS` la plus proche (dans la fenêtre de tolérance) et la lie via `appointment_id`. Si aucune ne match → visite ad-hoc.

## API REST

Module Spring : `ma.careplus.pregnancy` (`domain` / `application` / `infrastructure.web` / `infrastructure.persistence`).

### Grossesses — `/api/patients/{patientId}/pregnancies` + `/api/pregnancies/{id}`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/patients/{patientId}/pregnancies` | tous | Liste grossesses (en cours + historique). |
| GET | `/api/patients/{patientId}/pregnancies/current` | tous | Grossesse `EN_COURS` ou 404. Pour le badge dossier. |
| POST | `/api/patients/{patientId}/pregnancies` | MEDECIN | Déclarer grossesse `{lmpDate, notes?}`. Génère plan de visites auto. 422 PATIENT_NOT_FEMALE / PREGNANCY_ALREADY_ACTIVE. |
| PUT | `/api/pregnancies/{id}` | MEDECIN | Modifier `{lmpDate, dueDate, dueDateSource, notes}`. Recalcule plan visites si lmpDate change. |
| POST | `/api/pregnancies/{id}/close` | MEDECIN | Clôture `{endedAt, outcome, notes?}`. 422 si `EN_COURS` requis. |
| POST | `/api/pregnancies/{id}/create-child` | MEDECIN | Crée fiche enfant (réutilise PatientService) si `outcome = ACCOUCHEMENT_VIVANT`. Body `{firstName, sex}`. Auto-déclenche calendrier vaccination PNI (V022). 422 si déjà créée. |

### Visites — `/api/pregnancies/{pregnancyId}/visits` + plan

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/pregnancies/{id}/plan` | tous | Liste plan de visites. |
| PUT | `/api/pregnancies/{id}/plan/{planId}` | MEDECIN | Modifier `{targetDate, status}`. |
| GET | `/api/pregnancies/{id}/visits` | tous | Liste visites enregistrées, paginé desc. |
| POST | `/api/pregnancies/{id}/visits` | ASSISTANT/MEDECIN/ADMIN | Saisir biométrie obstétricale. Body : voir schéma `pregnancy_visit`. |
| PUT | `/api/pregnancies/visits/{visitId}` | ASSISTANT/MEDECIN/ADMIN | Modifier (avant signature consultation). |

### Échographies — `/api/pregnancies/{pregnancyId}/ultrasounds`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/pregnancies/{id}/ultrasounds` | tous | Liste 3 échos. |
| POST | `/api/pregnancies/{id}/ultrasounds` | MEDECIN | Saisir écho `{kind, performedAt, findings, biometry, correctsDueDate, documentId?}`. Si `correctsDueDate=true` et `kind=T1_DATATION`, ajuste `pregnancy.due_date` + `due_date_source=ECHO_T1` + recalcule plan visites. |

### Bilan biologique — bouton de raccourci

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/pregnancies/{id}/bio-panel-template?trimester={T1\|T2\|T3}` | MEDECIN | Retourne un `PrescriptionTemplate` pré-rempli avec sérologies/bilans du trimestre demandé (réutilise V020 modèles). Le frontend hydrate `PrescriptionDrawer`. |

### Worklist + alertes — `/api/pregnancies/queue` + `/alerts`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/pregnancies/queue` | tous | Worklist transversale paginée (PageView). Filtres : `trimester`, `withAlerts`, `q` (nom patiente), `page`, `size`. |
| GET | `/api/pregnancies/alerts/count` | tous | `{withActiveAlerts: int}` pour badge sidebar (polling 30 s). |
| GET | `/api/pregnancies/{id}/alerts` | tous | Liste alertes actives détaillées de la grossesse. |

### Matrice RBAC

| Action | SECRETAIRE | ASSISTANT | MEDECIN | ADMIN |
|---|---|---|---|---|
| Lecture grossesse/visites/échos/alertes | ✅ | ✅ | ✅ | ✅ |
| Créer RDV `SUIVI_GROSSESSE` | ✅ | ✅ | ✅ | ✅ |
| Déclarer grossesse | ❌ | ❌ | ✅ | ✅ |
| Saisir biométrie (POST visit) | ❌ | ✅ | ✅ | ✅ |
| Saisir échographie | ❌ | ❌ | ✅ | ✅ |
| Clôturer grossesse | ❌ | ❌ | ✅ | ✅ |
| Créer fiche enfant | ❌ | ❌ | ✅ | ✅ |

Enforcement via `@PreAuthorize` au controller layer.

## Frontend — slice `features/grossesse/`

### 1. Onglet `Grossesse` dans `DossierPage` (desktop + mobile)

- Visible uniquement si `patient.sex === 'F'`.
- Section "Grossesse en cours" (si une `EN_COURS` existe) :
  - Header : SA actuelle, DPA, source DPA, G/P/A/V calculés
  - Plan de visites timeline (8 chips colorés selon status)
  - Bouton "Saisir visite" (drawer biométrique)
  - Bouton "Saisir écho" (drawer écho)
  - Bouton "Prescrire bilan T1/T2/T3" (ouvre PrescriptionDrawer pré-rempli)
  - Bouton "Clôturer la grossesse" (drawer clôture)
  - Tableau visites enregistrées + tableau échographies + alertes actives en bandeau warning si présentes
- Section "Antécédents obstétricaux" : grossesses `TERMINEE`/`INTERROMPUE` listées (issue, DDA, lien fiche enfant si créée).
- Bouton "Déclarer une grossesse" si aucune en cours (MEDECIN/ADMIN).

### 2. Page `/grossesses` — worklist transversale

- Route `RequireRole={['SECRETAIRE','ASSISTANT','MEDECIN','ADMIN']}`.
- Tableau paginé : patiente | SA | DPA | trimestre (chip) | dernière visite | alertes (badges) | actions (Voir).
- Filtres : trimestre (T1/T2/T3), `withAlerts`, recherche `q`.
- Mobile 390 px : cartes empilées par patiente.
- Sidebar item `Grossesses` avec badge `useGrossesseAlertsCount()` polling 30 s.

### 3. Drawer biométrique partagé

- `PregnancyVisitDrawer` : form contextuel selon SA actuelle.
  - Toujours : poids, TA, BU
  - À partir de SA 12 : BCF
  - À partir de SA 20 : HU
  - À partir de SA 24 : MAF
  - À partir de SA 32 : présentation
- Validation zod alignée seuils OMS (TA 60-220 / 30-140, poids 30-180, BCF 100-200, HU 5-50).
- Réutilisable dans la consultation (consultation depuis RDV `SUIVI_GROSSESSE` → onglet Grossesse pré-actif).

### 4. Mobile parity (390 px)

Strict alignement Vaccination :
- Onglet `Grossesse` dans `DossierPage.mobile`.
- Drawer biométrique en bottom-sheet plein écran.
- Worklist `/grossesses` mobile = cartes empilées.
- Pas de version mobile pour Paramétrage Grossesse (post-pilote).

### Hooks (TanStack Query)

- `usePregnancies(patientId)`, `useCurrentPregnancy(patientId)`
- `usePregnancyVisits(pregnancyId)`, `usePregnancyUltrasounds(pregnancyId)`, `usePregnancyAlerts(pregnancyId)`
- `usePregnancyQueue(filters)`, `usePregnancyAlertsCount()`
- `useDeclarePregnancy`, `useUpdatePregnancy`, `useClosePregnancy`, `useCreateChildFromPregnancy`
- `useRecordVisit`, `useUpdateVisit`
- `useRecordUltrasound`
- `useBioPanelTemplate(pregnancyId, trimester)` (lazy fetch sur clic bouton)

## Tests d'intégration — `Pregnancy*IT.java`

Pattern : Testcontainers Postgres + MockMvc + JdbcTemplate (aligné `VaccinationCatalogIT`, `StockMovementIT`).

### `PregnancyDeclareIT` (~10 scénarios)
1. Déclarer grossesse patiente F → 201, plan de 8 visites auto-créé, DPA = lmp + 280 j.
2. Déclarer grossesse patient M → 422 PATIENT_NOT_FEMALE.
3. Déclarer grossesse alors qu'une autre EN_COURS → 422 PREGNANCY_ALREADY_ACTIVE.
4. Déclarer avec `lmpDate` > 12 SA dans le passé → visites < SA actuelle marquées MANQUEE.
5. RBAC : SECRETAIRE/ASSISTANT 403, MEDECIN/ADMIN 201.
6. PUT lmpDate change → plan visites recalculé.
7. Close grossesse `EN_COURS` → status TERMINEE, ended_at + outcome persistés.
8. Close grossesse déjà TERMINEE → 422.
9. Créer fiche enfant après close ACCOUCHEMENT_VIVANT → patient enfant créé, calendrier vaccination PNI auto, `child_patient_id` lié.
10. Créer fiche enfant alors que outcome = FCS → 422 OUTCOME_NOT_LIVE_BIRTH.

### `PregnancyVisitIT` (~10 scénarios)
1. Saisir visite ASSISTANT → 201, sa_weeks calculé.
2. RBAC : SECRETAIRE 403, ASSISTANT 201.
3. Saisir visite avec TA 145/95 → alerte HTA_GRAVIDIQUE active sur la grossesse.
4. Saisir visite avec glycémie HGPO 1,7 g/L → alerte DIABETE_GESTATIONNEL.
5. Visite à SA 35 sans présentation → accepté (champ optionnel).
6. Visite à SA 12 avec BCF absent → alerte BCF_ABSENT.
7. Saisie biométrique liée à RDV `SUIVI_GROSSESSE` → `appointment_id` lié, plan visite passe à HONOREE.
8. Visite ad-hoc (sans plan match) → `visit_plan_id = null`.
9. PUT visite avant signature consultation OK.
10. PUT visite après signature → 422 (alignement clinical_consultation immutable).

### `PregnancyUltrasoundIT` (~6 scénarios)
1. Saisir T1 datation avec `correctsDueDate=true` → due_date pregnancy ajustée + due_date_source=ECHO_T1 + plan visites recalculé.
2. Saisir T1 sans correctsDueDate → due_date inchangée.
3. Saisir T2 morpho avec attached document_id → join visible.
4. RBAC : ASSISTANT 403, MEDECIN 201.
5. 3 échos T1 séparées → toutes acceptées (kind n'est pas unique).
6. Sa_weeks_at_exam < 6 → 422 SA_TOO_EARLY.

### `PregnancyAlertIT` (~5 scénarios)
1. TA 145/95 dernière visite → présent dans `/alerts`.
2. Aucune visite depuis > 6 sem en T3 → présent.
3. Terme dépassé (today > due_date + 7 j et status EN_COURS) → présent.
4. BU positive (protéines) → présent.
5. `/alerts/count` agrège par grossesses EN_COURS uniquement.

### `PregnancyQueueIT` (~4 scénarios)
1. Liste worklist filtrée par trimestre.
2. Filtre `withAlerts=true` retourne uniquement les grossesses avec ≥ 1 alerte.
3. Pagination correcte (PageView).
4. Tri par SA décroissant par défaut.

### Manual QA après merge (agent `manual-qa`)
- Walk desktop : déclarer grossesse F → voir plan 8 visites → saisir visite avec TA normale → saisir visite avec TA 150/95 → voir alerte → saisir T1 datation correctrice → DPA recalculée → prescrire bilan T2 (drawer pré-rempli) → clôturer ACCOUCHEMENT_VIVANT → créer fiche enfant → vérifier calendrier vaccination PNI dans dossier enfant.
- Walk mobile 390 px : même flow en bottom-sheet.
- Walk RBAC : login SECRETAIRE → vérifier déclaration 403, lecture OK ; login ASSISTANT → vérifier visite 201, écho 403.
- Walk patient mâle : déclarer grossesse → 422 PATIENT_NOT_FEMALE.

## Plan d'implémentation séquentiel

1 commit feature + 1 commit IT par étape (`feedback_ship_order.md`).

### Étape 1 — Backend schéma + déclaration + plan visites (~2 j)
- `V026__pregnancy_module.sql` : 4 tables + indexes + extension enum AppointmentType.
- Domain : entités + enums (PregnancyStatus, PregnancyOutcome, UltrasoundKind, VisitPlanStatus, Presentation).
- Repos : 4 repositories.
- Services : `PregnancyService` (declare, update, close, createChild) avec auto-génération plan visites.
- Endpoints `/api/patients/{id}/pregnancies` + `/api/pregnancies/{id}` + `/close` + `/create-child` + `/plan`.
- IT : `PregnancyDeclareIT` (10 scénarios).

### Étape 2 — Backend visites + échos (~1.5 j)
- `PregnancyVisitService` (record, update).
- `PregnancyUltrasoundService` (record, ajustement DPA si T1 correctrice).
- Endpoints visites + échos.
- IT : `PregnancyVisitIT` (10) + `PregnancyUltrasoundIT` (6).

### Étape 3 — Backend alertes + worklist + bio panel (~1.5 j)
- `PregnancyAlertService.queryAlerts()` : 7 règles hardcodées.
- `PregnancyQueueService` (worklist paginée).
- `PregnancyBioPanelService` : retourne PrescriptionTemplate par trimestre.
- Endpoints `/queue`, `/alerts`, `/alerts/count`, `/bio-panel-template`.
- IT : `PregnancyAlertIT` (5) + `PregnancyQueueIT` (4).

### Étape 4 — Frontend onglet dossier + drawer biométrique + drawer écho (~2 j)
- Slice `features/grossesse/` : 14 hooks + types + schemas zod.
- Onglet `Grossesse` dans `DossierPage` (desktop + mobile 390 px).
- `PregnancyVisitDrawer` (form contextuel selon SA).
- `PregnancyUltrasoundDrawer`.
- `PregnancyDeclareDialog` + `PregnancyCloseDialog` + `CreateChildDialog`.
- Tests vitest (~25 scénarios).

### Étape 5 — Frontend worklist `/grossesses` + sidebar badge + bio panel CTA (~1 j)
- Page `/grossesses` (desktop + mobile).
- Sidebar : item Grossesses + badge `useGrossesseAlertsCount()`.
- Bouton "Prescrire bilan T1/T2/T3" intégré au PrescriptionDrawer existant (pré-fill via API).
- Tests vitest.

### Étape 6 — Manual QA + docs (~1 j)
- Agent `manual-qa` : 4 walks desktop + mobile + RBAC + patient mâle.
- Mise à jour `docs/PROGRESS.md`, `docs/API.md`, `docs/DECISIONS.md` (ADR-031 « Module Grossesse — table dédiée 1-N + plan visites OMS auto + alertes hardcodées »), retrait `Pregnancy vertical` du BACKLOG.

**Total estimé : ~9 jours.**

## Risques & non-couverts (v1)

- **Pas de support multi-fœtus** : `fetuses` JSONB minimal avec un seul fœtus par défaut. Jumeaux/triplés = scope C, ADR à écrire au moment où un cabinet pilote en demande.
- **Pas de carnet maternité PDF imprimable** : export générique du dossier suffit. Vrai carnet bilingue FR/AR = post-pilote.
- **Pas de courbes percentiles fœtales** : la biométrie écho est stockée en JSONB sans calcul de percentile (Hadlock, OMS 2017). Si demandé, ajouter une lib de calcul + graphes. Le médecin peut interpréter manuellement avec son écographe.
- **Pas de score de risque obstétrical** : Coopland modifié, pré-éclampsie FMF — scope C.
- **Pas de seuils paramétrables** : 7 règles d'alerte hardcodées. Si signal terrain → onglet Paramétrage Grossesse v2.
- **Pas de monitoring fœtal numérique (RCF)** : hors scope GP standard, demande équipement spécifique.
- **Pas d'historique des changements de DPA** : seul le `due_date_source` indique si Naegele ou ECHO_T1. Si plusieurs corrections successives, on perd la traçabilité (audit log générique suffira).
- **Pas de gestion des sérologies déjà connues** : le bouton "Prescrire bilan T1" ne consulte pas l'historique pour éviter de re-prescrire la rubéole déjà immunisée. Le médecin filtre manuellement avant validation. v2 si signal.
- **Articulation avec Vaccination dTcaP mère** : recommandation OMS chaque grossesse mais pas câblée auto (le module Vaccination V022 cible enfant). v2 = ajouter un mode "vaccination femme enceinte" au catalogue.
