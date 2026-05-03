# Architecture Decision Records

One paragraph per decision. Date + status + context + choice + consequence. Append-only.

---

## ADR-001 — Greenfield rewrite over in-place modernization of legacy carePlus
**Date**: 2026-04-23
**Status**: accepted
**Context**: Legacy `carePlus/` is Spring Boot 2.4.5 / Java 11, ~100 Java files, minimal test coverage, `javax.*`, deprecated security APIs, empty exception handler, multi-module Maven structure that obscured more than it helped. Target scope (full SICM) is ~10× the legacy scope.
**Choice**: Greenfield new project `careplus-v2/`. Reuse domain concepts and any vetted logic by reading, not by migrating.
**Consequence**: Faster to a clean target than untangling the old codebase. Risk of losing subtle business rules is low because legacy was a learning project, not production.

## ADR-002 — Spring Boot 3.3 + Java 21 + PostgreSQL 16
**Date**: 2026-04-23
**Status**: accepted
**Context**: Need modern stack for 5+ years of runway, `jakarta.*` ecosystem, native image option later, Hibernate 6 for better JPA.
**Choice**: Spring Boot 3.3.x, Java 21 LTS, PostgreSQL 16 (not MySQL — better full-text FR/AR, JSONB, row-level encryption options).
**Consequence**: Forces `jakarta.*` everywhere. Testcontainers requires Docker locally.

## ADR-003 — Spring MVC, not WebFlux
**Date**: 2026-04-23
**Status**: accepted
**Context**: Medical cabinet workload: <10 concurrent users, CRUD-heavy. WebFlux adds reactive complexity (debugging, JPA incompatible, stack traces) for zero throughput benefit at this scale.
**Choice**: Spring MVC + blocking JDBC.
**Consequence**: Simpler onboarding, easier debugging. If a SaaS pivot ever needs thousands of concurrent connections, reconsidered then, not now.

## ADR-004 — Modular monolith, not microservices
**Date**: 2026-04-23
**Status**: accepted
**Context**: Target is one cabinet = one deployment. Microservices add auth inter-services, orchestration, distributed transactions, observability — all costs for no benefit at this scale.
**Choice**: Single JAR. Module boundaries enforced by package structure + ArchUnit tests. Events over `ApplicationEventPublisher` for decoupling.
**Consequence**: Refactor path to microservices remains open but unused.

## ADR-005 — MVP as single-module Maven project
**Date**: 2026-04-23
**Status**: accepted
**Context**: 7-day MVP. Multi-module Maven imposes boilerplate (reactor pom, per-module pom, cross-module deps, build times).
**Choice**: Mono-module during MVP. Post-MVP, split if module isolation proves insufficient.
**Consequence**: Package discipline becomes the only boundary. Mitigated by ArchUnit test enforcing no cross-module internal access.

## ADR-006 — Hybrid deployment (on-premise + encrypted cloud backup)
**Date**: 2026-04-23
**Status**: accepted
**Context**: Moroccan cabinets need offline resilience (internet instability, power cuts, CNDP preference for local data), but also disaster recovery.
**Choice**: Default install at cabinet PC (Windows). Daily `pg_dump` AES-256-GCM encrypted client-side → OVH Object Storage Casablanca. Key derived from a master password known only by the cabinet. Cloud-pure mode supported via same JAR + config flag.
**Consequence**: Cabinet retains control and a clear exit path. If the cabinet loses the master password, its backups are unrecoverable — documented explicitly at onboarding. Hosting in Morocco keeps CNDP satisfied.

## ADR-007 — JWT + Spring Security, not Keycloak
**Date**: 2026-04-23
**Status**: accepted
**Context**: Solo cabinet has 2–5 users. Keycloak requires an extra service to install, maintain, back up.
**Choice**: Spring Security 6 + JWT (nimbus-jose-jwt), access 15 min + refresh 7 d, stored server-side and revocable.
**Consequence**: Keycloak reconsidered only if SaaS multi-cabinets or SSO needed.

