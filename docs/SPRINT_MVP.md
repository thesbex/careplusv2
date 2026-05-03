# Sprint MVP — 7 days

Goal: a working backend exercisable end-to-end via Swagger + Postman for the 6 core MVP workflows, delivered in 7 working days.

## Scope boundary

**In scope:**
- Patient (fiche + allergies + antécédents)
- Appointments (CRUD + conflict detection + working hours)
- Check-in + simple queue (polling, no SSE)
- Vitals (record + view history, no alerts)
- Consultation (motif + diagnosis + notes + signature lock)
- Prescription (medications, simple seeded catalog, allergy check)
- PDF ordonnance (1 template with editable header)
- Invoice (create + pay + sequential numbering, no AMO)
- JWT auth + 4 roles + basic permission matrix
- Seed data (1 cabinet, 4 users, 20 meds, 5 patients)
- Swagger UI + Postman collection exported

**Out of scope (post-MVP):**
- SMS, SSE, backup cloud, WYSIWYG editor, amendments, stupéfiant format, AMO feuille, cash register Z, dashboard, pregnancy, installer Windows, updater, license module, Angular frontend.

## Day plan

### J1 — Foundation ✅ (shipped 2026-04-23)
- [x] Maven project skeleton, `pom.xml` (Java 21, Spring Boot 3.3)
- [x] `docker-compose.yml` for Postgres 16 + init script extensions
- [x] `application.yml` with profiles `dev` / `test` / `prod-onprem` / `prod-cloud`
- [x] Flyway `V001__baseline.sql` — 25 tables, all MVP modules
- [x] Flyway `V002__reference_data.sql` — roles, holidays 2026, insurances, acts, reasons, working hours, templates
- [x] `R__seed_dev.sql` — 5 patients, 2 allergies, 20 meds, 10 labs, 8 imaging (dev only)
- [x] Spring Security base config (JWT wiring deferred to J2)
- [x] springdoc-openapi integration with JWT scheme
- [x] GitHub Actions CI (JDK 21 Temurin, cache Maven, verify, report upload on fail)
- [x] Smoke test `ApplicationSmokeIT` — 8 assertions via Testcontainers
- [x] Regression checkpoint — BUILD SUCCESS, 8/8 tests green
- [x] `.mvn/settings.xml` + `.mvn/maven.config` (bypass corp Nexus)
- [x] 5 slash commands in `.claude/commands/`

### J2 — identity module
- [ ] Entities: `User`, `Role`, `AuditLogEntry`
- [ ] `POST /api/auth/login` returns `{accessToken, refreshToken}`
- [ ] `POST /api/auth/refresh`
- [ ] `POST /api/auth/logout`
- [ ] `GET /api/users/me`
- [ ] Rate limit on login (5 attempts / 15 min / IP) via Bucket4j
- [ ] Integration test: login → access protected endpoint → refresh → access again
- [ ] Regression checkpoint

### J3 — patient module
- [ ] Entities: `Patient`, `Allergy`, `Antecedent`
- [ ] `POST /api/patients`, `GET /api/patients/{id}`, `GET /api/patients?q=...` (search), `PUT /api/patients/{id}`, `DELETE /api/patients/{id}` (soft)
- [ ] `POST /api/patients/{id}/allergies`, `POST /api/patients/{id}/antecedents`
- [ ] Search: full-text on last_name + first_name + phone + cin (Postgres tsvector + btree index)
- [ ] Integration test: CRUD happy path + search
- [ ] Permission rules applied via `@PreAuthorize`
- [ ] Regression checkpoint

### J4 — scheduling module
- [ ] Entities: `Appointment`, `WorkingHours`, `Holiday`, `AppointmentReason`
- [ ] `GET /api/availability?from=...&to=...&reasonId=...` returns free slots
- [ ] `POST /api/appointments`, `PUT /api/appointments/{id}` (move), `DELETE /api/appointments/{id}` (cancel)
- [ ] Conflict detection (no double-booking except URGENCE)
- [ ] Buffer & working hours respected
- [ ] Moroccan holidays seed (Eid, fête du trône, etc. — 2026 table)
- [ ] Integration test: create, conflict refused, cancel, holiday refused
- [ ] Regression checkpoint

### J5 — presence + clinical (part 1)
- [ ] `POST /api/appointments/{id}/check-in`
- [ ] `GET /api/queue?role=ASSISTANT` returns current queue (polling endpoint)
- [ ] `POST /api/appointments/{id}/vitals` records `VitalSigns`
- [ ] `GET /api/patients/{id}/vitals` returns history
- [ ] `POST /api/consultations` starts consultation (state `Brouillon`)
- [ ] `PUT /api/consultations/{id}` updates draft
- [ ] `POST /api/consultations/{id}/sign` transitions to `Signée` (locks)
- [ ] Signing emits `ConsultationSigneeEvent` (listeners added J6/J7)
- [ ] Integration test: walk the full flow check-in → vitals → consultation → sign
- [ ] Regression checkpoint

### J6 — catalog + clinical (part 2: prescription) + documents (PDF)
- [ ] Entities: `Medication`, `LabTest`, `ImagingExam`, `Act`, `Tariff`
- [ ] `GET /api/catalog/medications?q=...`
- [ ] `POST /api/catalog/medications` (add to personal catalog)
- [ ] Entities: `Prescription`, `PrescriptionLine`
- [ ] `POST /api/consultations/{id}/prescriptions` (type: DRUG / LAB / IMAGING / CERT / SICK_LEAVE)
- [ ] Allergy cross-check: blocking 422 if medication matches a patient allergy, override via explicit flag + audit
- [ ] `GET /api/prescriptions/{id}/pdf` returns ordonnance PDF (openhtmltopdf + Thymeleaf template)
- [ ] Editable header stored in `config_document_template` + applied at render
- [ ] Integration test: prescribe drug, allergy blocks, override works, PDF bytes returned
- [ ] Regression checkpoint

### J7 — billing + wrap-up
- [ ] Entities: `Invoice`, `InvoiceLine`, `Payment`, `CreditNote`
- [ ] On `ConsultationSigneeEvent` → draft invoice auto-created
- [ ] `GET /api/invoices/{id}`, `PUT /api/invoices/{id}` (edit draft)
- [ ] `POST /api/invoices/{id}/issue` → atomic sequential number assignment + immutable PDF
- [ ] `POST /api/invoices/{id}/payments` records a payment
- [ ] `POST /api/invoices/{id}/credit-note` issues a credit note
- [ ] Integration test: consultation signed → invoice created → issue → pay → credit note
- [ ] SmokeIT: end-to-end workflow covering WF1 through WF6 via MockMvc
- [ ] Export Postman collection from OpenAPI
- [ ] Update README with demo walkthrough
- [ ] Final regression checkpoint + tag `v0.1.0-mvp`

## Exit criteria

- [ ] All J1–J7 checkpoints green
- [ ] `mvn verify` green from clean clone on another machine
- [ ] Swagger UI shows every endpoint with examples
- [ ] Postman collection walks the 6 MVP workflows successfully
- [ ] `docs/PROGRESS.md` reflects final state
- [ ] `docs/API.md` lists every endpoint with auth requirements
- [ ] Git tag `v0.1.0-mvp` on the sha that passes CI

## Status

See `docs/PROGRESS.md` for the live state. This file is the plan; PROGRESS is the record.
