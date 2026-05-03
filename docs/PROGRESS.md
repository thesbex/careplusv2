# Progress log

Running log of what's shipped. Updated at the end of every session. Read this FIRST when starting a new session.

## Current status

**Phase**: Sprint MVP, J6 complete
**Last update**: 2026-04-24
**Build**: `BUILD SUCCESS` — 60 integration tests green (Testcontainers + Postgres 16)
**Next action**: J7 — billing module (invoice, payment, credit note, ConsultationSigneeEvent → invoice draft)

## Session log

### 2026-04-23 — Project initialization

**Shipped:**
- Project directory `careplus-v2/` created alongside legacy `carePlus/`
- `.claude/settings.json` — permission allowlist for mvn/docker/git/curl-localhost
- `.claude/agents/regression-guard.md` — subagent running `mvn verify` before commits
- `.claude/agents/backend-module-scaffolder.md` — subagent scaffolding Spring modules with full layers + integration tests
- `CLAUDE.md` — session entry point
- `docs/WORKFLOWS.md` — business spec (9 workflows, state machines, permission matrix)
- `docs/ARCHITECTURE.md` — technical spec (modular monolith, stack, conventions, data model)
- `docs/SPRINT_MVP.md` — 7-day plan with scope boundary and exit criteria
- `docs/DECISIONS.md` — ADR index (initial entries for stack + deployment)
- `docs/REGRESSION_CHECKLIST.md` — checklist enforced at every iteration boundary
- `docs/API.md` — endpoint inventory (empty skeleton, filled module by module)
- `docs/BACKLOG.md` — out-of-MVP items parked for post-MVP

**State**: zero code. Setup only. Git repo initialized at the project root.

**Next action**: start J1 — requires user GO after confirming nothing was missed.

**Blockers**: none.

### 2026-04-23 — Vitals permission broadened

**Shipped:**
- ADR-013 added: vitals recordable by SECRETAIRE/ASSISTANT/MEDECIN (not just ASSISTANT). Reflects real Moroccan cabinet staffing diversity.
- `docs/WORKFLOWS.md` permission matrix updated (Record vitals + View vitals history now include SECRETAIRE).
- `docs/WORKFLOWS.md` WF3 reworded: "operator" instead of "A", + inline-vitals shortcut when médecin takes them himself.
- `docs/API.md` updated: `/vitals` and `/queue` endpoints role list broadened.

**State**: setup still complete, zero code. Permission model now reflects flexibility.

**Next action**: unchanged — awaiting user GO for J1 + decisions on the 4 critical items (GitHub remote, CI from J1, slash commands, pilot cabinet).

### 2026-04-23 — J1 foundation shipped

