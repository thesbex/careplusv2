# API inventory

Runtime truth is at `/swagger-ui.html` and `/v3/api-docs`. This file is the human-readable map, filled module by module as they ship.

Format: `METHOD /path` — role required — short description.

## identity (J2) ✅

- `POST /api/auth/login` — public — `{email, password}` → `{accessToken, expiresInSeconds, user}` + HttpOnly cookie `careplus_refresh`
- `POST /api/auth/refresh` — public (refresh token in HttpOnly cookie) → `{accessToken, expiresInSeconds}` + rotated cookie
- `POST /api/auth/logout` — authenticated (refresh cookie) → revokes refresh token, clears cookie; 204
- `GET /api/users/me` — authenticated — current user profile `{id, email, firstName, lastName, phone, roles[]}`

### Admin bootstrap (one-shot, first run only)
- `GET /api/admin/bootstrap/status` — public — `{bootstrapped: bool}` — whether ADMIN user exists
- `POST /api/admin/bootstrap` — public (only if no ADMIN exists) — `{email, password, firstName, lastName}` → creates first ADMIN user; 201

### User management (ADMIN)
- `GET /api/admin/users` — ADMIN — list all users with roles
- `POST /api/admin/users` — ADMIN — create user `{email, password, firstName, lastName, phone, roleNames[]}` → 201
- `GET /api/admin/users/{id}` — ADMIN — user detail
- `PUT /api/admin/users/{id}` — ADMIN — update profile fields
- `PUT /api/admin/users/{id}/password` — ADMIN — reset password
- `DELETE /api/admin/users/{id}` — ADMIN — deactivate user (sets enabled=false)

## patient (J3, extended ADR-023) ✅

- `POST /api/patients` — SECRETAIRE/MEDECIN/ADMIN — create patient `{lastName, firstName, gender, birthDate, cin, phone, email, address, city}` → 201 with full PatientView
- `GET /api/patients` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — search patients; query params: `q` (full-text on name/cin/phone), `page`, `size` (default 20); returns `Page<PatientSummary>`
- `GET /api/patients/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — patient detail including tier, mutuelleInsuranceId, mutuellePoliceNumber, allergies, antecedents
- `PUT /api/patients/{id}` — SECRETAIRE/MEDECIN/ADMIN — update patient fields
- `DELETE /api/patients/{id}` — MEDECIN/ADMIN — soft delete (sets `deleted_at`); 204
- `POST /api/patients/{id}/allergies` — SECRETAIRE/MEDECIN/ADMIN — add allergy `{substance, atcTag, severity}` → 201
- `DELETE /api/patients/{id}/allergies/{allergyId}` — SECRETAIRE/MEDECIN/ADMIN — remove allergy; 204
- `POST /api/patients/{id}/antecedents` — SECRETAIRE/MEDECIN/ADMIN — add antecedent `{type, description, occurredOn, category?}` → 201; `category` is one of 17 ADR-023 values (PERSONNEL_MALADIES_CHRONIQUES, PERSONNEL_CHIRURGIES, FAMILIAL, etc.)
- `DELETE /api/patients/{id}/antecedents/{antecedentId}` — SECRETAIRE/MEDECIN/ADMIN — remove antecedent; 204
- `POST /api/patients/{id}/notes` — MEDECIN — create clinical note `{content}` → 201 with `{id, patientId, content, createdByName, createdAt}`
- `GET /api/patients/{id}/notes` — MEDECIN/ADMIN — list clinical notes for patient, newest first
- `PUT /api/patients/{id}/tier` — MEDECIN/ADMIN — update billing tier `{tier: NORMAL|PREMIUM}` → PatientView
- `PUT /api/patients/{id}/mutuelle` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — set mutuelle `{insuranceId?, policyNumber?}` → PatientView

## scheduling (J4) ✅

- `POST /api/appointments` — SECRETAIRE/MEDECIN/ADMIN — book appointment `{patientId, practitionerId, startAt, durationMinutes, reasonId?, urgency?, walkIn?}` → 201; 409 if slot conflict (unless urgency=true); 409 if holiday
- `GET /api/appointments/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — appointment detail
- `GET /api/appointments` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list appointments; required params: `practitionerId`, `from`, `to` (ISO datetime); excludes ANNULE/NO_SHOW
- `PUT /api/appointments/{id}` — SECRETAIRE/MEDECIN/ADMIN — move appointment `{startAt?, durationMinutes?}`
- `DELETE /api/appointments/{id}` — SECRETAIRE/MEDECIN/ADMIN — cancel with `{reason}` → `AppointmentView` with status=ANNULE
- `GET /api/availability` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — free slots; params: `practitionerId`, `from`, `to`, `reasonId?`, `durationMinutes?`
- `GET /api/reasons` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list active appointment reasons

