---
description: Scaffold a new backend module (Flyway migration, entity, repo, service, controller, DTO, mapper, IT test)
argument-hint: <module-name>
---

Invoke the `backend-module-scaffolder` subagent with module name `$ARGUMENTS`. The agent reads `CLAUDE.md` + `docs/ARCHITECTURE.md` first, then produces:

- `src/main/java/ma/careplus/$ARGUMENTS/` with `domain/`, `application/`, `infrastructure/{web,persistence}/`
- A new Flyway migration `Vxxx__$ARGUMENTS_baseline.sql` (never edit existing migrations)
- A matching integration test `${ArgumentsCapitalized}IT.java` using Testcontainers + MockMvc
- Updates to `docs/API.md` (new endpoints) and `docs/PROGRESS.md` (module status)

Run `mvn -q test -Dtest=${ArgumentsCapitalized}IT` before reporting. Report files created, migration version, endpoints exposed, events, and test result.
