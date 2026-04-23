# Regression checklist

Run this checklist before **any** of these boundaries:
- Marking a sprint day complete
- Committing to git
- Handing off a session
- Tagging a release

If any item fails, you do NOT cross the boundary. You fix the failure or you stop and log the blocker in `PROGRESS.md`.

## Gate 1 — build & tests

- [ ] `mvn -q clean verify` returns exit code 0
- [ ] Test count is ≥ last recorded count (no tests silently removed)
- [ ] No new deprecation warnings in build output
- [ ] No new `ArchUnitTest` violations (module isolation preserved)

**How**: invoke the `regression-guard` subagent. It runs the command and reports `BASELINE OK` or the first failure.

## Gate 2 — migrations idempotent from scratch

- [ ] `docker compose down -v && docker compose up -d && mvn -q clean verify` still works
- [ ] No migration references a table or column that doesn't yet exist at that migration's point in history
- [ ] Seed data `R__seed_dev.sql` still loads without FK violation

**How**: at the end of J1 and any sprint day that adds migrations, run the above manually. Record the outcome in `PROGRESS.md` (session log).

## Gate 3 — API contract

- [ ] `GET /v3/api-docs` returns 200
- [ ] All endpoints listed in `docs/API.md` are reachable in Swagger UI
- [ ] No endpoint documented in `API.md` is missing from runtime (404)
- [ ] No endpoint exposed at runtime is undocumented in `API.md`

**How**: on J2+, after booting the app (`mvn spring-boot:run`), curl `/v3/api-docs`, diff against `API.md`.

## Gate 4 — smoke test

- [ ] `mvn -q test -Dtest=SmokeIT` passes
- [ ] Smoke test exercises every MVP workflow end-to-end via MockMvc

**How**: J7 onwards only. Before that, per-module `*IT` tests stand in.

## Gate 5 — docs updated

- [ ] `docs/PROGRESS.md` reflects the current state
- [ ] New decisions logged in `docs/DECISIONS.md`
- [ ] New endpoints added to `docs/API.md`
- [ ] Out-of-scope ideas logged in `docs/BACKLOG.md`, not lost

## Gate 6 — commit hygiene

- [ ] Commit message references the sprint day and module (e.g. `J3: patient module + allergies`)
- [ ] No secrets committed (scan `.env`, `application-secrets.yml`, `*.key`, `*.pem`)
- [ ] No `.class`, `target/`, `.idea/`, `*.iml` staged
- [ ] `.gitignore` covers new tooling outputs

## What counts as a regression

- A previously-green test now fails or was deleted without justification
- An endpoint returning 200 now returns 4xx/5xx for an unchanged input
- A migration that worked from-scratch now fails from-scratch
- A documented contract (DTO field, auth requirement) silently changed shape
- Performance of a covered operation degraded beyond the `ARCHITECTURE.md` NFR targets

If any of these happens, the commit that introduces it is to be reverted or fixed before moving to the next sprint day.