## ADR-008 — Frontend stack: Angular 17 + PrimeNG
**Date**: 2026-04-23
**Status**: accepted
**Context**: Data-heavy CRUD SI. PrimeNG ships FullCalendar, DataTable with filter/sort/lazy, WYSIWYG editor, DataView — saves 3–4 weeks of UI plumbing. Angular forms + validators ergonomic for large consultation forms.
**Choice**: Angular 17+, PrimeNG 17+, PrimeFlex, NgRx Signals. Frontend design (Figma) happens before implementation. Implementation starts only after backend MVP ships.
**Consequence**: Frontend engineer (or designer) sees a fully documented OpenAPI spec to consume.

## ADR-009 — Medication catalog: seeded + user-extended, no external pharma DB
**Date**: 2026-04-23
**Status**: accepted
**Context**: No accessible Vidal Maroc or DMP API in MVP. Interactions/contraindications DB not feasible without one.
**Choice**: Seed 20 common molecules (Doliprane, Amoxicilline, Amlor, Metformine, Efferalgan…). In-app "add medication" extends the catalog. CSV import supported.
**Consequence**: No drug-drug interaction alerts in v1. Allergy cross-check is implemented (patient allergy set vs prescription medication tags).

## ADR-010 — Commercial model: monthly subscription, managed manually in v1
**Date**: 2026-04-23
**Status**: accepted
**Context**: Premature to automate licensing for one cabinet. Flag-based enablement is enough.
**Choice**: `careplus.enabled: true` config. No license module in v1. Post-v1 reconsider if selling to ≥5 cabinets.
**Consequence**: Fewer LOC for MVP. Manual subscription management handled outside the app.

## ADR-011 — Numérotation facture: strict sequential, atomic, gap-free
**Date**: 2026-04-23
**Status**: accepted
**Context**: Moroccan legal requirement: invoices must be strictly sequential, no gaps, no reuse.
**Choice**: Sequential number assignment inside a DB transaction with a dedicated counter row (`billing_invoice_sequence`) locked via `SELECT FOR UPDATE`. Format `YYYY-NNNNNN`. Cancellation via `CreditNote`, never by deleting/renumbering.
**Consequence**: Performance impact is negligible at expected volumes. Correctness preserved under concurrent issuance.

## ADR-013 — Vitals: recordable by SECRETAIRE / ASSISTANT / MEDECIN
**Date**: 2026-04-23
**Status**: accepted
**Context**: Moroccan generalist cabinets vary in staffing. Some have a dedicated assistante/infirmière taking vitals, others have the secretary cumulate accueil + vitals, others have the médecin take vitals himself at consultation start. Restricting to one role would exclude valid configurations.
**Choice**: Allow `POST /api/appointments/{id}/vitals` and vitals history read to all three roles (SECRETAIRE, ASSISTANT, MEDECIN). ADMIN excluded (non-operational role). Workflow WF3 is optional: if the médecin takes vitals himself, `Arrivé` can go directly to `EnConsultation` with vitals captured inline.
**Consequence**: Permission matrix flexibility. No code branching needed — the same endpoint serves all three. The cabinet's own staffing decides which role uses it.

## ADR-012 — Database language: English code, French data
**Date**: 2026-04-23
**Status**: accepted
**Context**: Team readability of code (English is the lingua franca), but user-facing strings (status values, error messages, PDF labels) must be French.
**Choice**: Identifiers, columns, packages in English. Error messages, domain enums' display labels, PDF templates in French. I18n bundle ready for Arabic v2.
**Consequence**: Clean contributor ramp-up, Moroccan user experience preserved.

