# Sprint MVP — 8 days (parallel-synchronized full-stack)

Goal: a working **full-stack** application — backend exercisable via Swagger + Postman, frontend pixel-matching the `design/prototype/` hi-fi design across desktop (1440×900) and mobile (iPhone 390×844) for the 6 core MVP workflows. Delivered in 8 working days via parallel-synchronized delivery (ADR-021): as each backend feature ships, the matching frontend screen ports immediately and wires up. Frontend pauses if it catches up to what backend has built — no racing ahead.

## Scope boundary

**Backend in scope (J1–J7):**
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

**Frontend in scope (J8–J10):**
- Vite + React 18 + TypeScript scaffold under `frontend/`
- Design tokens ported from `design/prototype/styles.css` (colors, primary, status palette, fonts, radii) to a single `tokens.css`
- Shared primitive library (`Button`, `Pill`, `Panel`, `Field`, `Input`, `Select`, `Textarea`, `Avatar`, `AllergyChip`, `Icon` set of 30)
- Desktop shell (`<Sidebar>`, `<Topbar>`, `<Screen>`, `<RightPanel>`) + Mobile shell (`<MTopbar>`, `<MScreen>`, `<MTabs>`, `<MFab>`, `<MSheet>`)
- All 13 desktop screens + all 13 mobile screens ported from `design/prototype/screens/*.jsx` and `design/prototype/mobile/screens.jsx`
- React Router for navigation, TanStack Query for backend calls, typed API client
- Static pilot flows first (Login → Agenda → Prise de RDV → Salle → Constantes → Consultation → Prescription → Ordonnance PDF → Facturation), then wire to real backend endpoints
- Responsive strategy: CSS breakpoints `≤640` mobile / `≥1024` desktop (tablet falls back to desktop), per `DESIGN_SYSTEM.md:§5`

**Out of scope (post-MVP):**
- SMS, SSE, backup cloud, WYSIWYG editor, amendments, stupéfiant format, AMO feuille, cash register Z, dashboard, pregnancy, installer Windows, updater, license module, Arabic RTL, Storybook, generated TS client (see `BACKLOG.md → Frontend`).

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

### J2 — identity module (backend) + frontend foundation + login (parallel)

**Backend:**
- [ ] Entities: `User`, `Role`, `AuditLogEntry`
- [ ] `POST /api/auth/login` returns `{accessToken}` (access in body) + sets HttpOnly `careplus_refresh` cookie
- [ ] `POST /api/auth/refresh` (reads cookie, rotates both)
- [ ] `POST /api/auth/logout` (clears cookie, revokes refresh)
- [ ] `GET /api/users/me`
- [ ] Rate limit on login (5 attempts / 15 min / IP) via Bucket4j
- [ ] Integration test: login → access protected → refresh → access → logout → 401
- [ ] Backend regression checkpoint

**Frontend (parallel, pulls auth as it ships):**
- [ ] `frontend/` Vite + React 18 + TypeScript strict scaffolded
- [ ] `@fontsource/*` pinned, `tokens.css` / `desktop.css` / `mobile.css` ported from `design/prototype/`
- [ ] 30 icons ported to `components/icons/*.tsx`
- [ ] Desktop primitives: `Button`, `Pill`, `Panel`, `Field`, `Input`, `Select`, `Textarea`, `Avatar`, `AllergyChip`, `Kbd`
- [ ] Mobile primitives: `MButton`, `MPill`, `MCard`, `MField`, `MRow`, `MSheet` (Vaul), `MFab`, `MStat`, `MDaytab`, `MSegmented`
- [ ] Shells: `<Sidebar>`, `<Topbar>`, `<Screen>`, `<RightPanel>` (desktop) + `<MTopbar>`, `<MTabs>`, `<MScreen>` (mobile)
- [ ] Responsive layout switch at 640px via `useMediaQuery`
- [ ] React Router v6 + TanStack Query client + axios instance + JWT interceptor + Zustand auth store
- [ ] Port **Login** (desktop + mobile) — wires to `POST /api/auth/login` the moment backend ships
- [ ] Port **Onboarding** (desktop + mobile, 7 steps, static until settings backend exists — marked TODO(backend:post-MVP))
- [ ] Vitest + Testing Library + jest-axe + Playwright configured (no specs yet)
- [ ] Spring Boot wired to serve the Vite build from `src/main/resources/static/` (ADR-020)
- [ ] End-of-J2 regression: `mvn verify` + `npm run lint && npm test -- --run && npm run build` both green