## presence + clinical (J5) ✅

- `POST /api/appointments/{id}/check-in` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — stamps `arrived_at`, transitions PLANIFIE/CONFIRME → ARRIVE; 204
- `GET /api/queue` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — today's queue (ARRIVE, EN_ATTENTE_CONSTANTES, CONSTANTES_PRISES, EN_CONSULTATION), ordered by `start_at`
- `POST /api/appointments/{id}/vitals` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — record vital signs `{systolicMmhg, diastolicMmhg, heartRateBpm, spo2Percent, temperatureC, weightKg, heightCm, glycemiaGPerL?, notes?}`; auto-computes BMI; advances appointment to CONSTANTES_PRISES; 201
- `GET /api/patients/{patientId}/vitals` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — vitals history for a patient, newest first
- `POST /api/consultations` — MEDECIN/ADMIN — start draft consultation `{patientId, appointmentId?, motif?}`; advances appointment to EN_CONSULTATION; 201
- `GET /api/consultations/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — fetch consultation
- `PUT /api/consultations/{id}` — MEDECIN/ADMIN — update draft fields `{motif?, examination?, diagnosis?, notes?}`; 409 CONSULT_LOCKED if already SIGNEE
- `POST /api/consultations/{id}/sign` — MEDECIN/ADMIN — locks consultation (SIGNEE), stamps `signed_at`, publishes `ConsultationSigneeEvent`, advances appointment to CONSULTATION_TERMINEE
- `POST /api/consultations/{id}/follow-up` — MEDECIN/ADMIN — creates CONTROLE appointment linked via `origin_consultation_id`; body: `{startAt, durationMinutes?}`; 201

## catalog + prescriptions (J6) ✅

### Acts and tariffs
- `GET /api/catalog/acts` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list all active acts
- `POST /api/catalog/acts` — MEDECIN/ADMIN — create act `{code, name, type, defaultPrice, vatRate}` → 201
- `PUT /api/catalog/acts/{id}` — MEDECIN/ADMIN — update act `{name?, type?}`
- `DELETE /api/catalog/acts/{id}` — MEDECIN/ADMIN — deactivate act (soft: sets `active=false`); 204
- `POST /api/catalog/acts/{id}/tariffs` — MEDECIN/ADMIN — add tier tariff `{tier, amount, effectiveFrom}`; closes previous open row for same act+tier; 201
- `GET /api/catalog/acts/{id}/tariffs` — all roles — tariff history for act

### Medications
- `GET /api/catalog/medications?q=` — all roles — search by commercial name or DCI (ILIKE); limit 20

### Prescriptions
- `POST /api/consultations/{consultationId}/prescriptions` — MEDECIN/ADMIN — create prescription `{type, lines[], allergyOverride?, allergyOverrideReason?}`; consultation must be BROUILLON; checks patient allergies for DRUG type (422 `AllergyConflict` unless `allergyOverride=true`); 201
- `GET /api/consultations/{consultationId}/prescriptions` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list prescriptions for consultation with lines
- `GET /api/prescriptions/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — get prescription with lines
- `GET /api/prescriptions/{id}/pdf` — MEDECIN/ADMIN — generate and stream ordonnance PDF (openhtmltopdf + Thymeleaf); `Content-Type: application/pdf`

## billing (J7) ✅

- `GET /api/invoices` — SECRETAIRE/MEDECIN/ADMIN — list invoices with lines + payments; optional `?status=` filter
- `GET /api/invoices/{id}` — SECRETAIRE/MEDECIN/ADMIN — invoice detail with lines + payments
- `GET /api/consultations/{consultationId}/invoice` — SECRETAIRE/MEDECIN/ADMIN — invoice for a consultation
- `PUT /api/invoices/{id}` — SECRETAIRE/MEDECIN/ADMIN — edit draft `{lines[]?, discountAmount?}`; 409 if not BROUILLON
- `PUT /api/consultations/{consultationId}/invoice-total` — MEDECIN only — adjust discount `{discountAmount}` before issuance
- `POST /api/invoices/{id}/issue` — SECRETAIRE/MEDECIN/ADMIN — atomic sequential number (YYYY-NNNNNN via SELECT FOR UPDATE), status → EMISE; 409 if already EMISE
- `POST /api/invoices/{id}/payments` — SECRETAIRE/MEDECIN/ADMIN — record payment `{amount, mode, reference?}`; status auto-updates to PAYEE_PARTIELLE / PAYEE_TOTALE
- `POST /api/invoices/{id}/credit-note` — SECRETAIRE/MEDECIN/ADMIN — issue credit note `{reason}` → `{creditNoteId, originalInvoiceId, amount (negative), reason, number (AYYYY-NNNNNN)}`; original → ANNULEE

