# Frontend plan — careplus

This document is the single reference for how the careplus frontend is built. Written BEFORE any code, as a contract the user approves.

Source of truth for visual output: [`design/prototype/`](../design/prototype/) — 13 desktop (1440×900) + 13 mobile (390×844) screens authored in Claude Design and preserved verbatim. All design decisions flow from that prototype and its [`DESIGN_SYSTEM.md`](../design/prototype/DESIGN_SYSTEM.md).

---

## 1. Decisions at a glance

| Area | Choice | Defense (in §4) |
|---|---|---|
| Framework | React 18 | §4.1 |
| Build tool | Vite 5 | §4.2 |
| Language | TypeScript strict | §4.3 |
| Styling | Vanilla CSS + custom properties (tokens) | §4.4 |
| Component primitives | Radix UI (headless) + our own shells | §4.5 |
| Icon set | Our 30 hand-drawn icons (from prototype) | §4.6 |
| Routing | React Router v6.26 | §4.7 |
| Server state | TanStack Query v5 | §4.8 |
| Local / UI state | React useState + small Zustand store for auth only | §4.9 |
| HTTP | axios + interceptors | §4.10 |
| Forms | React Hook Form + zod | §4.11 |
| Tables | TanStack Table v8 (facturation only) | §4.12 |
| Dates | date-fns v3 + `fr` locale | §4.13 |
| Fonts | `@fontsource/*` pinned (offline-safe) | §4.14 |
| Tests | Vitest + Testing Library + jest-axe | §4.15 |
| E2E | Playwright | §4.16 |
| Bottom sheet | Vaul (mobile modals) | §4.17 |
| Toasts | Sonner (problem+json error rendering) | §4.18 |

**Explicitly rejected** (see §5): Material UI, Mantine, Ant Design, Chakra, PrimeReact, Tailwind, styled-components, Emotion, Redux/Zustand-for-everything, Next.js, Remix, TanStack Router, Formik, Yup, dayjs/moment, Lucide/Heroicons, SWR.

---

## 2. Directory layout

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── playwright.config.ts
├── vitest.config.ts
└── src/
    ├── main.tsx                         app entry, QueryClient + Router + font imports
    ├── App.tsx                          root layout, responsive shell switch
    ├── styles/
    │   ├── tokens.css                   ported from design/prototype/styles.css:5–51
    │   ├── desktop.css                  .cp-app + desktop primitives (from prototype styles.css)
    │   ├── mobile.css                   .cp-mobile + mobile primitives (from prototype mobile-styles.css)
    │   └── reset.css                    minimal box-sizing reset
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts                axios instance + JWT interceptors
    │   │   ├── problemJson.ts           RFC 7807 → typed error object
    │   │   └── queryClient.ts           TanStack Query default config
    │   ├── auth/
    │   │   ├── authStore.ts             Zustand (access token in memory, refresh in HttpOnly cookie)
    │   │   └── useAuth.ts
    │   ├── format/
    │   │   ├── date.ts                  date-fns French + Moroccan helpers
    │   │   ├── money.ts                 "2 450,00 MAD" formatting
    │   │   └── number.ts                tnum wrappers
    │   └── router/
    │       └── routes.tsx               lazy-loaded route tree
    ├── components/
    │   ├── icons/                       30 icons as named TSX exports (Icon.Calendar, etc.)
    │   │   ├── index.ts
    │   │   └── Calendar.tsx … Signal.tsx
    │   ├── ui/                          desktop primitives — Button, Pill, Panel, Field, Input, Select, Textarea, Avatar, AllergyChip, Kbd, Badge, Dialog, DropdownMenu
    │   │   └── …
    │   ├── mobile/                      mobile primitives — MButton, MPill, MCard, MField, MRow, MSheet (Vaul-wrapped), MFab, MStat, MDaytab, MSegmented, MTimeline
    │   │   └── …
    │   └── shell/
    │       ├── Sidebar.tsx              desktop sidebar
    │       ├── Topbar.tsx
    │       ├── Screen.tsx               desktop composition
    │       ├── RightPanel.tsx
    │       ├── MTopbar.tsx              mobile
    │       ├── MTabs.tsx
    │       └── MScreen.tsx
    └── features/                        one folder per screen, screen-local code stays local
        ├── agenda/
        │   ├── AgendaPage.tsx
        │   ├── AgendaPage.mobile.tsx
        │   ├── components/AgendaBlock.tsx
        │   ├── hooks/useAppointments.ts
        │   ├── schemas/appointment.schema.ts
        │   └── __tests__/AgendaPage.test.tsx
        ├── prise-rdv/
        ├── dossier-patient/
        ├── salle-attente/
        ├── prise-constantes/
        ├── consultation/
        ├── prescription/
        ├── apercu-ordonnance/
        ├── facturation/
        ├── apercu-facture/
        ├── parametrage/
        ├── login/
        └── onboarding/
