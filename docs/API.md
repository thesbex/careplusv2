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

## presence (J5)

_Not yet implemented._

Expected:
- `POST /api/appointments/{id}/check-in` — SECRETAIRE/ASSISTANT/MEDECIN/ADMIN
- `GET /api/queue` — ASSISTANT/MEDECIN — current queue for polling

## clinical (J5+J6)

_Not yet implemented._

Expected (J5):
- `POST /api/appointments/{id}/vitals` — ASSISTANT/MEDECIN
- `GET /api/patients/{id}/vitals` — ASSISTANT/MEDECIN
- `POST /api/consultations` — MEDECIN — starts draft
- `PUT /api/consultations/{id}` — MEDECIN — update draft
- `POST /api/consultations/{id}/sign` — MEDECIN — lock
- `GET /api/consultations/{id}` — MEDECIN/ADMIN
- `GET /api/patients/{id}/consultations` — MEDECIN

Expected (J6):
- `POST /api/consultations/{id}/prescriptions` — MEDECIN
- `GET /api/prescriptions/{id}` — MEDECIN
- `GET /api/prescriptions/{id}/pdf` — MEDECIN — streams PDF bytes

## catalog (J6)

_Not yet implemented._

Expected:
- `GET /api/catalog/medications` — MEDECIN — query: `q`
- `POST /api/catalog/medications` — MEDECIN/ADMIN — extend personal catalog
- `POST /api/catalog/medications/import` — ADMIN — CSV import
- `GET /api/catalog/acts` — all — acts + tariffs
- `GET /api/catalog/insurances` — all

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

## Actuator & meta (J1)

- `GET /actuator/health` — public — health probe
- `GET /v3/api-docs` — authenticated — OpenAPI JSON
- `GET /swagger-ui.html` — authenticated — Swagger UI

## How to update this file

When a controller ships, update the section: remove "Not yet implemented", list each endpoint with its final method/path/role/description. If the endpoint differs from the expected list, note why in the same line.