Note: `ConsultationSigneeEvent` listener automatically creates draft invoice (BROUILLON) with tier-based discount applied (NORMAL=0%, PREMIUM=10% per `config_patient_tier`).

## configuration / settings ✅ (étape 6)

- `GET /api/settings/clinic` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — single-row clinic identity. 200 if configured, 204 if not yet (first run).
- `PUT /api/settings/clinic` — MEDECIN/ADMIN — upsert `{name, address, city, phone, email?, inpe?, cnom?, ice?, rib?}`.
- `GET /api/settings/tiers` — all roles — list configured tier discounts (NORMAL=0%, PREMIUM=10% by default).
- `PUT /api/settings/tiers/{tier}` — MEDECIN/ADMIN — upsert `{tier: NORMAL|PREMIUM, discountPercent}`. % in [0, 100]. Applied automatically by `BillingService` on consultation sign.

Seeded defaults from V002:
- Working hours: Mon–Fri 09:00–13:00 and 15:00–19:00, Sat 09:00–13:00 (Africa/Casablanca)
- 16 Moroccan public holidays for 2026
- 10 insurance providers (AMO CNSS/CNOPS + mutuelles), exposed via `/api/catalog/insurances`
- 6 appointment reasons (PREMIERE, SUIVI, CERTIFICAT, VACCIN, URGENCE, RENOUVELLEMENT)
- 5 document templates (ORDONNANCE, CERTIFICAT, BON_ANALYSE, BON_RADIO, FACTURE)
- Invoice sequence initialized per year

## Catalog reference reads (étapes 5.5a–d) ✅

- `GET /api/catalog/insurances` — all roles — list active insurance providers `{id, code, name, kind: AMO|MUTUELLE|PRIVEE}`, sorted by kind/name.
- `GET /api/catalog/lab-tests?q=` — all roles — search lab catalog (ILIKE name + code), top 20.
- `GET /api/catalog/imaging-exams?q=` — all roles — search imaging catalog (ILIKE name + code), top 20.

## Consultations list ✅ (étape 1.5)

- `GET /api/consultations?practitionerId=&patientId=&from=&to=` — all roles — list consultations. Filters: practitioner (defaults to authenticated user), patient, date window.
- `GET /api/patients/{patientId}/prescriptions` — all roles — all prescriptions for a patient (étape 4).

## Queue payload extension ✅ (étape 7)

`GET /api/queue` now returns `{appointmentId, patientId, patientFullName, scheduledAt, status, arrivedAt, hasAllergies, age, reasonLabel, practitionerName, durationMinutes, isPremium}`.

## vaccination — Étape 1 référentiel (2026-05-02) ✅

### Vaccine catalog
- `GET /api/vaccinations/catalog` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list all vaccines (including inactive)
- `POST /api/vaccinations/catalog` — MEDECIN/ADMIN — create vaccine `{code, nameFr, manufacturerDefault, routeDefault, isPni}` → 201; 409 if code duplicate
- `PUT /api/vaccinations/catalog/{id}` — MEDECIN/ADMIN — update vaccine; 409 if code duplicate; 404 if not found
- `DELETE /api/vaccinations/catalog/{id}` — MEDECIN/ADMIN — soft-deactivate (sets active=false); 422 PNI_PROTECTED if is_pni=true

### Vaccine schedule
- `GET /api/vaccinations/schedule` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list all schedule doses ordered by target_age_days; optional `?vaccineId=` filter
- `POST /api/vaccinations/schedule` — MEDECIN/ADMIN — create schedule dose `{vaccineId, doseNumber, targetAgeDays, toleranceDays, labelFr}` → 201; 409 if (vaccine_id, dose_number) duplicate
- `PUT /api/vaccinations/schedule/{id}` — MEDECIN/ADMIN — update schedule dose; 409 if duplicate; 404 if not found
- `DELETE /api/vaccinations/schedule/{id}` — MEDECIN/ADMIN — hard delete; 404 if not found

## vaccination — Étape 2 dossier patient (2026-05-02) ✅