## ADR-014 — Frontend brought into MVP scope; React 18 over Angular 17
**Date**: 2026-04-24
**Status**: accepted, supersedes the Angular 17 + PrimeNG entry that was in `BACKLOG.md`
**Context**: A hi-fi React/JSX prototype of all 13 screens (desktop + mobile) was delivered from Claude Design (preserved in `design/prototype/`). Porting JSX → TSX is line-for-line work; porting JSX → Angular components is a full rewrite with new bug surface. PrimeNG's theming would fight our hand-built Clinical Blue token system. Casablanca dev hiring pool skews React.
**Choice**: React 18 + Vite + TypeScript strict, targeting a static SPA bundle served by Spring Boot (or Nginx) on-prem. Scope: `frontend/` directory, MVP days J8–J10 (after backend J7). See `docs/FRONTEND.md` for the full stack and defended rejections.
**Consequence**: MVP grows from 7 days to 10. On exit, `v0.1.0-mvp` tag covers full-stack workflow, not just backend. Angular option sunset.

## ADR-015 — Vanilla CSS + custom properties over Tailwind / CSS-in-JS
**Date**: 2026-04-24
**Status**: accepted
**Context**: The prototype is authored in vanilla CSS with `--primary`, `--status-arrived`, `--r-md`, etc. — ~600 lines of tokenized CSS across `styles.css` and `mobile-styles.css`. Porting those to Tailwind class soup or runtime CSS-in-JS is net-negative work: we lose the already-correct tokens, gain no features we need, and risk drift from the design source.
**Choice**: Keep vanilla CSS with custom properties. Copy the two CSS files to `frontend/src/styles/`, split into `tokens.css` (variables), `desktop.css`, `mobile.css`. No Tailwind, no Emotion, no styled-components, no vanilla-extract.
**Consequence**: Dead simple theming (swap a variable, everything updates). Zero runtime style cost. Global class names require discipline (`.cp-app`, `.m-*` prefixes already enforce this).

## ADR-016 — Headless primitives (Radix UI) over component kits (MUI/Mantine/Chakra/PrimeReact)
**Date**: 2026-04-24
**Status**: accepted
**Context**: Component kits ship their own design system — the time spent overriding them to reach Clinical Blue would exceed the time to build primitives that natively consume our tokens. Interactive a11y (focus trap, keyboard nav, ARIA) is hard to get right hand-rolled.
**Choice**: Radix UI for interactive primitives that need a11y correctness (Dialog, DropdownMenu, Tabs, Tooltip, Popover). Hand-rolled Button/Pill/Panel/Field/Input/Avatar/AllergyChip because they're trivial and must match tokens exactly. Vaul for mobile bottom sheet. No Material / Mantine / Ant / Chakra / PrimeReact.
**Consequence**: Bundle stays small (~50KB gz for the Radix bits we use). Our components look exactly like the prototype without fighting library opinions. If a future tablet or dashboard screen needs DataGrid-level complexity, we'll evaluate TanStack Table + more Radix rather than importing a kit.

