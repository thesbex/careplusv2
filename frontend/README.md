# careplus — frontend

React 18 + Vite + TypeScript. Built to pixel-match `../design/prototype/` per `../docs/FRONTEND.md`.

## First-time setup

```bash
cd frontend
npm ci              # installs pinned deps — reproducible
npm run dev         # Vite on :5173, proxying /api → :8080
```

You also need the backend running (from the repo root):

```bash
docker compose up -d
mvn spring-boot:run
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on `:5173`, HMR, proxies `/api` + `/actuator` to Spring Boot on `:8080` |
| `npm run build` | TypeScript check + production build to `dist/` |
| `npm run preview` | Serve the built bundle locally for smoke testing |
| `npm run lint` | ESLint with `--max-warnings 0` (CI-strict) |
| `npm run format` | Prettier write |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Vitest single run (used by CI and pre-commit) |
| `npm run e2e` | Playwright E2E suite (requires running backend) |

## Architecture

- **Stack** — see `../docs/FRONTEND.md` for every library and why it was chosen over the alternatives.
- **Design source of truth** — `../design/prototype/` (pixel-matched target) + `../design/prototype/DESIGN_SYSTEM.md`.
- **Tokens** — `src/styles/tokens.css` (ported from the prototype). Never hardcode hex / font-stack / radius.
- **Directory layout** — `components/` (shared), `features/<name>/` (one folder per screen), `lib/` (api, auth, format), `routes/`.
- **Responsive** — parallel desktop/mobile layouts, switched at 640px. See `DESIGN_SYSTEM.md §5`.

## Regression discipline

Run the **full** frontend suite (`npm run lint && npm run test:run && npm run build`) only at:
- End of each sprint day (J2, J3, …, J8 per `../docs/SPRINT_MVP.md`)
- Before any commit touching `frontend/**`

Per screen during porting: run only that screen's local test (`npm run test:run features/<name>`) + invoke the `design-parity-auditor` subagent against `../design/prototype/screens/<name>.jsx`. Do NOT run the full suite per screen (ADR-018).

## Adding a dependency

Any new line in `package.json` requires an ADR in `../docs/DECISIONS.md` (see ADR-014 through ADR-021 for precedent): state the problem, two alternatives considered, and why the pick wins for careplus (on-prem, French clinical UI, hand-built tokens).