### Patient vaccination calendar

- `GET /api/patients/{patientId}/vaccinations` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — materialised calendar: persisted rows ∪ computed PLANNED entries. Sorted by `targetDate` ASC. Each `VaccinationCalendarEntry` has `{id?, scheduleDoseId?, vaccineId, vaccineCode, vaccineName, doseNumber, doseLabel, targetDate, toleranceDays, status, administeredAt?, lotNumber?, route?, site?, administeredByName?, deferralReason?, notes?, version?}`. `id` is absent if dose not yet materialised. `status` ∈ `UPCOMING|DUE_SOON|OVERDUE|ADMINISTERED|DEFERRED|SKIPPED`.
- `POST /api/patients/{patientId}/vaccinations` — MEDECIN/ASSISTANT/ADMIN — record dose ADMINISTERED `{vaccineId, doseNumber, administeredAt, lotNumber (required), scheduleDoseId?, route?, site?, administeredBy?, notes?}` → 201; 409 `VACCINATION_ALREADY_RECORDED` if (patient, vaccineId, doseNumber) duplicate (non-deleted); 422 if scheduleDoseId does not match vaccineId.
- `PUT /api/patients/{patientId}/vaccinations/{doseId}` — MEDECIN/ADMIN — update dose `{administeredAt?, lotNumber?, route?, site?, administeredBy?, deferralReason?, notes?, version (required)}` → 200; 409 `OPTIMISTIC_LOCK_CONFLICT` if version diverges; 404 if dose not found.
- `POST /api/patients/{patientId}/vaccinations/{doseId}/defer` — MEDECIN/ASSISTANT/ADMIN — defer dose `{reason}` → 200; `doseId` may be a persisted row id OR a `scheduleDoseId` (row materialised on demand); 404 if neither.
- `POST /api/patients/{patientId}/vaccinations/{doseId}/skip` — MEDECIN/ADMIN — skip dose → 200; same materialisation logic as defer.
- `DELETE /api/patients/{patientId}/vaccinations/{doseId}` — MEDECIN/ADMIN — soft-delete (sets `deleted_at`); calendar re-computes that slot as PLANNED/DUE_SOON/OVERDUE; 204.

Adult edge-case: schedule entries where `today > targetDate + toleranceDays + 5 years` are excluded from the computed calendar (patient too old for pediatric PNI).

### Domain event (not yet published — Étape 3)

`VaccinationDueEvent(eventId, occurredAt, patientId, doseId, dueAt)` — record class in place; published by cron job in Étape 3 (Notifications module).

## vaccination — Étape 3 worklist + carnet PDF (2026-05-03) ✅

### Worklist transversale

- `GET /api/vaccinations/queue` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — paginated, urgency-sorted list of doses due for all pediatric patients (age < 18 years, not soft-deleted). Query params: `status` (OVERDUE|DUE_SOON|UPCOMING; default null → OVERDUE + DUE_SOON), `vaccineCode`, `practitionerId` (accepted but TODO post-MVP), `ageGroupMinMonths`, `ageGroupMaxMonths`, `upcomingHorizonDays` (default 30), `page` (default 0), `size` (default 50, max 200). Returns `PageView<VaccinationQueueEntry>` with `{content, totalElements, pageNumber, number, pageSize, totalPages}` (`number` + `totalPages` ajoutés en QA wave 7 pour la pagination frontend ; `pageNumber`/`pageSize` conservés en alias backward-compat). Each `VaccinationQueueEntry`: `{patientId, patientFirstName, patientLastName, patientPhotoDocumentId?, patientBirthDate, ageMonths, vaccineId, vaccineCode, vaccineName, doseNumber, doseLabel, scheduleDoseId?, targetDate, daysOverdue, status}`. Sort: OVERDUE (most days overdue first) → DUE_SOON (nearest targetDate) → UPCOMING.

### Carnet PDF patient

- `GET /api/patients/{patientId}/vaccinations/booklet` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — generates vaccination booklet PDF (Thymeleaf + openhtmltopdf). Header: cabinet info + doctor name. Patient identity block (name, DOB, age, gender). Table: Vaccin | Dose | Date | Lot | Voie / Site | Administré par | Signature (manual). Only ADMINISTERED doses sorted by `administeredAt` ASC. Empty table if no doses. Response: `application/pdf`, `Content-Disposition: inline; filename=carnet-vaccination-<lastName>-<firstName>.pdf`. 404 `PATIENT_NOT_FOUND` if patient unknown.

