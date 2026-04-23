# Progress log

Running log of what's shipped. Updated at the end of every session. Read this FIRST when starting a new session.

## Current status

**Phase**: Sprint MVP, setup phase
**Last update**: 2026-04-23
**Build**: not started (no code yet)
**Next action**: J1 — Maven skeleton + docker-compose + Flyway baseline + Security base + CI

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

## How to update this file

At end of every session:
1. Move the *Current status* block to reflect the new state.
2. Append a new dated entry under *Session log* with: shipped / state / next action / blockers.
3. Never rewrite history — only append.