## ADR-017 — TanStack Query for server state; Zustand (auth only) for client state
**Date**: 2026-04-24
**Status**: accepted
**Context**: Need polling for `/api/queue` (salle d'attente refresh), optimistic updates for appointment-move and check-in, stale-while-revalidate for patient search. Also need auth user/roles available everywhere.
**Choice**: TanStack Query v5 for all server-derived state (queries, mutations, polling, invalidation). Zustand for **auth only** — access token in memory, refresh in HttpOnly cookie, role list, current user identity. Everything else: React useState inside the component.
**Consequence**: No Redux, no Context soup, no Jotai learning cost. TanStack Query's devtools give us debuggability; Zustand at 1KB is cheap and focused. If a future feature demands global client state (e.g. global notification center, collaborative editing), revisit.

## ADR-019 — Refresh-token storage: HttpOnly cookie, access token in memory
**Date**: 2026-04-24
**Status**: accepted
**Context**: Login mints two tokens: a short-lived access token (15 min) used for API authorization, and a long-lived refresh token (7 days) used to rotate access tokens. Storage choice determines what an XSS attacker can steal. Medical data under Moroccan loi 9-88 means we cannot ship the easier-but-exposed option.
**Choice**: Backend `POST /api/auth/login` returns `{accessToken}` in the JSON body AND sets `careplus_refresh` as an HttpOnly, Secure, SameSite=Strict cookie with path `/api/auth`. Frontend holds the access token in the Zustand auth store (memory only — lost on refresh, reacquired via `/api/auth/refresh` which reads the cookie). Never touches `localStorage` or `sessionStorage`.
**Consequence**: XSS cannot exfiltrate the refresh token. A page reload triggers one silent refresh call. CSRF protection needed on `/api/auth/refresh` (SameSite=Strict suffices for modern browsers; double-submit cookie as belt-and-braces). On logout, backend clears the cookie and revokes server-side.

## ADR-020 — Spring Boot serves the frontend bundle (single process on-prem)
**Date**: 2026-04-24
**Status**: accepted
**Context**: Cabinet deployments are one Windows machine, one install, one backup. Running Nginx + Spring Boot doubles the ops surface (two services to start, two to monitor, two to update) for no meaningful gain at 3–10 concurrent users.
**Choice**: Vite's production build outputs to `frontend/dist/`. Maven's `frontend-maven-plugin` runs `npm ci && npm run build` during `mvn package`, then copies `frontend/dist/**` into `src/main/resources/static/` so Spring Boot's default static-resource handler serves them at `/`. SPA deep links handled by a Spring controller that forwards non-`/api/*` non-`/actuator/*` paths to `index.html`. In dev, Vite's dev server runs on `:5173` with `/api → :8080` proxy; no Spring involvement.
**Consequence**: One `jar` ships the whole app. One `mvn spring-boot:run` gives a running stack. If a cloud deploy later wants Nginx in front, the static bundle is still buildable standalone. Build time increases by ~30s (npm install + build) — acceptable.

## ADR-021 — Parallel-synchronized full-stack delivery (frontend pulls from backend)
**Date**: 2026-04-24
**Status**: accepted, supersedes the J8–J10 sequential frontend block previously in ADR-014
**Context**: ADR-014 put frontend after backend (J8–J10, sequential). User preference (2026-04-24): frontend should ride alongside backend — as each backend feature ships, its matching screen ports and wires up immediately; if frontend catches up faster than backend, it pauses rather than racing ahead.
**Choice**: Each sprint day J2–J7 owns BOTH a backend feature and the corresponding frontend screen(s). J8 becomes a thinner wrap-up day (Paramétrage + mobile parity sweep + E2E + tag). Frontend pauses are explicit — any screen whose backend dependency hasn't shipped yet is stubbed with a mock hook and marked `TODO(backend:Jx)`. Mobile and desktop are produced in the same pass per screen, not as separate phases.
**Consequence**: MVP compresses 10 → 8 days. Each J_x checkpoint is an end-to-end demo of the day's feature, not just a backend test. Higher cognitive load per day (two tiers at once) but the integration pain is spread across the sprint rather than dumped at the end. Pause rule enforced by `frontend-module-scaffolder` checking for required endpoints before starting a slice.

## ADR-022 — Cloud staging on Render free tier + Neon free Postgres (pre-paid); upgrade-in-place later
**Date**: 2026-04-24
**Status**: accepted
**Context**: We need a shareable staging URL that auto-deploys on every push to `main` so the pilot cabinet can review screens without waiting for on-premise installs (which come later via jpackage, ADR-020 still holds for prod). Budget constraint: free-only for now, willing to pay once the pilot validates. 2026 free-tier landscape is narrower than it was — Fly.io and Railway killed their free tiers in 2024 and 2023 respectively.
**Choice**: **Render** (web service, free: 512 MB / 750 h / cold-start after 15 min idle) for the fat-jar container + **Neon** (Postgres, free: 0.5 GB forever, Frankfurt region). Deploy is triggered by Render's native GitHub integration on push to `main` — no `.github/workflows/deploy.yml` needed; existing `ci.yml` stays as the quality gate. Dockerfile is 3-stage (Node → Maven → distroless Java 21) so the runtime image ships only the jar.
**Consequence**: $0 to validate. Cold starts make demos require a warm-up `curl`, acceptable at MVP pre-pilot scale. Upgrade to Render Starter ($7/mo) + Neon Launch ($19/mo) is a dropdown click each — same URLs, same secrets, no migration. The Dockerfile is host-agnostic, so eventual migration to OVH Casablanca for data residency is `docker compose up` on a VPS. Rejected alternatives documented in `docs/DEPLOY.md`.

## ADR-018 — Frontend regression cadence: day-boundary only, not per-iteration
**Date**: 2026-04-24
**Status**: accepted
**Context**: Backend discipline is "run `mvn verify` after every module" because every Flyway migration + JPA change can break integration tests. Frontend is different — screens port independently, and running `npm test && npm run build` after every individual screen is friction without a matching risk.
**Choice**: Full frontend suite (`npm run lint && npm test -- --run && npm run build`) runs only at J-day boundaries (end of J8 / J9 / J10) and before a commit that touches `frontend/**`. Per-screen: run only that screen's local test file + invoke `design-parity-auditor` (textual diff vs prototype). No full-suite invocation per screen.
**Consequence**: Faster iteration during screen port. Discipline stays where it adds value (day boundaries, commits). Documented in `.claude/agents/regression-guard.md` and feedback memory.

## ADR-023 — Patient tier (NORMAL/PREMIUM), mutuelle, categorized antécédents, free-form patient notes, médecin-owned tariff parameterization
**Date**: 2026-04-24
**Status**: accepted
**Context**: Real-cabinet business rules clarified by the user: (a) consultation start is not exclusively médecin — a habilitated SECRETAIRE/ASSISTANT may open the draft by taking vitals, but signature stays médecin-only; (b) patients have a tier (normal / premium) with a parameterizable discount; (c) mutuelle selection belongs to patient registration, not only to billing; (d) antécédents are not free-form — they cluster into 6 clinically meaningful categories (personnels, familiaux, médicamenteux, sociaux, gynéco-obstétricaux, psychiatriques); (e) médecin may adjust the invoice total before closing the consultation; (f) billing can be handled either by the médecin or handed off to SECRETAIRE/ASSISTANT; (g) tariffs (acts & prices) are self-service for the médecin, not an ADMIN-gated parametrage.
**Choice**:
- Add `tier` (`NORMAL` | `PREMIUM`) on `patient` + `config_patient_tier` table holding the premium discount (percent or fixed).
- Add `has_mutuelle` + `insurance_id` (FK) + `insurance_policy_number` on `patient`. Insurance list already seeded in V002.
- `antecedent.category` becomes an enum of 17 values grouped under 6 clinical categories (see WORKFLOWS.md WF7b); `Allergy` stays its own dedicated entity.
- New `patient_note` entity: free-form, authored, timestamped, appendable at any time by médecin from the dossier patient screen.
- New `UserCapability` flag `canStartConsultation` (bool on `user`) enabling habilitated S/A to transition `ConstantesPrises` → `EnConsultation` + create the `Brouillon`. Clinical content (diagnostic / prescription / signature) remains médecin-only regardless.
- Médecin can adjust the draft invoice total during WF4 step 9 (before signature). Invoice draft persists the adjusted total; S/A/M may edit the draft afterwards until `Émettre`.
- `Act` and `Tariff` management exposed under `MANAGE_TARIFFS` capability granted to MEDECIN + ADMIN (not ADMIN-only). Tariffs historicized via `effective_from` / `effective_to` — never overwritten, so past invoices stay reproducible.
**Consequence**: Flyway migration needed for J5/J6/J7: `patient.tier`, `patient.has_mutuelle`, `patient.insurance_id`, `patient.insurance_policy_number`, `user.can_start_consultation`, `patient_note`, `antecedent.category` enum, `config_patient_tier`, `tariff.effective_from` / `tariff.effective_to`. Permission matrix updated in WORKFLOWS.md. Frontend dossier patient screen gains a tier/mutuelle section + a patient notes thread. Ordonnance & facture PDFs carry mutuelle info when present.

---

## How to add an entry

Append at the bottom. Never edit an accepted ADR in place — add a superseding one referencing it (`**Status**: superseded by ADR-NNN`).