```

**Rule**: anything used by >1 feature lives in `components/` or `lib/`. Anything used by exactly one feature stays inside that feature folder. Never lift code out of a feature speculatively.

---

## 3. Responsive strategy

Per `DESIGN_SYSTEM.md:§5`, desktop and mobile are **parallel layouts**, not fluid reflow. We preserve that.

- Layout route in the router inspects `useMediaQuery('(max-width: 640px)')`.
- Mobile → renders `<MScreen>` with `*.mobile.tsx` page variant.
- Desktop & tablet (≥641px) → renders `<Screen>` with `*.tsx` desktop variant.
- Tablet falls back to desktop layout per the original design decision (the sidebar stays, just in less room). Future tablet breakpoint reserved.

The two layouts share: tokens, icons, primitives where identically-named (Pill, Panel), feature hooks, zod schemas. They diverge only in JSX composition.

---

## 4. Defended choices

### 4.1 React 18
- **Problem**: render 13 hi-fi interactive screens that the design team authored in JSX.
- **Alternatives considered**: Angular 17 (was in backlog), Vue 3, Svelte 5.
- **Why React wins**: the prototype is already React. Port cost = JSX→TSX with type annotations. Angular/Vue/Svelte would each be a full translation with new bug surface. React's ecosystem (Radix, TanStack, RHF) maps 1:1 onto the prototype's patterns.

### 4.2 Vite 5
- **Problem**: dev server + prod build.
- **Alternatives**: Next.js (SSR), Remix, CRA (deprecated), Webpack hand-rolled.
- **Why Vite wins**: careplus is an SPA behind a JWT-guarded API on-prem — SSR/SSG buys us nothing and adds ops cost. Next.js/Remix introduce server runtimes we'd have to deploy + monitor inside the cabinet. Vite gives fast HMR, ESM-native build, and outputs pure static assets the Spring Boot backend can serve directly from `/static` (or Nginx in front). Build artifact is ~200KB gz target.

### 4.3 TypeScript strict
- Non-controversial. Medical software touching drug prescriptions + billing cannot be written in loose JS. `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.

### 4.4 Vanilla CSS + CSS custom properties (no Tailwind, no CSS-in-JS)
- **Problem**: faithfully reproduce the Clinical Blue design system with tokens.
- **Alternatives**: Tailwind, Emotion, styled-components, vanilla-extract, CSS Modules.
- **Why vanilla + tokens wins**: the prototype is **already** vanilla CSS with custom properties — `var(--primary)`, `var(--status-arrived)`, etc. Porting to Tailwind means rewriting every class into `bg-[var(--primary)]` or mapping the token set into `tailwind.config.js` — work that doesn't add value and risks drift. CSS-in-JS adds runtime cost + SSR-first APIs we don't need. CSS Modules are reasonable but the prototype's class names are already globally namespaced (`.cp-app .btn`, `.m-row`) so collisions aren't a risk. **Decision**: copy the two CSS files into `styles/` largely as-is, add `strict` class naming.

