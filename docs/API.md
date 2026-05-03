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

## Actuator & meta (J1) ✅

- `GET /actuator/health` — public — health probe (`{status: UP}`)
- `GET /actuator/info` — public — app info
- `GET /v3/api-docs` — public — OpenAPI JSON (springdoc-openapi). **Import this URL directly into Postman** to get a ready-made collection of every endpoint.
- `GET /swagger-ui.html` — public — Swagger UI

## How to update this file

When a controller ships, update the section: remove "Not yet implemented", list each endpoint with its final method/path/role/description. If the endpoint differs from the expected list, note why in the same line.
