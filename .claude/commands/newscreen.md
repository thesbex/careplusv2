---
description: Scaffold a frontend screen/feature slice (route, page, desktop + mobile variants, data hook, zod schema, test) — mirrors a prototype under `design/prototype/`
argument-hint: <screen-name>
---

Invoke the `frontend-module-scaffolder` subagent with screen name `$ARGUMENTS`. The agent reads `CLAUDE.md`, `docs/FRONTEND.md`, `design/prototype/DESIGN_SYSTEM.md`, and the matching prototype files first, then produces:

- `frontend/src/features/$ARGUMENTS/` with `$ArgumentsCapitalizedPage.tsx`, `$ArgumentsCapitalizedPage.mobile.tsx`, `components/`, `hooks/`, `schemas/`, `__tests__/`
- `frontend/src/routes/$ARGUMENTS.route.tsx` lazy-loaded route
- Updates to `docs/FRONTEND.md` (screen status) and `docs/PROGRESS.md` (port status)

The agent MUST open and port from:
- `design/prototype/screens/$ARGUMENTS.jsx` (desktop)
- the matching `M$ArgumentsCapitalized` block in `design/prototype/mobile/screens.jsx` (mobile)

No deviations from the prototype during port. Once scaffolded, run `npm test -- --run $ARGUMENTS` and then hand off to `design-parity-auditor` for a diff against the prototype. Report files created, primitives used, design drift (if any), and test result.