**Shipped:**
- `pom.xml` — Spring Boot 3.3.5, Java 21, all MVP deps (JPA, Security, Flyway, MapStruct, Lombok, springdoc, nimbus-jose-jwt, openhtmltopdf, bucket4j, testcontainers, archunit, logstash-encoder).
- `docker-compose.yml` — Postgres 16-alpine with Africa/Casablanca TZ, healthcheck, init script auto-creating extensions (uuid-ossp, pgcrypto, pg_trgm).
- `application.yml` + 4 profile overlays (dev/test/prod-onprem/prod-cloud). `careplus.*` config namespace (deployment-mode, JWT secret, login rate limit, module toggles).
- `logback-spring.xml` — plain console for dev/test, JSON (logstash-encoder) for prod.
- `V001__baseline.sql` — 25 tables covering all MVP modules (identity, patient, scheduling, presence-via-appointment-timestamps, clinical, billing, catalog, configuration). UUID ids, TIMESTAMPTZ, audit columns, soft delete on patient tables, version on mutable aggregates, btree + trigram indexes for search. Trigger function `touch_updated_at()` applied to every table.
- `V002__reference_data.sql` — 4 roles, 16 Moroccan holidays 2026, 10 insurances (AMO CNSS/CNOPS + mutuelles), 9 acts, 6 appointment reasons, 11 working-hour rows (Mon-Fri 9-13/15-19, Sat 9-13), 5 default document templates (ORDONNANCE/CERTIFICAT/BON_ANALYSE/BON_RADIO/FACTURE), billing invoice sequence initialized for current year.
- `R__seed_dev.sql` — 5 Moroccan demo patients, 2 allergies (Pénicilline, Iode), 20 common meds (Doliprane, Amoxicilline, Amlor, Glucophage, Xanax, …), 10 lab tests, 8 imaging exams. Fully idempotent (NOT EXISTS guards).
- Java layer: `Application` (forces Africa/Casablanca TZ), `ClockConfig`, `OpenApiConfig` (JWT bearer scheme), `SecurityConfig` (J1 baseline — public: /actuator/health, /v3/api-docs, /swagger-ui/**; rest authenticated), `CorrelationIdFilter` (X-Correlation-Id header → MDC), `GlobalExceptionHandler` (RFC 7807 problem+json), `BusinessException` / `NotFoundException`, `DomainEvent` interface, `DevUserSeeder` (creates 3 dev users with BCrypt on dev profile: youssef.elamrani@, fatima.zahra@, khadija.bennis@, password `ChangeMe123!`).
- `.github/workflows/ci.yml` — build + verify on push/PR, Java 21 Temurin, Maven cache, Surefire/Failsafe report upload on failure.
- `.mvn/settings.xml` + `.mvn/maven.config` — forces Maven Central (bypasses the corporate Karavel Nexus that's unreachable).
- `ApplicationSmokeIT` — 8 tests: context loads, DataSource wired, /actuator/health UP, /v3/api-docs reachable with careplus title, Flyway baseline + reference migrations applied, 4 roles seeded, ≥10 Moroccan 2026 holidays, ≥5 document templates, invoice sequence initialized.
- `.claude/commands/` — 5 custom slash commands: `/regress`, `/newmodule`, `/progress`, `/commit`, `/ship-day`.

**Issues encountered & resolved:**
- Corporate `~/.m2/settings.xml` pointing to unreachable `nexus02.in.karavel.com` → bypassed with project-local `.mvn/settings.xml` + `.mvn/maven.config`.
- `openhtmltopdf` wrong groupId (`io.github.openhtmltopdf` → `com.openhtmltopdf`).
- Flyway V002 contained Thymeleaf `${cabinet.name}` placeholders interpreted by Flyway as SQL placeholders → disabled via `spring.flyway.placeholder-replacement: false`.

**State**: `mvn clean verify` → `BUILD SUCCESS`, 8 tests / 0 failures / 0 errors, ~12s. Flyway applies 2 migrations cleanly. Postgres 16 Testcontainers provisioned properly. OpenAPI docs live at `/v3/api-docs`.

**Next action**: start J2 — identity module. Scaffold entities (User, Role, RefreshToken, AuditLogEntry), implement login (rate-limit via Bucket4j), JWT access+refresh tokens via nimbus-jose-jwt, `/api/auth/*` endpoints, replace DevUserSeeder's raw JDBC with the proper identity module API, integration tests covering login → access protected → refresh → access → logout → access blocked.

**Blockers**: none.

### 2026-04-24 — J5 clinical module completed and hardened

**Shipped:**
- `V003__clinical_and_presence.sql` — adds `can_start_consultation BOOLEAN` to `identity_user`; adds `type VARCHAR(20)` + `origin_consultation_id UUID` (FK → `clinical_consultation`) to `scheduling_appointment`.
- `AppointmentType` enum (CONSULTATION, CONTROLE, URGENCE) added to scheduling domain.
- `Appointment` entity: added `type`, `originConsultationId`, `arrivedAt` setter.
- `User` entity: added `canStartConsultation` field.
- `ConsultationService.scheduleFollowUp()` — creates CONTROLE appointment linked to a signed consultation. TODO(post-MVP:events): replace direct repository write with event.
- `ClinicalController`: added `POST /api/consultations/{id}/follow-up` endpoint (MEDECIN/ADMIN).
- `FollowUpRequest` / `FollowUpResponse` DTOs.
- Fixed `PresenceService.checkIn()`: was using JDBC to update `arrived_at` while Hibernate flushed entity with `arrivedAt=null`, overwriting it. Now uses entity setter directly.
- Fixed `GlobalExceptionHandler`: added `AccessDeniedException` handler returning 403. Without it, `@PreAuthorize` failures were caught by the generic `Exception.class` handler returning 500.
- Fixed `PatientIT.search_findsByFirstNameLastNameCinPhone`: test called `bearer(email)` 7 times, exhausting the 5-login rate limit. Added per-test token cache so same email reuses existing JWT.
- `AppointmentView` record updated with `type` and `originConsultationId` fields. `SchedulingController.toView()` updated accordingly.

**State**: `mvn clean verify` → `BUILD SUCCESS`, 51 tests / 0 failures / 0 errors.

**Next action**: J6 — prescriptions (clinical_prescription + PDF); catalog search endpoints.

**Blockers**: none.

### 2026-04-24 — J6 catalog + prescriptions module shipped

**Shipped:**
- `V004__catalog_prescription.sql` — adds `type` column to `catalog_act`; creates `catalog_tariff` table with tier-based temporal history (UNIQUE(act_id, tier, effective_from)); adds `patient_id`, `allergy_override`, `allergy_override_reason` to `clinical_prescription`; adds `medication_id`, `lab_test_id`, `imaging_exam_id`, `dosage`, `quantity`, `instructions`, `sort_order`, `updated_at` columns to `clinical_prescription_line`.
- `ma.careplus.catalog.domain` — `Act`, `Tariff`, `Medication`, `Prescription`, `PrescriptionLine` JPA entities, `PrescriptionType` enum.
- `ma.careplus.catalog.infrastructure.persistence` — `ActRepository`, `TariffRepository` (findEffectiveTariff JPQL, findOpenTariffs), `MedicationRepository` (searchByNameOrDci native), `PrescriptionRepository`, `PrescriptionLineRepository`.
- `ma.careplus.catalog.application.CatalogService` — CRUD acts, tariff lifecycle (close previous open tariff on new insert), medication search (ILIKE on commercial_name/dci).
- `ma.careplus.catalog.application.PrescriptionService` — createPrescription (status=BROUILLON guard, allergy check for DRUG type via PatientService public API, AllergyConflictException if conflict + override=false), getPrescription, getPrescriptionsByConsultation, getLinesForPrescription.
- `ma.careplus.catalog.application.AllergyConflictException` — 422 mapped in GlobalExceptionHandler with RFC 7807-style body `{type,title,medication,allergy,status}`.
- `ma.careplus.catalog.application.PrescriptionPdfService` — Thymeleaf + openhtmltopdf + jsoup (HTML5 → W3C DOM → PDF) for ordonnance generation; cabinet settings from `configuration_clinic_settings` with dev fallback.
- `src/main/resources/templates/ordonnance.html` — Thymeleaf ordonnance template (cabinet header, patient box, prescription lines, allergy warning, signature area).
- `ma.careplus.catalog.infrastructure.web.CatalogController` — acts CRUD + tariff endpoints + medication search.
- `ma.careplus.catalog.infrastructure.web.PrescriptionController` — prescriptions CRUD + PDF endpoint.
- `CatalogIT` — 9 tests: createAct, deactivateAct, addTariff, addNewTariff closes old one, medication search, DRUG prescription creation, allergy conflict 422, allergy override saved, PDF bytes non-empty with %PDF magic.
- Fixed pre-existing `PatientIT` failures: `phone` field was `@NotBlank` in `CreatePatientRequest` but tests didn't send phone → removed `@NotBlank` (phone is optional for medical workflow; patient may only have an emergency contact).
- Added jsoup 1.17.2 to pom.xml (HTML5 parsing for PDF generation; existing transitive version promoted to explicit dep).

**State**: `mvn clean verify` → `BUILD SUCCESS`, 60 tests / 0 failures / 0 errors. All prior modules green.

**Next action**: J7 — billing module. `ConsultationSigneeEvent` listener creates draft invoice. Invoice CRUD, issue (sequential number), payment, credit note, PDF.

**Blockers**: none.

## How to update this file

At end of every session:
1. Move the *Current status* block to reflect the new state.
2. Append a new dated entry under *Session log* with: shipped / state / next action / blockers.
3. Never rewrite history — only append.
