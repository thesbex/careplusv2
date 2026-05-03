# Progress log

Running log of what's shipped. Updated at the end of every session. Read this FIRST when starting a new session.

## Current status

**Phase**: Sprint MVP, J1 complete
**Last update**: 2026-04-23
**Build**: `BUILD SUCCESS` — 8 integration tests green (Testcontainers + Postgres 16)
**Next action**: J2 — identity module (auth, users, JWT, rate limit, refresh token rotation)

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

## How to update this file

At end of every session:
1. Move the *Current status* block to reflect the new state.
2. Append a new dated entry under *Session log* with: shipped / state / next action / blockers.
3. Never rewrite history — only append.
