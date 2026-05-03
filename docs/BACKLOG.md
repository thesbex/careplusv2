# Post-MVP backlog

Anything explicitly out of the 7-day MVP goes here. Append-only list of ideas/features/gaps, grouped by theme. Decide priority at MVP exit.

## Clinical

- Consultation amendment (v2, v3… chain) with full audit trace
- Out-of-range vitals alerts (configurable thresholds per cabinet)
- Graphs of vitals over time (weight, blood pressure, glycemia)
- Stupéfiants / psychotropes: enforced ordonnance sécurisée legal format (Moroccan requirements)
- Ordonnance renewal in 1 click for chronic patients
- Chronic condition follow-up module (diabetes HbA1c trend, HTA, asthma peak-flow)
- Vaccination schedule + reminders
- Lab results inbound: mark analysis as "result received", attach PDF, flag doctor
- ICD-10 diagnosis coding (optional autocomplete)
- Templates per consultation type (first visit, follow-up, certificate, vaccination)
- Clinical exam templates by appareil (cardio, pulm, abdo, neuro, ORL)
- Generated courrier de liaison to specialist

## Scheduling & presence

- SMS reminder cron J-1 with opt-in patient response parsing
- Waiting-list with auto-notify on cancellation
- Recurring appointments (chronic patient every 3 months)
- Holiday calendar auto-imported yearly from Moroccan official list
- SSE real-time queue (replace polling)
- Waiting-room display screen (tablet view with "next patient")
- No-show counter per patient, flag after 3 consecutive

## Billing

- Feuille de soins AMO (CNSS, CNOPS, private mutuelles) PDF generation
- Cash register daily close (rapport Z) with per-mode totals
- Insurance claim tracking (generated, submitted, reimbursed, rejected)
- Devis (quote for non-reimbursed acts)
- Relance impayés workflow
- VAT paramétrable per act
- Per-practitioner revenue split (when cabinet → clinic with multiple doctors)

## Pregnancy vertical

- Full pregnancy module (declaration, plan, visits, biometrics, alerts, closure)
- Ultrasound result capture
- Bio panel tracking per trimester
- Auto-create child record on delivery

## Documents & files

- Patient document uploads (scans, photos, PDFs)
- Drag-drop from device camera (mobile PWA)
- WYSIWYG template editor with variable picker
- Multiple templates per document type + selection at print time
- Watermark "copie" on reprinted invoices

## Notifications

- Email + SMS integration (provider abstraction, Moroccan SMS provider)
- In-app notifications center per user
- WhatsApp share link for PDFs (deep link with pre-filled message)

## Admin & ops

- Audit log UI with filters (user, action, entity, date range)
- Backup cloud: daily dump, encryption, upload, rotation, alerts
- Restore from cloud button in admin UI
- Auto-update mechanism (check → download → backup → migrate → restart)
- License module (activation key, feature flags, expiration)
- Multi-language UI (Arabic RTL v2, other Maghreb countries v3)
- Full-text search patient cross-field (tsvector-powered)
- Dashboard: activity KPIs, medical KPIs, financial KPIs, waiting time

## Frontend — moved into MVP scope 2026-04-24

Was "Angular 17 + PrimeNG after backend MVP". Superseded by the hi-fi React prototype delivered from Claude Design (see `design/prototype/` + `design/HANDOFF.md`). Frontend stack changed to **React 18 + Vite + TypeScript** to port the prototype pixel-perfectly. Scope added to `SPRINT_MVP.md` as J8–J10. Remaining post-MVP FE items:

- Generated TypeScript client from OpenAPI spec (nice-to-have; MVP ports screens against hand-rolled fetch hooks first)
- NgRx Signals / Zustand state management audit (after pilot feedback)
- PWA offline-light mode (read-only historical data if backend unreachable)
- i18n layer (Arabic RTL)
- Storybook + Chromatic visual regression (after primitive library stabilises)

## Packaging & distribution

- jpackage Windows installer (.exe, signed MSI)
- Embedded JRE + embedded Postgres installer
- Windows services auto-start
- Uninstaller
- Docker image for cloud deployment
- Helm chart (if any cabinet chain ever needs k8s)

## Compliance

- CNDP declaration template
- Patient consent capture at creation
- Right-of-access export (ZIP of dossier)
- Right-to-be-forgotten: anonymization job
- 10-year retention policy enforcement

## Not in our plan but worth considering

- Teleconsultation (WebRTC) — only if market demand clear, high maintenance cost
- E-prescription national (does not exist in Morocco 2026 — watch)
- Pharmacovigilance reporting to CAPM (adverse effects declaration)
- Integration with Moroccan health insurance electronic claims (none live in 2026)

## How to add an entry

Append under the right theme. No dates, no owners — this is a holding pen until prioritized. When an item is pulled into a sprint, move it to `SPRINT_<NAME>.md` and delete from this file.