### J3 — patient module (backend) + dossier screen (frontend parallel)

**Backend:**
- [ ] Entities: `Patient` (with `tier` NORMAL/PREMIUM, `hasMutuelle`, `insuranceId`, `insurancePolicyNumber`), `Allergy`, `Antecedent` (with `category` enum — 17 values across 6 clinical groups, ADR-023), `PatientNote`
- [ ] `POST /api/patients`, `GET /api/patients/{id}`, `GET /api/patients?q=...` (search), `PUT /api/patients/{id}`, `DELETE /api/patients/{id}` (soft)
- [ ] `POST /api/patients/{id}/allergies`, `POST /api/patients/{id}/antecedents` (required `category`)
- [ ] `POST /api/patients/{id}/notes`, `GET /api/patients/{id}/notes` — free-form médecin notes, timestamped, authored (MEDECIN only)
- [ ] `PUT /api/patients/{id}/tier` (MEDECIN/ADMIN), `PUT /api/patients/{id}/mutuelle` (S/A/M/ADMIN)
- [ ] Search: full-text on last_name + first_name + phone + cin (Postgres tsvector + btree index)
- [ ] Integration test: CRUD happy path + search + tier change + mutuelle change + antecedent per category + patient note authored and visible
- [ ] Permission rules applied via `@PreAuthorize` (tier/notes MEDECIN-gated)
- [ ] Backend regression checkpoint

**Frontend (parallel):**
- [ ] Port **Dossier patient** (desktop + mobile) — tabs, allergy header (Radix Tabs), wired to `/api/patients/{id}`, allergies + antecedents nested resources
- [ ] `usePatients`, `usePatient(id)`, `useCreateAllergy`, `useCreateAntecedent` hooks + zod schemas mirroring backend DTOs
- [ ] Patient search in topbar wired to `GET /api/patients?q=`
- [ ] `design-parity-auditor` pass vs `design/prototype/screens/dossier-patient.jsx`
- [ ] End-of-J3 regression (backend + frontend)

### J4 — scheduling module (backend) + agenda + RDV (frontend parallel)

**Backend:**
- [ ] Entities: `Appointment`, `WorkingHours`, `Holiday`, `AppointmentReason`
- [ ] `GET /api/availability?from=...&to=...&reasonId=...` returns free slots
- [ ] `POST /api/appointments`, `PUT /api/appointments/{id}` (move), `DELETE /api/appointments/{id}` (cancel)
- [ ] Conflict detection (no double-booking except URGENCE)
- [ ] Buffer & working hours respected
- [ ] Moroccan holidays seed (Eid, fête du trône, etc. — 2026 table)
- [ ] Integration test: create, conflict refused, cancel, holiday refused
- [ ] Backend regression checkpoint

**Frontend (parallel):**
- [ ] Port **Agenda semaine** (desktop, week grid, 72px/hr, compact ≤15-min blocks) + mobile **MAgenda** (day timeline + day-tab strip)
- [ ] Port **Prise de RDV** — desktop modal (Radix Dialog), mobile full-screen (Vaul sheet)
- [ ] Hooks: `useAppointments(range)`, `useAvailability`, `useCreateAppointment`, `useMoveAppointment`, `useCancelAppointment`
- [ ] Drag-to-move (desktop) + tap-to-edit (mobile) wired with optimistic updates
- [ ] Conflict + holiday 422s surface as problem+json toasts (Sonner)
- [ ] `design-parity-auditor` pass vs `agenda.jsx` + `prise-rdv.jsx` + mobile variants
- [ ] End-of-J4 regression (backend + frontend)

### J5 — presence + clinical pt1 (backend) + salle/constantes/consultation (frontend parallel)