## stock — Étape 1 schéma + référentiel articles + fournisseurs (2026-05-03) ✅

### Articles — `/api/stock/articles`

- `GET /api/stock/articles` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — paginated list. Query: `category` (MEDICAMENT_INTERNE|DOSSIER_PHYSIQUE|CONSOMMABLE), `supplierId` (UUID), `q` (search label/code), `includeInactive` (default false), `page` (default 0), `size` (default 20). Returns `PageView<StockArticleView>` with `currentQuantity=0` placeholder (computed in Étape 2), `tracksLots` (GENERATED column), `supplierName` (resolved).
- `GET /api/stock/articles/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — article detail.
- `POST /api/stock/articles` — MEDECIN/ADMIN — create article. 409 `CODE_DUPLICATE` if active article with same code exists.
- `PUT /api/stock/articles/{id}` — MEDECIN/ADMIN — update article. 422 `CATEGORY_LOCKED` if category changes after movements exist.
- `DELETE /api/stock/articles/{id}` — MEDECIN/ADMIN — soft-delete (active=false).

### Suppliers — `/api/stock/suppliers`

- `GET /api/stock/suppliers` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list active suppliers (default). `includeInactive=true` to show all.
- `GET /api/stock/suppliers/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — supplier detail.
- `POST /api/stock/suppliers` — MEDECIN/ADMIN — create supplier `{name, phone?}`.
- `PUT /api/stock/suppliers/{id}` — MEDECIN/ADMIN — update supplier.
- `DELETE /api/stock/suppliers/{id}` — MEDECIN/ADMIN — soft-delete (active=false).

## stock — Étape 2 mouvements + FIFO + lots (2026-05-03) ✅

### Mouvements — `/api/stock/articles/{id}/movements`

- `POST /api/stock/articles/{id}/movements` — RBAC par type (voir matrice) — body `{type: IN|OUT|ADJUSTMENT, quantity, reason?, lotNumber?, expiresOn?}`.
  - `IN` : SECRETAIRE/ASSISTANT/MEDECIN/ADMIN. Pour MEDICAMENT_INTERNE : `lotNumber` + `expiresOn` requis (400 `LOT_REQUIRED` sinon). Crée/incrémente le lot. Retourne 201 + `StockMovementView`.
  - `OUT` : ASSISTANT/MEDECIN/ADMIN (SECRETAIRE → 403). Pour MEDICAMENT_INTERNE : FIFO automatique sur lots ACTIVE triés par `expires_on ASC`. Retourne 201 + `List<StockMovementView>` (un row par lot consommé). 422 `INSUFFICIENT_STOCK` si stock < quantity.
  - `ADJUSTMENT` : SECRETAIRE/ASSISTANT/MEDECIN/ADMIN. `quantity` = nouvelle quantité totale. `reason` obligatoire (400 `REASON_REQUIRED` sinon). Retourne 201 + `StockMovementView`.
- `GET /api/stock/articles/{id}/movements` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — historique paginé desc. Query: `type` (IN|OUT|ADJUSTMENT), `from` (ISO datetime), `to` (ISO datetime), `page` (default 0), `size` (default 20). Returns `PageView<StockMovementView>`.

`StockMovementView` : `{id, articleId, lotId?, type, quantity (|delta| affiché), reason?, performedBy: {id, name}, performedAt}`.

### Lots — `/api/stock/articles/{id}/lots` et `/api/stock/lots/{lotId}/inactivate`

- `GET /api/stock/articles/{id}/lots` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — liste lots de l'article. Query: `status` (ACTIVE|EXHAUSTED|INACTIVE; default null = tous). Retourne `List<StockLotView>`.
- `PUT /api/stock/lots/{lotId}/inactivate` — MEDECIN/ADMIN — bascule lot ACTIVE → INACTIVE (rappel fournisseur). Idempotent si déjà INACTIVE. 409 `LOT_EXHAUSTED` si épuisé.

`StockLotView` : `{id, articleId, lotNumber, expiresOn, quantity, status, daysUntilExpiry (calculé depuis today), createdAt, updatedAt}`.

**Note Étape 2** : `currentQuantity` sur `StockArticleView` est maintenant calculé en temps réel. `nearestExpiry` (date lot ACTIVE le plus proche) ajouté à `StockArticleView` pour MEDICAMENT_INTERNE. Alertes/worklist exposées en Étape 3.

**Migration V025** : Suppression de la contrainte `CHECK (quantity > 0)` sur `stock_movement` pour permettre les deltas négatifs des ajustements sur articles sans tracking de lots.

