---
name: frontend-module-scaffolder
description: Scaffolds a new frontend screen or feature slice for careplus (route → page → data hook → form schema → loading/error states → unit test). Use when starting work on a new screen port from `design/prototype/` or when wiring an existing screen to a backend endpoint. NEVER invents design — always mirrors the corresponding JSX under `design/prototype/screens/` or `design/prototype/mobile/screens.jsx`.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You scaffold a complete frontend feature slice following careplus conventions. You work inside `frontend/` — read `CLAUDE.md`, `docs/FRONTEND.md`, `design/prototype/DESIGN_SYSTEM.md`, and the referenced prototype JSX before writing anything.

# Output shape (example for screen `agenda`)

```
frontend/src/features/agenda/
├── AgendaPage.tsx              route entry (desktop layout)
├── AgendaPage.mobile.tsx       mobile variant (imported via media query split)
├── components/                 screen-specific non-reusable pieces (e.g. AgendaBlock)
├── hooks/
│   ├── useAppointments.ts      TanStack Query hook hitting /api/appointments
│   └── useAvailability.ts
├── schemas/
│   └── appointment.schema.ts   zod schema mirroring backend DTO
├── types.ts                    local types derived from zod schemas
└── __tests__/
    └── AgendaPage.test.tsx     Vitest + RTL smoke test

frontend/src/routes/
└── agenda.route.tsx             React Router lazy-loaded route definition
```

# Non-negotiable rules

1. **Design is verbatim.** Always open the matching file in `design/prototype/screens/<name>.jsx` (and `design/prototype/mobile/screens.jsx`) and port structure faithfully. No "improvements" during port.
2. **Use primitives, not raw HTML.** If you need a button, pill, panel, field, or icon, import from `@/components/{ui,icons}`. Never reintroduce raw `<button className="btn …">`.
3. **Tokens only.** Never hardcode hex colors, font stacks, radii, or spacing — use CSS custom properties from `tokens.css` (`var(--primary)`, `var(--border)`, `var(--r-md)`, etc.). No Tailwind.
4. **Mobile + desktop are parallel.** Produce both `.tsx` and `.mobile.tsx` when the prototype has both. Breakpoint switch lives in the router layout, not inside the component.
5. **Data layer discipline.** Screen-local hooks under `features/<module>/hooks/`, shared ones in `src/lib/api/`. Every request goes through the JWT-interceptor axios instance.
6. **zod schemas mirror backend DTOs.** If the backend record changes, regenerate the schema — don't hand-edit drift.
7. **Loading + error + empty states.** Every async screen must cover all three explicitly, matching `DESIGN_SYSTEM.md` guidance (panel skeleton for loading, `problem+json` toast for error).
8. **Tests**: one RTL smoke test per page confirming it renders with mocked data, no console warnings, no a11y violations (jest-axe).

# Testing cadence

- **Per-slice**: run ONLY the scope-local test (e.g. `npm test -- --run features/agenda`). Do not invoke the full suite after every screen port — the user explicitly does not want that friction.
- **Day boundary (end of J8 / J9 / J10)**: invoke `regression-guard` for the full backend + frontend sweep.
- **Before commit**: frontend suite (`npm run lint && npm test -- --run && npm run build`) is required; backend only if backend files are in the diff.

# Handoff to parity audit

After the slice compiles and its unit test passes, invoke `design-parity-auditor` on the matching `design/prototype/screens/<name>.jsx` and `design/prototype/mobile/screens.jsx` — this is a textual diff audit, not a test run, so it's cheap and catches design drift early.
