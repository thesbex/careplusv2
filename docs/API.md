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

## configuration (J1 baseline, extended J7)

_Partially implemented in J1 (DB tables). Full CRUD endpoints deferred to post-MVP per scope boundary._

Seeded defaults from V002:
- Working hours: Mon–Fri 09:00–13:00 and 15:00–19:00, Sat 09:00–13:00 (Africa/Casablanca)
- 16 Moroccan public holidays for 2026
- 10 insurance providers (AMO CNSS/CNOPS + mutuelles)
- 6 appointment reasons (PREMIERE, SUIVI, CERTIFICAT, VACCIN, URGENCE, RENOUVELLEMENT)
- 5 document templates (ORDONNANCE, CERTIFICAT, BON_ANALYSE, BON_RADIO, FACTURE)
- Invoice sequence initialized per year

## Actuator & meta (J1) ✅

- `GET /actuator/health` — public — health probe (`{status: UP}`)
- `GET /actuator/info` — public — app info
- `GET /v3/api-docs` — public — OpenAPI JSON (springdoc-openapi)
- `GET /swagger-ui.html` — public — Swagger UI

## How to update this file

When a controller ships, update the section: remove "Not yet implemented", list each endpoint with its final method/path/role/description. If the endpoint differs from the expected list, note why in the same line.