## stock — Étape 3 alertes stock faible + péremption (2026-05-03) ✅

### Alertes — `/api/stock/alerts`

- `GET /api/stock/alerts/count` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — returns `{lowStock: int, expiringSoon: int}`. Fast native COUNT queries designed for sidebar badge polling every 30s. `lowStock` = articles `active=true` avec `currentQuantity < minThreshold` (threshold=0 exclus). `expiringSoon` = lots `status=ACTIVE` dont `expires_on - today ≤ 30` ET article `active=true`.
- `GET /api/stock/alerts` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — returns `{lowStock: List<StockArticleView>, expiringSoon: List<StockLotWithArticleView>}`. `lowStock`: articles avec `currentQuantity` calculé + `minThreshold` + nom fournisseur. `expiringSoon`: lots avec article (code/label/category) + lot info (numéro, expiresOn, quantity, daysUntilExpiry).

`StockLotWithArticleView` : `{lotId, lotNumber, expiresOn, quantity, daysUntilExpiry, articleId, articleCode, articleLabel, articleCategory}`.

## pregnancy — Étape 1 déclaration + plan visites (2026-05-03) 🔧 (Étapes 2-6 à venir)

### Grossesses — patient-scoped

- `GET /api/patients/{patientId}/pregnancies` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — liste toutes les grossesses (en cours + historique). Retourne `List<PregnancyView>` avec `gravidity` et `parity` calculés.
- `GET /api/patients/{patientId}/pregnancies/current` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — grossesse `EN_COURS` ou 404. Inclut `saWeeks` calculé depuis `lmp_date`. Pour badge dossier patient.
- `POST /api/patients/{patientId}/pregnancies` — MEDECIN/ADMIN — déclarer grossesse `{lmpDate, notes?}`. Auto-génère 8 entrées `pregnancy_visit_plan` (OMS SA 12/20/26/30/34/36/38/40). `due_date = lmpDate + 280 j`. Erreurs : 422 `PATIENT_NOT_FEMALE`, 422 `PREGNANCY_ALREADY_ACTIVE`.

### Grossesses — pregnancy-scoped

- `PUT /api/pregnancies/{id}` — MEDECIN/ADMIN — modifier `{lmpDate, dueDate?, dueDateSource?, notes?}`. Si `lmpDate` change → plan visites supprimé et recalculé.
- `POST /api/pregnancies/{id}/close` — MEDECIN/ADMIN — clôturer `{endedAt, outcome, notes?}`. Status → `TERMINEE` (accouchement, mort-née) ou `INTERROMPUE` (FCS/IVG/GEU/MOLE/MFIU). Erreur : 422 `PREGNANCY_NOT_ACTIVE`.
- `POST /api/pregnancies/{id}/create-child` — MEDECIN/ADMIN — créer fiche enfant `{firstName, sex}`. Appel cross-module `PatientService.create` (lastName = mère, birthDate = endedAt). Persiste `child_patient_id`. Calendrier vaccination PNI matérialisé lazily. Erreurs : 422 `OUTCOME_NOT_LIVE_BIRTH`, 422 `CHILD_ALREADY_CREATED`.

### Plan de visites

- `GET /api/pregnancies/{id}/plan` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — 8 entrées planifiées (SA cible, date cible, tolérance ±14 j, statut).
- `PUT /api/pregnancies/{id}/plan/{planId}` — MEDECIN/ADMIN — modifier une entrée `{targetDate?, status?}`.

`PregnancyView` : `{id, patientId, lmpDate, dueDate, dueDateSource, status, startedAt, endedAt, outcome, childPatientId, fetusesJson, notes, version, saWeeks, gravidity, parity}`.

`PregnancyVisitPlanView` : `{id, pregnancyId, targetSaWeeks, targetDate, toleranceDays, status, appointmentId, consultationId, version}`.

**Étapes 2-6 à venir** : visites (POST /visits, biométrie), échographies (POST /ultrasounds), alertes + worklist, frontend.

## Actuator & meta (J1) ✅

- `GET /actuator/health` — public — health probe (`{status: UP}`)
- `GET /actuator/info` — public — app info
- `GET /v3/api-docs` — public — OpenAPI JSON (springdoc-openapi). **Import this URL directly into Postman** to get a ready-made collection of every endpoint.
- `GET /swagger-ui.html` — public — Swagger UI

## How to update this file

When a controller ships, update the section: remove "Not yet implemented", list each endpoint with its final method/path/role/description. If the endpoint differs from the expected list, note why in the same line.