### 4.5 Radix UI (Dialog, DropdownMenu, Tabs, Tooltip, Popover) — headless only
- **Problem**: the prototype fakes modal/dropdown/tooltip behavior with static divs. The real app needs keyboard navigation, focus trapping, escape to close, WAI-ARIA roles — for medical software used by keyboard-heavy secretaries.
- **Alternatives**: Headless UI (Tailwind-adjacent), Ariakit, hand-rolling.
- **Why Radix wins**: unstyled (so our tokens drive the look), battle-tested a11y, individual package imports (pay only for what we use). Fits the prototype's "bring your own CSS" ethos. Handles the dozen interactive affordances the prototype can't demonstrate statically.
- **What we will NOT import from Radix**: buttons, form controls (our Button/Input/Pill/Panel are trivially hand-rolled and we need exact token control).

### 4.6 Custom icon set (not Lucide, not Heroicons)
- The prototype ships 30 icons with 1.5 stroke, 16×16 viewBox, rounded caps. `DESIGN_SYSTEM.md` explicitly says **"Don't use Lucide/Heroicons verbatim — re-draw to match existing weights."** Port the 30 SVG paths from `design/prototype/icons.jsx` directly into TSX components. One file per icon, tree-shakeable via `import { Calendar } from '@/components/icons'`.

### 4.7 React Router v6.26
- **Alternatives**: TanStack Router (better type inference), Wouter (smaller), hand-rolled.
- **Why React Router wins**: broadest ecosystem support, stable, most examples match. TanStack Router is genuinely better typed but newer and adds learning cost; we don't need its advanced features (loaders, search-param typing) for a 13-screen app. Revisit in v2.

