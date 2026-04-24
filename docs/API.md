# API inventory

Runtime truth is at `/swagger-ui.html` and `/v3/api-docs`. This file is the human-readable map, filled module by module as they ship.

Format: `METHOD /path` — role required — short description.

## identity (J2)

_Not yet implemented._

Expected:
- `POST /api/auth/login` — public — email + password → `{accessToken, refreshToken}`
- `POST /api/auth/refresh` — public (refresh token in header) → new access token
- `POST /api/auth/logout` — authenticated → revokes refresh token
- `GET /api/users/me` — authenticated → current user profile

## patient (J3)

_Not yet implemented._

Expected:
- `POST /api/patients` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN
- `GET /api/patients` — same — query params: `q`, `page`, `size`
- `GET /api/patients/{id}` — same
- `PUT /api/patients/{id}` — same
- `DELETE /api/patients/{id}` — MEDECIN/ADMIN — soft delete
- `POST /api/patients/{id}/allergies` — MEDECIN
- `DELETE /api/patients/{id}/allergies/{allergyId}` — MEDECIN
- `POST /api/patients/{id}/antecedents` — MEDECIN

## scheduling (J4)

_Not yet implemented._

Expected:
- `GET /api/availability` — all roles — free slots between `from` and `to` for a `reasonId`
- `POST /api/appointments` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN
- `GET /api/appointments` — same — filters: date, patientId, status
- `GET /api/appointments/{id}` — same
- `PUT /api/appointments/{id}` — same — move or change details
- `DELETE /api/appointments/{id}` — same — cancel with reason
- `GET /api/working-hours` — all — cabinet hours

## presence + clinical (J5) ✅

- `POST /api/appointments/{id}/check-in` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — stamps arrived_at, transitions PLANIFIE/CONFIRME → ARRIVE
- `GET /api/queue` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — today's queue (ARRIVE, EN_ATTENTE_CONSTANTES, CONSTANTES_PRISES, EN_CONSULTATION), ordered by start_at
- `POST /api/appointments/{id}/vitals` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — records vital signs, advances appointment to CONSTANTES_PRISES, auto-computes BMI
- `GET /api/patients/{patientId}/vitals` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — vitals history for a patient, newest first
- `POST /api/consultations` — MEDECIN/ADMIN — starts a draft consultation linked to an appointment, advances to EN_CONSULTATION
- `GET /api/consultations/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — fetch consultation
- `PUT /api/consultations/{id}` — MEDECIN/ADMIN — update draft fields (motif, examination, diagnosis, notes); 409 if already SIGNEE
- `POST /api/consultations/{id}/sign` — MEDECIN/ADMIN — locks consultation (SIGNEE), stamps signed_at, publishes ConsultationSigneeEvent, advances appointment to CONSULTATION_TERMINEE
- `POST /api/consultations/{id}/follow-up` — MEDECIN/ADMIN — creates CONTROLE appointment with origin_consultation_id set

## catalog + prescriptions (J6) ✅

### Acts and tariffs
- `GET /api/catalog/acts` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list all active acts
- `POST /api/catalog/acts` — MEDECIN/ADMIN — create act (code, name, type)
- `PUT /api/catalog/acts/{id}` — MEDECIN/ADMIN — update act name/type
- `DELETE /api/catalog/acts/{id}` — MEDECIN/ADMIN — deactivate act (soft: sets active=false)
- `POST /api/catalog/acts/{id}/tariffs` — MEDECIN/ADMIN — add tier tariff (closes previous open row for same act+tier)
- `GET /api/catalog/acts/{id}/tariffs` — all roles — tariff history for act

### Medications
- `GET /api/catalog/medications?q=` — all roles — search by commercial name or DCI (molecule); limit 20

### Prescriptions
- `POST /api/consultations/{consultationId}/prescriptions` — MEDECIN/ADMIN — creates prescription + lines; enforces BROUILLON status; checks patient allergies for DRUG prescriptions (422 AllergyConflict unless allergyOverride=true)
- `GET /api/consultations/{consultationId}/prescriptions` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — list prescriptions for consultation
- `GET /api/prescriptions/{id}` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN — get prescription with lines
- `GET /api/prescriptions/{id}/pdf` — MEDECIN/ADMIN — generate and stream ordonnance PDF (openhtmltopdf + Thymeleaf), Content-Type application/pdf

## billing (J7)

_Not yet implemented._

Expected:
- `GET /api/invoices/{id}` — SECRETAIRE/MEDECIN/ADMIN
- `PUT /api/invoices/{id}` — SECRETAIRE/MEDECIN/ADMIN — edit draft only
- `POST /api/invoices/{id}/issue` — SECRETAIRE/MEDECIN/ADMIN — atomic number + PDF
- `GET /api/invoices/{id}/pdf` — SECRETAIRE/MEDECIN/ADMIN
- `POST /api/invoices/{id}/payments` — SECRETAIRE/MEDECIN/ADMIN
- `POST /api/invoices/{id}/credit-note` — SECRETAIRE/MEDECIN/ADMIN

## configuration (J1 baseline, extended J7)

_Partially expected on J1._

Expected:
- `GET /api/config/cabinet` — all — read cabinet info
- `PUT /api/config/cabinet` — ADMIN — update cabinet info
- `GET /api/config/working-hours` — all
- `PUT /api/config/working-hours` — ADMIN
- `GET /api/config/document-templates` — ADMIN
- `PUT /api/config/document-templates/{type}` — ADMIN — update template HTML

## Actuator & meta (J1) ✅

- `GET /actuator/health` — public — health probe
- `GET /actuator/info` — public — info
- `GET /v3/api-docs` — public in J1 (will tighten in J2) — OpenAPI JSON
- `GET /swagger-ui.html` — public in J1 — Swagger UI

## How to update this file

When a controller ships, update the section: remove "Not yet implemented", list each endpoint with its final method/path/role/description. If the endpoint differs from the expected list, note why in the same line.