**Backend:**
- [ ] Flyway V003: `user.can_start_consultation` flag (ADR-023)
- [ ] `POST /api/appointments/{id}/check-in`
- [ ] `GET /api/queue?role=ASSISTANT` returns current queue (polling endpoint)
- [ ] `POST /api/appointments/{id}/vitals` records `VitalSigns`
- [ ] `GET /api/patients/{id}/vitals` returns history
- [ ] `Appointment.type` enum: `CONSULTATION | CONTROLE | URGENCE` (Flyway V003 — add column with default `CONSULTATION`)
- [ ] `POST /api/consultations` starts consultation (state `Brouillon`) — allowed for MEDECIN always, and for SECRETAIRE/ASSISTANT iff `user.canStartConsultation = true` (ADR-023). Clinical content (diagnosis/prescription/sign) MEDECIN-only regardless.
- [ ] `PUT /api/consultations/{id}` updates draft
- [ ] `POST /api/consultations/{id}/sign` transitions to `Signée` (locks) — MEDECIN only
- [ ] `POST /api/consultations/{id}/follow-up` — planifie un RDV de type `CONTROLE` lié à la consultation (`origin_consultation_id`), utilise le même moteur de disponibilité. MEDECIN only.
- [ ] Signing emits `ConsultationSigneeEvent` (listeners added J6/J7)
- [ ] Integration test: (a) full flow check-in → vitals → consultation → sign; (b) habilitated S starts consultation but is 403 on sign/prescribe; (c) non-habilitated S is 403 on start
- [ ] Backend regression checkpoint

**Frontend (parallel):**
- [ ] Port **Salle d'attente** (desktop + mobile) — TanStack Query polling every 15s on `/api/queue`, KPI tiles, status pills
- [ ] Port **Prise des constantes** (desktop + mobile) — large numeric inputs, autosave draft, RHF+zod validation
- [ ] Port **Consultation SOAP** (desktop + mobile) — 4-section editor (Subjectif / Objectif / Analyse / Plan), autosave every 5s, explicit **Signer** action locks the form
- [ ] Hooks: `useQueue`, `useCheckIn`, `useVitals`, `useConsultation`, `useSignConsultation`
- [ ] `design-parity-auditor` pass on all three screens
- [ ] End-of-J5 regression

### J6 — catalog + prescription + PDF (backend) + prescription + ordonnance (frontend parallel)

**Backend:**
- [ ] Entities: `Medication`, `LabTest`, `ImagingExam`, `Act`, `Tariff` (historicized: `effective_from` / `effective_to`, per-tier rows NORMAL/PREMIUM — ADR-023)
- [ ] `GET /api/catalog/medications?q=...`
- [ ] `POST /api/catalog/medications` (add to personal catalog)
- [ ] `GET /api/catalog/acts`, `POST /api/catalog/acts`, `PUT /api/catalog/acts/{id}`, `DELETE /api/catalog/acts/{id}` — MEDECIN/ADMIN (capability `MANAGE_TARIFFS`)
- [ ] `POST /api/catalog/acts/{id}/tariffs` creates a new historical tariff row (closes the previous via `effective_to`)
- [ ] `GET /api/catalog/acts/{id}/tariffs?at=YYYY-MM-DD` resolves effective tariff per tier
- [ ] Entities: `Prescription`, `PrescriptionLine`
- [ ] `POST /api/consultations/{id}/prescriptions` (type: DRUG / LAB / IMAGING / CERT / SICK_LEAVE)
- [ ] Allergy cross-check: blocking 422 if medication matches a patient allergy, override via explicit flag + audit
- [ ] `GET /api/prescriptions/{id}/pdf` returns ordonnance PDF (openhtmltopdf + Thymeleaf template)
- [ ] Editable header stored in `config_document_template` + applied at render
- [ ] Integration test: prescribe drug, allergy blocks, override works, PDF bytes returned
- [ ] Backend regression checkpoint

**Frontend (parallel):**
- [ ] Port **Prescription drawer** (desktop) + **MPrescription** (mobile full-screen) — medication autocomplete wired to `/api/catalog/medications`, penicillin guard renders when backend returns 422 allergy conflict, explicit override checkbox + reason textarea
- [ ] Port **Aperçu ordonnance** — shared `<A4>` primitive with Instrument Serif letterhead, PDF downloaded from `/api/prescriptions/{id}/pdf` and displayed via `<iframe>` or PDF.js
- [ ] Hooks: `useMedicationSearch`, `useCreatePrescription`, `usePrescriptionPdf`
- [ ] Print + envoyer actions wired
- [ ] `design-parity-auditor` pass
- [ ] End-of-J6 regression