### 4.8 TanStack Query v5
- **Problem**: async state for /api/appointments, /api/queue (polling), /api/patients, /api/invoices.
- **Alternatives**: SWR, RTK Query, bare useEffect + useState.
- **Why TanStack Query wins**: first-class polling (needed for `GET /api/queue` — the salle d'attente refreshes every N seconds), optimistic updates (important for check-in and appointment move), stale-while-revalidate by default, excellent devtools. SWR is a worthy alternative but TQ's mutation API + devtools are materially better for a form-heavy app.

### 4.9 Zustand (tiny, for auth only) + React useState for everything else
- **Problem**: auth state (user + roles + tokens) needs to be read from dozens of places.
- **Alternatives**: Redux Toolkit, Jotai, Context+useReducer, putting auth in TanStack Query.
- **Why minimal Zustand wins**: Redux is overkill for a 6-field store. Context re-renders are fine but boilerplatey. Jotai's atomic model is elegant but unfamiliar. Zustand = 1KB, hook-based, zero ceremony. **One store, one purpose: auth**. Everything else stays as local `useState` or TQ cache. Do NOT reach for Zustand for feature state.

### 4.10 axios + interceptors
- **Alternatives**: native fetch, ky, redaxios.
- **Why axios wins**: the interceptor chain (attach `Authorization: Bearer …` on every request, catch 401 → call `/api/auth/refresh` → retry original → update store) is ~40 lines in axios vs a fetch wrapper we'd hand-roll buggily. Bundle cost (~13KB gz) is worth the correctness. Native fetch lacks request cancellation semantics we want for the search-as-you-type patient lookup.

### 4.11 React Hook Form + zod
- **Problem**: many forms (RDV, patient, onboarding wizard, consultation SOAP, prescription, invoice editor, settings), all validated.
- **Alternatives**: Formik + Yup, Tanstack Form, hand-rolled useState.
- **Why RHF + zod wins**: RHF is uncontrolled-by-default → no re-render per keystroke → critical for the Consultation SOAP editor which has 4 long textareas. zod's TypeScript inference means **one schema** is the single source of truth for (a) form validation (b) backend DTO shape (via `z.infer`) (c) test fixtures. Formik is declining; Yup is fine but zod's inference is strictly better for a TS-strict codebase.

### 4.12 TanStack Table v8 (facturation screen only)
- Invoice list needs sorting, filtering, pagination. The other screens do not have data-grid patterns — don't pull the dep in for screens that render 10 static rows. Lazy-load on the /facturation route.

### 4.13 date-fns v3 + `fr` locale
- **Alternatives**: dayjs, moment, native Intl.
- **Why date-fns wins**: tree-shakeable (only pay for the fn you import), strong TS types, proper French locale including "Mercredi 24 avril 2026" formats the prototype uses. Moment is deprecated. dayjs is lighter but its TypeScript story is weaker. Native Intl alone can't handle the add/sub/parse we need.

### 4.14 `@fontsource/inter-tight`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono`
- **Problem**: the prototype uses Google Fonts CDN. On-prem cabinet installs may not have internet, or may be behind restrictive firewalls.
- **Alternatives**: serve via Google Fonts CDN, self-host manually, use system stack.
- **Why @fontsource wins**: pinned versions, no runtime network call, CSS-imported like any other asset, Vite fingerprints them for cache-busting. System stack is a no-go — Inter Tight's metrics are load-bearing for the design (`DESIGN_SYSTEM.md:§11`).

### 4.15 Vitest + Testing Library + jest-axe
- Standard. Vitest because it's Vite-native (shares config, no Jest transform dance), same API as Jest. jest-axe catches a11y violations per test — important because Radix components can still be used wrong.

### 4.16 Playwright
- E2E for the 3 critical workflows (RDV → check-in, consultation → sign, invoice → pay). Plays against a real `mvn spring-boot:run` backend in CI. Alternative Cypress is fine but Playwright's multi-browser + trace viewer are strictly better.

### 4.17 Vaul (bottom sheet for mobile modals)
- **Problem**: `DESIGN_SYSTEM.md:§7 bottom sheet` is the mobile replacement for desktop modals. Needs drag-to-dismiss, snap points, safe-area handling.
- **Alternatives**: Radix Dialog + custom CSS, hand-rolled.
- **Why Vaul wins**: written by Emil Kowalski, 3KB, specifically for this pattern, handles the gesture + backdrop + focus trap we'd otherwise hand-roll imperfectly.

### 4.18 Sonner (toasts)
- Tiny, accessible, stackable. Wired to the problem+json interceptor — any RFC 7807 error from the backend becomes a toast with `title`, `detail`, `status`. Alternative react-hot-toast is equally fine, Sonner has slightly better default styling that's easier to retheme to Clinical Blue.

---

## 5. Explicitly rejected (and why)

| Rejected | Why not |
|---|---|
| **Material UI / MUI** | Opinionated visual language fights Clinical Blue. Heavy runtime. Theming system would consume days. |
| **Mantine** | Same as MUI — built-in components have a look that contradicts our prototype. |
| **Ant Design** | Enterprise Chinese UX patterns don't match French medical workflow. Bundle weight. |
| **Chakra UI** | Opinionated. Emotion-based CSS-in-JS adds runtime cost we don't need. |
| **PrimeReact** | What the backlog originally suggested. Same problem as MUI — theming tax. |
| **shadcn/ui (as a whole)** | shadcn is Tailwind-first; we're not using Tailwind. We'll cherry-pick **patterns** from shadcn (composability, Radix wrapping) without installing its tooling. |
| **Tailwind CSS** | The prototype is vanilla CSS + tokens. Migrating to Tailwind classes is net-negative churn. |
| **styled-components / Emotion** | Runtime CSS-in-JS. Careplus is static styles; no dynamic theming needed. |
| **Next.js / Remix** | SSR not needed for an SPA behind auth. Introducing a Node server inside the cabinet install increases ops surface. |
| **TanStack Router** | Better typing, but we don't need its search-param superpowers and React Router's familiarity wins at team scale. Revisit later. |
| **Redux Toolkit** | Overkill. TanStack Query owns server state; Zustand (1KB) owns auth. |
| **Formik** | Development has slowed; RHF is strictly better on perf for textarea-heavy SOAP. |
| **Yup** | zod's TypeScript inference is materially better for strict mode. |
| **Moment.js** | Deprecated, heavy, mutable. |
| **Lucide / Heroicons** | `DESIGN_SYSTEM.md` explicitly says re-draw, don't import. 30 icons is small enough to own. |
| **SWR** | Worthy alternative to TQ, but TQ's mutation + devtools are better for our shape of app. |

Any future addition to `package.json` must be defended in `docs/DECISIONS.md` as an ADR — same discipline the backend uses.

---

## 6. Data & API layer

- **Base URL**: `/api`. In dev, Vite proxy forwards to `http://localhost:8080`.
- **Auth**: access token in Zustand (in-memory); refresh token in HttpOnly `careplus_refresh` cookie set by the backend. 401 triggers one refresh attempt; failure → redirect to `/login`.
- **Error contract**: every API error is RFC 7807 problem+json (matches `ma.careplus.shared.web.GlobalExceptionHandler`). `problemJson.ts` converts to `{ title, detail, status, type, instance, violations? }`. Forms map `violations[].field → field error`.
- **Query keys**: namespaced — `['patients', { q }]`, `['appointments', { from, to }]`, `['queue']` (polling every 15s on salle screen only), etc. Invalidation patterns documented per feature.
- **Mutations**: optimistic updates on appointment move, check-in, consultation draft save. Rollback on error.
- **Polling**: `useQuery({ queryKey: ['queue'], refetchInterval: 15_000 })` on the Salle d'attente screen only.

---

## 7. Port order (J9, 1 day)

Purpose: ordered so each screen reuses primitives built by prior screens.

1. **Login** (simplest, exercises form primitive + hero)
2. **Onboarding** (wizard pattern, multi-step form)
3. **Agenda semaine** (hardest layout; defines the desktop shell real usage)
4. **Salle d'attente** (queue + KPI tiles — defines KPI card primitive)
5. **Prise de RDV** (Radix Dialog; reuses agenda context)
6. **Dossier patient** (tabs — Radix Tabs; defines tab primitive)
7. **Prise des constantes** (large-numeric input variant)
8. **Consultation** (SOAP editor, allergy header pattern)
9. **Prescription** (drawer pattern; penicillin guard modal)
10. **Aperçu ordonnance** (A4 primitive — shared with facture)
11. **Facturation** (TanStack Table first use)
12. **Aperçu facture** (A4 primitive reused)
13. **Paramétrage** (last — mostly static)

Mobile variants port in the same order, immediately after each desktop screen, while the primitives are fresh.

---

## 8. Testing discipline

Per the [regression-cadence feedback memory](../../.claude/projects/../../.claude/projects/), the frontend runs the **full** `npm run lint && npm test -- --run && npm run build` suite only:
- At each J-day boundary (end of J8 / J9 / J10)
- Before a commit that touches `frontend/**`

**Per screen during J9**: run only the local test (`npm test -- --run features/<name>`) and a `design-parity-auditor` pass against the prototype file. No full suite, no pressure.

Coverage targets:
- **Unit** (Vitest): every primitive has a render test + a11y test (jest-axe). Every page has a smoke render test with mocked data. Target ≥70% line coverage on `components/` and `lib/`.
- **E2E** (Playwright, J10 only): 3 specs — RDV happy path, consultation+sign, invoice+pay.
- **No visual regression tooling in MVP** (Chromatic etc.). Parity is enforced by `design-parity-auditor` doing a textual diff, and by user-visible QA.

---

## 9. CI integration

Extend `.github/workflows/ci.yml`:
- Add a `frontend` job parallel to the existing backend job.
- Matrix: Node 20 LTS. Cache `~/.npm`. `npm ci`, `npm run lint`, `npm test -- --run`, `npm run build`.
- Playwright: runs only when `frontend/` or `src/main/java/**` changed, against a containerized backend (reuses docker-compose Postgres).

---

## 10. What's still open for user decision

The following are choices that aren't load-bearing but I'll default on if not told otherwise:

- **Auth refresh token storage**: recommend HttpOnly cookie (XSS-safe). Alternative: localStorage (simpler but XSS-exposed). Cabinet software processing prescriptions should not ship the easier-but-less-safe option.
- **i18n layer**: recommend skip for MVP (UI is French-only per design). Add later if Arabic RTL gets prioritized.
- **Telemetry**: recommend skip for MVP. When added, prefer self-hosted (Grafana) over third-party analytics (cabinet patient data must not leak).
- **Docker-compose for frontend**: recommend skip; Vite dev server is enough. Production build is a static bundle.
- **Monorepo tooling (Turborepo, Nx)**: recommend skip. Two tiers (Java + Node) don't justify it. Revisit if a shared TypeScript client is generated.
