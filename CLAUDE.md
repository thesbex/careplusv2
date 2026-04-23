# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**careplus** — Système d'Information de Cabinet Médical (SICM) for Moroccan general practitioners. Greenfield rewrite of the legacy `carePlus/` Spring Boot 2.4 project sitting next door. Target deployment: hybride (on-premise at cabinet + encrypted auto-backup to OVH Object Storage Casablanca).

**Not** a multi-tenant SaaS in v1. One installation per cabinet. Commercial model: monthly subscription, managed manually (no license module in v1).

## Authoritative documents (read these BEFORE editing code)

- [docs/WORKFLOWS.md](docs/WORKFLOWS.md) — business workflows, state machines, role × action matrix. The product spec.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module structure, stack, conventions, data model principles.
- [docs/SPRINT_MVP.md](docs/SPRINT_MVP.md) — 7-day MVP plan with day-by-day scope and status.
- [docs/DECISIONS.md](docs/DECISIONS.md) — ADRs for every significant technical choice.
- [docs/PROGRESS.md](docs/PROGRESS.md) — running log of what's done, updated at end of every session.
- [docs/API.md](docs/API.md) — endpoint inventory, filled as modules ship.
- [docs/REGRESSION_CHECKLIST.md](docs/REGRESSION_CHECKLIST.md) — the checklist that must pass before marking any iteration done.

## Non-negotiable rules for every session

1. **Read `docs/PROGRESS.md` first.** It tells you where we stopped and what's next.
2. **Never mark work done without `mvn verify` green.** Use the `regression-guard` subagent to verify. If Docker is down, Testcontainers fails → that's a blocker, not "will fix later".
3. **No regressions between iterations.** Every new module ships with integration tests. Every commit runs the full suite in CI.
4. **Update `docs/PROGRESS.md` at the end of each session.** What shipped, what's blocked, what's next. This is the session handoff.
5. **Update `docs/DECISIONS.md` when you choose A over B.** One-paragraph ADR, no ceremony.
6. **Never modify an applied Flyway migration.** Add a new one.
7. **Stay in scope.** MVP scope is defined in `SPRINT_MVP.md`. Anything out of scope goes to `docs/BACKLOG.md` (create if needed), not into code.

## Tech stack (frozen for MVP)

- Java 21 (LTS)
- Spring Boot 3.3.x + Spring MVC (NOT WebFlux)
- PostgreSQL 16 (via Docker for dev, embedded Postgres Windows for prod on-premise)
- Flyway 10.x for migrations
- Spring Data JPA + Hibernate 6
- MapStruct 1.5 for mapping
- Spring Security + JWT (nimbus-jose-jwt)
- springdoc-openapi 2.x for API docs
- openhtmltopdf + Thymeleaf for PDFs
- Testcontainers for integration tests (Postgres)
- Maven (mono-module in MVP, will split to multi-module post-MVP)

## Build & run

See `README.md` for the user-facing version. Claude-specific:

```bash
# first run
docker compose up -d              # start Postgres on :5432
mvn -q clean verify               # full build + tests (Flyway applies migrations)
mvn spring-boot:run               # app on :8080, swagger at /swagger-ui.html

# common
mvn -q test                       # unit + integration tests
mvn -q test -Dtest=PatientIT      # single test class
mvn -q spring-boot:run -Dspring-boot.run.profiles=dev

# regression guard (before commit)
# -> invoke the `regression-guard` subagent, which runs `mvn -q clean verify`
```

## Conventions (quick reference — full detail in ARCHITECTURE.md)

- Package root: `ma.careplus`
- Per module: `ma.careplus.<module>.{domain,application,infrastructure.web,infrastructure.persistence}`
- JPA annotations on **fields**, not getters
- Records for DTOs
- UUID ids, `TIMESTAMPTZ` timestamps
- Soft delete via `deleted_at` (patient-medical tables only; NOT on invoices — immutable by law)
- `created_at`, `updated_at` on every table (via `@PrePersist` / `@PreUpdate` or `BaseEntity`)
- `version` column for optimistic locking on mutable aggregates
- Inter-module communication via Spring `ApplicationEventPublisher` + `@TransactionalEventListener(phase = AFTER_COMMIT)`
- No cross-module repository or entity access. Events only.

## Custom subagents available

- `regression-guard` — runs `mvn verify`, reports baseline. Invoke before commit / end of day / start of session.
- `backend-module-scaffolder` — scaffolds a new bounded context with all layers + tests. Invoke when starting a new module.

Both live in `.claude/agents/`.

## Session handoff protocol

At the end of every session (even incomplete ones):

1. Run `regression-guard` subagent. Record result in `docs/PROGRESS.md`.
2. Update `docs/PROGRESS.md`:
   - What was shipped this session
   - Current state (green / red)
   - What's next (specific, not "continue module X")
   - Any blocker
3. If any decision was made that future you needs to know → add entry to `docs/DECISIONS.md`.
4. Commit with a message referencing the sprint day and module (e.g. `J3: patient module + allergies`).

This is how any new session has full context without reading the chat.