### J7 — billing (backend) + facturation + facture (frontend parallel)

**Backend:**
- [ ] Entities: `Invoice`, `InvoiceLine`, `Payment`, `CreditNote`, `ConfigPatientTier` (premium discount percent or fixed — ADR-023)
- [ ] On `ConsultationSigneeEvent` → draft invoice auto-created with the médecin-adjusted total from the consultation. Lines resolved from acts at `signed_at` effective tariff for the patient's tier. Premium discount applied (per-act tariff row wins; else `ConfigPatientTier` default).
- [ ] Mutuelle info (insurance + policy number) copied from patient to invoice at draft time for printing; tiers-payant emission stays post-MVP.
- [ ] `GET /api/invoices/{id}`, `PUT /api/invoices/{id}` (edit draft — S/A/M), `GET /api/invoices?status=...`
- [ ] `PUT /api/consultations/{id}/invoice-total` — médecin-only endpoint to adjust the draft total during WF4 step 9 (before sign)
- [ ] `POST /api/invoices/{id}/issue` → atomic sequential number assignment + immutable PDF — S/M (not A)
- [ ] `POST /api/invoices/{id}/payments` records a payment
- [ ] `POST /api/invoices/{id}/credit-note` issues a credit note
- [ ] Integration test: (a) consultation signed → invoice created → issue → pay → credit note; (b) premium patient gets discounted total; (c) médecin adjusts total pre-sign and the adjusted value is persisted on the draft; (d) historicized tariff — invoicing a past consultation uses the tariff effective at `signed_at`, not today's
- [ ] Backend regression checkpoint

**Frontend (parallel):**
- [ ] Port **Facturation** (desktop) + **MFacturation** (mobile) — TanStack Table v8 on desktop list with sort/filter/pagination, editor drawer for draft invoices, issue/pay/credit-note actions
- [ ] Port **Aperçu facture** — shared `<A4>` primitive, legal mentions (ICE / RC / Patente / IF / CNSS), sequential number rendering
- [ ] Hooks: `useInvoices`, `useInvoice(id)`, `useIssueInvoice`, `useRecordPayment`, `useCreditNote`
- [ ] `design-parity-auditor` pass
- [ ] End-of-J7 regression

### J8 — wrap-up, settings, E2E, tag

- [ ] Port **Paramétrage** (desktop + mobile) — cabinet info, user management, document templates (static MVP, toggles wired where backend supports)
- [ ] Mobile parity sweep: every desktop screen gets a final look against its mobile counterpart in `design/prototype/mobile/screens.jsx`
- [ ] Playwright E2E: 3 specs against real backend (RDV happy path, consultation+sign+PDF, invoice issue+pay)
- [ ] SmokeIT: backend MockMvc end-to-end covering WF1 through WF6
- [ ] Export Postman collection from OpenAPI
- [ ] Update README with full-stack demo walkthrough
- [ ] Final regression — backend + frontend green together
- [ ] Tag `v0.1.0-mvp` on the passing sha

## Exit criteria

- [ ] All J1–J8 checkpoints green
- [ ] `mvn verify` (backend) + `npm run build && npm test` (frontend) green from clean clone on another machine
- [ ] Swagger UI shows every endpoint with examples
- [ ] Postman collection walks the 6 MVP workflows successfully
- [ ] Frontend visually matches `design/prototype/careplus.html` (13 desktop + 13 mobile screens) with gaps documented
- [ ] Playwright E2E tests pass against a live `mvn spring-boot:run` backend
- [ ] `docs/PROGRESS.md` reflects final state
- [ ] `docs/API.md` lists every endpoint with auth requirements
- [ ] `docs/FRONTEND.md` documents component library + screen map
- [ ] Git tag `v0.1.0-mvp` on the sha that passes CI

## Status

See `docs/PROGRESS.md` for the live state. This file is the plan; PROGRESS is the record.
