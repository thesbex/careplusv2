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

## ADR-024 — Recharts pour les courbes d'évolution des constantes
**Date**: 2026-04-30
**Status**: accepted, supersedes the custom-SVG approach prototyped in `EvolutionChart.tsx` (commits a3dcfcd → 29ea27f)
**Context**: J9 a livré un onglet "Constantes" dans le dossier patient avec 7 graphes d'évolution (TA, FC, T°, SpO₂, poids, IMC, glycémie). Première itération : SVG fait main pour économiser ~85 KB gzippés par rapport à une lib. Retour utilisateur immédiat en prod : labels Y "999999999994" (floats IEEE non formatés), lignes qui fuient hors des cartes (overflow visible + outliers), tooltip rudimentaire. Polish insuffisant pour un dashboard médical client-facing.
**Alternatives considérées**:
- **Recharts 3.x** (~110 KB gzippés en build prod, +50 % du bundle) : API React déclarative, axes / ticks / responsive bien défaults, accessibilité, gestion native des nulls.
- **Chart.js + react-chartjs-2** (~50 KB) : impératif (pas idiomatique React), thématisation moins propre, canvas-only (pas de DOM testable, moins accessible).
- **Visx** (Airbnb) : primitives bas niveau D3 — faible bundle mais on réécrirait la moitié de Recharts à la main pour atteindre le même rendu, pas la peine.
- **uPlot** (~40 KB) : très rapide mais dashboard look austère, doc minimaliste, pas idiomatique React.
- **Continuer le SVG fait-main** : abandonné après l'itération — chaque polish (axes propres, tooltip, responsive bien fait) est lui-même une petite lib à écrire.
**Choice**: Recharts 3.x. L'API `<LineChart><Line/><Tooltip/><ReferenceArea/>` mappe 1:1 sur le besoin (séries multiples, plages normales ombrées, tooltip date+valeur). On garde `EvolutionChart` comme façade interne avec la même API publique (`series`, `unit`, `normalRange`, `yDomain`, `formatY`) — Recharts est un détail d'implémentation.
**Consequence**: Bundle frontend passe de ~216 KB gzippés à ~325 KB gzippés (acceptable : on est encore très loin du seuil de chargement perçu sur fibre marocaine ; pour la livraison on-prem l'impact est nul). Tests adaptés (mock `ResponsiveContainer` qui exige des dimensions DOM réelles que jsdom ne fournit pas). Si le bundle devient un problème, code-splitter le dossier patient via `React.lazy` est la marche suivante (réservée pour quand la lazy-loading est structurellement justifiée, pas pour ça seul).

## ADR-025 — fastexcel pour l'export xlsx des factures (vs Apache POI)
**Date**: 2026-05-02
**Status**: accepted
**Context**: La feature "filtres + export détaillé sur les factures" exige un export CSV **et** xlsx pour les comptables / déclarations fiscales. L'export ligne-par-ligne de l'entête facture nécessite : montants typés Number, dates typées Date, en-têtes en gras, freeze pane sur ligne 1, ligne SUM en pied de tableau. CSV seul ne suffit pas (Excel-Windows mal configuré ouvre les chiffres comme texte → comptable doit reformater).
**Alternatives considérées**:
- **Apache POI 5.x** : standard de l'industrie pour Excel en Java, riche (formules, charts, styles complexes), mais **~15 Mo de jars** ajoutés au fat-jar (poi-ooxml + dépendances Commons / xmlbeans / log4j-api). Pour une app on-prem packagée en un seul jar (ADR-020), c'est lourd.
- **JExcelApi** : abandonné depuis 2014, ne supporte que xls (pas xlsx). Hors course.
- **fastexcel 0.18** : lib légère focalisée xlsx (~200 Ko de jar), API streaming, supporte exactement ce dont on a besoin (cellules typées, styles basiques, formules SUM, freeze pane). Pas de support des charts ni des styles avancés — non requis pour l'export tabulaire.
- **CSV uniquement** : impose au comptable un re-formatage Excel à chaque export. Refusé en Q5 du brainstorming.
**Choice**: fastexcel. Le footprint est ~70× plus léger qu'Apache POI pour 100 % de couverture du besoin actuel (table plate + ligne de totaux). On accepte de re-router vers POI plus tard si un cabinet pilote demande des formules avancées, des charts ou des feuilles multiples — coût de migration faible (l'interface `InvoiceExporter` isole l'implémentation, swap = 1 classe).
**Consequence**: 1 nouvelle dépendance Maven (`org.dhatim:fastexcel:0.18.4` runtime + `fastexcel-reader` test-scope pour les IT). Build prod jar inchangé en taille perceptible (~+200 Ko). Si un cabinet veut un export xlsx-pivot ou un graphique embarqué, on rouvrira l'ADR.

## ADR-026 — Vaccination worklist: bulk repository load vs. per-patient materializeCalendar calls
**Date**: 2026-05-03
**Status**: accepted
**Context**: `VaccinationQueueService` needs to materialise the calendar for all pediatric patients to build the worklist. Two options: (A) call `VaccinationServiceImpl.materializeCalendar(patientId)` in a loop — clean, reuses existing logic; (B) pre-load schedule + catalog once, then compute per-patient in bulk — avoids N×findActiveById and N×full-entity-load overhead.
**Choice**: Option B (bulk load). For a cabinet with 500 pediatric patients, option A would issue 500 `findActiveById` + 500 `findAll` on vaccine_catalog — a notable n+1 problem. Option B loads them once. The shared private logic (doseKey, computeStatus) is duplicated between `VaccinationServiceImpl` and `VaccinationQueueServiceImpl` — acceptable for MVP; post-MVP extract to a package-private `VaccinationCalendarComputer` utility class.
**Consequence**: Mild code duplication (computeStatus, doseKey). Performance significantly better at queue-scale. Documented in both service class Javadocs.

## ADR-027 — Vaccination worklist: practitionerId filter deferred (cross-module join)
**Date**: 2026-05-03
**Status**: accepted
**Context**: Design Q8 asks for a `practitionerId` filter on the worklist (only show children followed by a given practitioner). Implementing this requires joining `scheduling_appointment` to find the most-frequent practitioner per patient — this crosses the vaccination → scheduling module boundary, violating the no-cross-module-repository rule.
**Choice**: Accept the filter parameter (included in `QueueFilters`) but do not apply it in MVP. Log a DEBUG-level warning when the param is provided. Post-MVP solution: a shared read-model or a JDBC projection that joins across modules with an explicit cross-module exception like BillingService already does.
**Consequence**: Filter is silently ignored in MVP. Documented in `VaccinationQueueServiceImpl` Javadoc and `QueueFilters.practitionerId()` field comment.

## ADR-028 — Vaccination worklist: PageView record over Spring Data Page<T>
**Date**: 2026-05-03
**Status**: accepted (amended 2026-05-03 — voir ADR-029)
**Context**: Spring Data `Page<T>` serialises to JSON with extra HATEOAS fields (`pageable`, `sort`, `first`, `last`, `numberOfElements`, `empty`) that the React client does not use and that introduce brittle coupling to Spring Data internals (the serialisation format may change between Spring Boot minor versions, and PageImpl serialisation logs a WARN in Spring Boot 3.3+).
**Choice**: Custom `PageView<T>` record with `{content, totalElements, pageNumber, number, pageSize, totalPages}` — `number` et `totalPages` ajoutés à la suite du QA wave 7 (2026-05-03) parce que TanStack Query côté frontend les attendait pour la pagination ; `pageNumber`/`pageSize` conservés en alias backward-compat.
**Consequence**: One tiny shared record in the vaccination web DTO package. If other modules need pagination wrappers, promote it to `shared/web/dto/`. Not done now (YAGNI).

## ADR-029 — Frontend-driven DTO contract: nommage des champs aligné avec le client React
**Date**: 2026-05-03
**Status**: accepted
**Context**: QA wave 7 sur le module Vaccination Étape 5 a révélé que `VaccinationQueueEntry` exposait `patientFullName` (concaténation prénom+nom) + `birthDate` + ne portait ni `vaccineId` ni `scheduleDoseId`. Le frontend TypeScript (`useVaccinationsQueue.ts` + `VaccinationsQueuePage*.tsx` + drawer pré-rempli) lisait `patientFirstName` / `patientLastName` / `patientBirthDate` / `vaccineId` / `scheduleDoseId`. Conséquences en browser : table desktop vide (crash silencieux sur `entry.patientFirstName[0]`), crash mobile bloquant, drawer "Saisir dose" cassé (vaccineId undefined → select vide → validation impossible). Tests d'intégration backend passaient car ils n'asseraient que la présence de champs concaténés ou agrégés, pas le contrat exact.
**Choice**: Pour les DTOs servis à un client React typé strict (TS `exactOptionalPropertyTypes`), le nommage des champs DOIT refléter ce que le client utilise réellement, pas une vue agrégée "humaine". Concrètement :
- Pas de concaténation côté backend de champs que le client peut composer (lastName + firstName).
- Inclure les FK utiles à la composition d'un POST en retour (vaccineId, scheduleDoseId, patientId — pas seulement les libellés).
- Préfixer les champs imbriqués par leur entité source quand le DTO est dénormalisé (`patientBirthDate` plutôt que `birthDate` — sinon collision sémantique avec d'autres dates).
- Couvrir la non-régression par un IT de contrat JSON (`*DtoContractIT`) qui assert la présence ET l'absence des champs critiques. Pas suffisant d'asserter `jsonPath("$.content[0].patientLastName")` — il faut `assertThat(entry.has("patientFullName")).isFalse()` pour bloquer un retour de l'ancien nommage.
**Consequence**: Le pattern `*DtoContractIT` devient la 5ᵉ classe de tests vaccination obligatoire (à côté de Catalog/PatientVaccination/Queue/Booklet). Coût : ~5 scénarios par DTO transversal exposé à l'IHM. Bénéfice : un drift backend↔frontend ne traversera plus QA browser sans être attrapé par le pipeline CI.

## ADR-030 — Module Stock : calcul de quantité à la volée + FIFO automatique sur OUT médicaments
**Date**: 2026-05-03
**Status**: accepted
**Context**: Le module Stock interne doit afficher la quantité disponible par article dans la liste et la fiche, ET garantir l'unicité de la décrémentation lors des sorties (OUT) sur des médicaments avec lots multiples (péremptions différentes). Deux décisions liées à arbitrer :
1. **Calcul quantité** : (A) colonne dénormalisée `current_quantity` sur `stock_article` mise à jour sur chaque mouvement (cache, rapide en lecture, risque de dérive cache↔historique en cas de bug ou de migration manquée), ou (B) calcul à la volée via SUM(stock_lot.quantity WHERE status='ACTIVE') pour médicaments / SUM signé sur stock_movement pour non-médicaments (toujours cohérent avec l'historique, coût négligeable < 50 articles cabinet GP).
2. **Stratégie OUT médicament** : (A) FIFO automatique sur `expires_on ASC` ; (B) sélection manuelle du lot par le médecin ; (C) FIFO + override possible.
**Choice**:
- Question 1 → **B (calcul à la volée)**. Pattern aligné `VaccinationQueueServiceImpl` (matérialisation à la volée du calendrier). Évite la dérive et économise une migration de backfill si le module évolue. Cabinet GP a max 50-80 articles, perf non-critique.
- Question 2 → **A (FIFO automatique)**. En consultation, le médecin n'a pas le temps de sélectionner un lot. Risque mitigé : si un lot est rappelé (alerte fournisseur), on le marque INACTIVE en bloc dans le référentiel et le FIFO l'ignore. Override (C) ajoute 30 min d'UI rarement utiles ; sélection manuelle (B) casse le quick-action drawer.
**Consequence**: Pas de colonne `current_quantity` sur `stock_article`. Calcul exposé via méthode `StockMovementService.getCurrentQuantity()` réutilisée par `StockArticleView` enrich + `StockAlertService.lowStock`. FIFO implémenté en `recordOut` qui peut créer plusieurs `stock_movement` rows (un par lot consommé) avec un même `performed_at` — l'historique reste lisible (filtre par mouvement parent absent en MVP, possible v2 via `parent_movement_id`).

## ADR-031 — Module Grossesse : modèle 1-N + plan visites OMS auto + alertes hardcodées + normes Min Santé Maroc PSGA
**Date**: 2026-05-03
**Status**: accepted
**Context**: Le module Suivi prénatal doit représenter l'état "enceinte" d'une patiente, planifier les 8 visites OMS, alerter sur les pathologies fréquentes (HTA gravidique, diabète gestationnel, terme dépassé, BCF absent, BU positive, no-visit T3) et déclencher la création de la fiche enfant à l'accouchement avec calendrier vaccination PNI auto. Trois décisions structurantes prises au brainstorming Q1-Q8 (2026-05-03).

**Alternatives considérées (Q2 — modèle de données)**:
- **A — Tag `is_pregnant` boolean sur `patient_patient`** : ne supporte pas N grossesses dans la vie d'une patiente (la 2ᵉ écrase la 1ʳᵉ). Refusé.
- **C — Étendre `patient_patient` avec colonnes obstétricales** : casse la normalisation, pollue les patients hommes/pédiatriques avec des `IS NULL`, mélange dossier patient général et obstétrical. Refusé.
- **B — Table `pregnancy` 1-N par patiente** : préserve l'historique G/P/A/V (gravidité = `COUNT(*)`, parité = `COUNT(* WHERE outcome IN ('ACCOUCHEMENT_VIVANT','MORT_NEE'))`), badge dossier en jointure simple, alignement Vaccination (table dédiée + service interface cross-module). **Retenu**.

**Alternatives considérées (Q5 — normes de référence)**:
- **OMS 2016** (8 visites prénatales SA 12/20/26/30/34/36/38/40) — supersede l'ancien standard 4 visites OMS 2002 (mortalité augmentée).
- **HAS française** : non applicable légalement au Maroc.
- **Min Santé Maroc PSGA** (Programme de Surveillance de la Grossesse et de l'Accouchement) : aligné OMS + sérologies obligatoires T1 (groupage+Rh, RAI, TPHA-VDRL, HIV, rubéole, toxo, AgHBs, GAJ, BU) + bilan T2 (NFS, toxo si négative, HGPO 75g) + T3 (NFS, RAI si Rh-, prélèvement vaginal strepto B). **OMS + PSGA en cumul retenus** : OMS pour le calendrier de visites, PSGA pour les bilans biologiques par trimestre.

**Alternatives considérées (Q7 — alertes)**:
- **Paramétrables par cabinet** : flexibilité max, complexifie l'UI Paramétrage. Seuils OMS stables ; out of MVP.
- **Hardcodées v1** — 7 règles fixes (HTA TA ≥ 140/90, GAJ glucose urinaire, HGPO post-charge, terme dépassé +7 j, BCF absent SA ≥ 12, BU positive, no-visit T3 > 6 sem). Calculées à la volée (pas de table `pregnancy_alert`), aligné ADR-026 lazy materialisation. **Retenu**.

**Choice**:
1. **Modèle B** — table `pregnancy` 1-N + 3 tables filles (`pregnancy_visit_plan`, `pregnancy_visit`, `pregnancy_ultrasound`). Aucune colonne sur `patient_patient`. Guard service `422 PATIENT_NOT_FEMALE` à la création. JSONB `fetuses` minimal pour un fœtus par défaut (jumeaux/triplés hors MVP).
2. **Plan visites auto-généré à la déclaration** — 8 lignes `pregnancy_visit_plan` créées en transaction (`status = PLANIFIEE` ou `MANQUEE` si déclaration tardive > SA cible). Recompute si `lmp_date` change OU si écho T1_DATATION corrige la DPA (`correctsDueDate=true`).
3. **Alertes calculées à la volée** — pas de table d'alertes, query par grossesse jointe à la dernière `pregnancy_visit` + agrégat 6 dernières semaines. `countActiveAlerts()` = nombre de **grossesses avec ≥ 1 alerte** (pas la somme, sémantique badge "X gestantes à surveiller"). Per-pregnancy loop accepté (10-50 grossesses actives max par cabinet GP).
4. **Bio panel via bouton dossier** — `GET /api/pregnancies/{id}/bio-panel-template?trimester=T1|T2|T3` retourne un template (mapping name → `catalog_lab_test.code` via JdbcTemplate). Côté frontend, **Option D** (preview dialog + clipboard copy) car aucun endpoint prescription standalone n'existe ; promotion vers Option C (`POST /patients/{id}/prescriptions/standalone`) tracée BACKLOG post-pilote.
5. **Clôture → fiche enfant Vaccination** — bouton manuel "Créer fiche enfant" sur grossesse `TERMINEE` + `outcome = ACCOUCHEMENT_VIVANT` → `PatientService.create` cross-module DI, `child_patient_id` lié, calendrier vaccination PNI matérialisé lazy au 1ᵉʳ GET (aligné ADR-026/029).

**Consequence**:
- 4 nouvelles tables (V026), 6 enums domain, 3 services écriture + 3 services lecture, 17 endpoints, 45 IT scénarios. Frontend : onglet `Grossesse` conditionnel `patient.sex === 'F'`, page `/grossesses` worklist, sidebar badge polling 30 s, drawer biométrique contextuel SA.
- Hors scope v1 (tracé BACKLOG `Pregnancy vertical`) : multi-fœtus structuré, carnet maternité PDF bilingue, courbes percentiles Hadlock, score risque Coopland/FMF, monitoring fœtal RCF, seuils paramétrables, sérologies déjà-immunisées, dTcaP mère par grossesse.
- Pattern "endpoint standalone manquant" (BioPanel Option D) = 1ᵉʳ signal qu'une **prescription hors consultation** sera demandée — à promouvoir Option C au signal terrain.

## ADR-032 — Cloisonnement étendu à grossesse : critère any-action + paramètre dédié, symétrie V036
**Date**: 2026-05-09
**Status**: accepted
**Context**: Le toggle V032 `agenda_strict_isolation` cloisonne les agendas + la queue Vaccination (V036). La queue Grossesse `/api/pregnancies/queue` retournait toutes les grossesses EN_COURS du cabinet à tout MEDECIN connecté — un médecin Y voyait les patientes suivies par le médecin X, ce qui contredit l'attente du pilote (« en aucun cas voir les patients en attente suivi par d'autres médecins »). Brainstorming 2026-05-09 (Q1-Q3) :
- **Q1 critère de rattachement** : (A) toute action obstétricale (déclaration / visite / écho / plan), (B) seulement visite ou écho enregistrée, (C) seulement consultation typée SUIVI_GROSSESSE.
- **Q2 patientes orphelines** : (A) paramètre dédié `pregnancy_orphan_visible_roles`, (B) paramètre commun renommé `patient_orphan_visible_roles` partagé avec vaccination, (C) toujours invisible sauf bypass.
- **Q3 réaffectation Dr A → Dr Z (congés)** : (A) cumulatif implicite (tout médecin qui agit se rattache, parité V036), (B) un seul `lead_practitioner_id` + UI « Transférer », (C) cumulatif + UI « Quitter le suivi ».

**Choice**:
1. Q1 → **A toute action obstétricale**. Symétrie exacte V036 vaccination (`administered_by` OU `created_by`). Sources : `pregnancy.created_by`, `pregnancy_visit.recorded_by`/`created_by`, `pregnancy_ultrasound.recorded_by`/`created_by`, `pregnancy_visit_plan.created_by`. UNION ALL en une seule requête bulk dédupliquée en mémoire (Map<UUID, Set<UUID>>). Plus inclusif que (B) — un médecin qui ouvre le dossier sans encore visiter voit la patiente. (C) refusé : couplage fort consultation ↔ grossesse contre lequel ADR-031 a déjà tranché (« vaccination découplée v1 » même esprit).
2. Q2 → **A paramètre dédié** `pregnancy_orphan_visible_roles VARCHAR(32)[]` sur `configuration_clinic_settings` (V039). Default = tous les rôles → comportement historique préservé. (B) cassait le nom V036 et perdait la granularité (un cabinet peut vouloir cacher orphelins vaccination aux secrétaires sans toucher grossesse). (C) bloquait des secrétaires qui ont besoin de voir pour planifier des échos.
3. Q3 → **A cumulatif implicite**. Pas de `pregnancy.lead_practitioner_id`, pas de UI « Transférer ». Si Dr Z fait une visite pour Dr A absent, Dr Z se rattache automatiquement et continue à voir la patiente. Dr A garde aussi la trace (il a suivi la grossesse). Symétrie V036, zéro dette UI/endpoint supplémentaire.

**Consequence**:
- V039 : 1 colonne, 1 commentaire, 0 backfill (DEFAULT remplit l'existant).
- `PregnancyQueueServiceImpl` : injection `AccessScopeService` + `JdbcTemplate`, requête bulk UNION ALL, filtre orphan/scope **avant** le calcul SA + alertes (économise les N+1 alertes coûteuses). Bypass ADMIN + bypass-1-seul-MEDECIN hérités gratuitement de `AccessScopeService`. Aucune logique dupliquée vs V036.
- `PregnancyQueueIsolationIT` (8 scénarios) calque exact `VaccinationQueueIsolationIT` V036.
- `SettingsController` : `ClinicSettingsView` + `UpdateClinicSettingsRequest` étendus, GET et PUT préservent `pregnancyOrphanVisibleRoles`. `PregnancyOrphanRolesSettingsIT` (6 scénarios) couvre default + persistance + RBAC + indépendance V036/V039.
- Frontend : `VaccinationOrphanRolesPanel` refactor en `OrphanRolesPanel<{module: 'vaccination'|'pregnancy'}>` (suppression du composant vaccination-only, deux instances rendues). Hook `useAgendaIsolation` étendu sans casser ses callers.
- Pattern réutilisable : si un module futur (radiologie interne, demandes LAB, grossesse pathologique…) doit gagner le cloisonnement strict, ajouter (i) une colonne `xxx_orphan_visible_roles` à `configuration_clinic_settings`, (ii) une requête bulk équivalente, (iii) `<OrphanRolesPanel module="xxx" />` paramétré. ADR-032 fige le squelette.

---

## ADR-033 — Onboarding wizard à 7 étapes : V040 practitioner credentials + endpoints settings/working-hours et settings/document-templates
**Date**: 2026-05-14
**Status**: accepted
**Context**: L'onboarding wizard accessible à `/onboarding` après `/register` rendait 4 étapes (Cabinet / Tarifs / Équipe / Récap). Le prototype `design/prototype/screens/onboarding.jsx` en prévoit 7 (ajoute Médecin / Horaires / Documents). Les commentaires dans `OnboardingPage.tsx` justifiaient le drop par « backend pas encore en place pour `config_working_hours` ni les templates ». Mais en réalité (a) `scheduling_working_hours` existait depuis V001 avec seed Mon-Sat dans V002 — seule l'API REST manquait (entité read-only sans controller), (b) `configuration_document_template` existait aussi depuis V001 avec 5 templates seedés — pareil, pas d'API, (c) les credentials par praticien (INPE, CNOM, CNOPS) requis sur les ordonnances n'étaient pas modélisés au niveau utilisateur (seule la spécialité l'était via V032). Décision : compléter le wizard à 7 étapes en livrant en parallèle (ADR-021 parallel-sync) tous les morceaux backend manquants — pas en bouchant côté FE seulement.

**Choice**:
1. **V040** ajoute trois colonnes nullable à `identity_user` : `inpe VARCHAR(32)`, `cnom VARCHAR(64)`, `cnops VARCHAR(64)`. Pourquoi sur `identity_user` plutôt qu'une table `practitioner_profile` séparée : un cabinet multi-praticien doit pouvoir injecter les credentials du médecin signataire sur chaque PDF, pas ceux du cabinet. Cabinet-level INPE reste sur `configuration_clinic_settings` (fallback PDF si user.inpe NULL). Nullable car solo cabinets pré-pilote n'ont jamais saisi ces données — pas de backfill.
2. **`WorkingHoursController`** expose `GET /api/settings/working-hours` et `PUT /api/settings/working-hours` en *replace-all* (le body contient les 7 jours, l'endpoint DELETE + INSERT en une transaction). Pourquoi pas un PATCH par jour : la lecture côté agenda (slot availability) profite d'une table cohérente sans branche partielle ; le wizard et la page Paramétrage soumettent toujours la semaine entière. Validation côté contrôleur : `start < end` par slot, pas de chevauchement entre slots d'un même jour. Format `HH:mm` accepté (regex), stocké en `TIME WITHOUT TIME ZONE`.
3. **`DocumentTemplateController`** expose `GET /api/settings/document-templates` uniquement (lecture seule pour l'onboarding). L'admin peut voir la liste des modèles seedés (5 par défaut : ORDONNANCE / CERTIFICAT / FACTURE / BON_ANALYSE / BON_RADIO) avec leur taille et leur format, mais l'édition du HTML/CSS reste réservée à Paramétrage → Documents (pas dans la portée v1 du wizard). La réponse n'inclut PAS le corps `html_template` pour éviter de transférer ~3 Ko inutiles à un client qui n'affiche qu'un récapitulatif.
4. **`AdminUserController.PUT /{id}`** et le DTO `UpdateUserRequest` étendus avec `Optional<String> inpe`, `cnom`, `cnops` (sémantique tri-état déjà en place — absent = ne pas toucher, présent = écraser, présent blank = NULL). Le bootstrap admin appelle directement ce endpoint sur son propre UUID lors de l'étape Médecin du wizard (il est ADMIN donc autorisé). Aucun nouveau endpoint « self » créé : on évite la duplication entre `/api/users/me` (déjà étendu pour exposer les nouveaux champs en lecture) et un hypothétique `PUT /api/users/me` (qui aurait dupliqué les règles d'autorisation).
5. **Frontend** : `OnboardingPage.tsx` réécrit avec 7 entrées dans `STEPS`. Footer dynamique « Continuer — `<next-label>` » fidèle au prototype. Le récap est dynamique (compte des jours ouverts, templates, signature présente, spécialité saisie, équipe ajoutée) — pas de placeholder hardcodé. Hooks dans `useOnboardingApi.ts` centralisent les appels aux 3 nouveaux endpoints.

**Consequence**:
- Migration `V040__practitioner_credentials.sql` (3 colonnes additives, idempotent via `IF NOT EXISTS`).
- Backend : 2 nouveaux contrôleurs (`WorkingHoursController` 130 LOC, `DocumentTemplateController` 50 LOC) ; entité `User` + `UserView` + `UpdateUserRequest` + `AdminUserController` étendus pour les 3 champs.
- Frontend : `OnboardingPage.tsx` passe de 4 → 7 steps (~250 → 700 LOC). Nouveau fichier `hooks/useOnboardingApi.ts`. Test `OnboardingPage.test.tsx` mis à jour pour la nouvelle shape (7 step labels).
- Validation manuelle Playwright bout-en-bout desktop 1440 px + mobile 390 px (memory `feedback_qa_mobile_parity`). DB inspectée après chaque save (`identity_user`, `scheduling_working_hours`). Pas d'IT BE écrites cette session (memory `feedback_no_mvn_verify_for_now` — IHM only).
- Pattern réutilisable : si une future étape de wizard a besoin d'un endpoint de configuration cabinet-level, suivre la signature « JdbcTemplate dans `infrastructure/web/`, replace-all si la donnée est consommée comme un set, RBAC `hasRole('ADMIN')` sur PUT et `hasAnyRole` sur GET ». Pas de service application/ ni d'entité JPA pour ce genre de table single-row.

---

## ADR-034 — Onboarding gate-and-resume + V041 act insurance flags + V042 cabinet mentions + iso-maquette polish
**Date**: 2026-05-14
**Status**: accepted
**Context**: Après ADR-033 (wizard 7 étapes wired), trois besoins sont remontés en série :
1. Un audit `design-parity-auditor` a chiffré une longue liste d'écarts vs le prototype (sidebar 360 px absente sur les 7 steps, Tarifs sans nomenclature CNOPS/CNSS/RAMED, Médecin en formulaire solo au lieu d'une team list, Récap en `<ul>` à puces au lieu du banner+table+cards, Cabinet sans type-selector / RC / IF / Forme juridique, Documents en table read-only au lieu d'un éditeur logo+en-tête).
2. Le wizard tournait sur la route `/onboarding` mais aucune logique ne forçait sa complétion : un admin pouvait sauter le wizard et atterrir sur `/agenda` avec un cabinet non-configuré. Demande pilote : « configuration initiale should be done once first login or even if he logged in but never finished it » + « remember step if he stopped in third or fourth ».
3. Le bouton de fin disait "Aller à l'agenda" sans marquer le wizard comme terminé — pas de signal pour la suite.

Trois décisions imbriquées sont prises :

**Choice**:

1. **V041 — drapeaux d'éligibilité assurance sur `catalog_act`**. Trois colonnes `cnops_eligible`, `cnss_eligible`, `ramed_eligible` BOOLEAN NOT NULL DEFAULT TRUE. Seed corrigé : `CERT_*` + `VISITE_DOM` non éligibles RAMED (actes administratifs, pas de soin clinique), `CONS_URG` éligible uniquement CNOPS (carve-out réglementaire marocain). `ActResponse` exposé via le mapper avec `code` + `defaultPrice` + les 3 flags pour que le wizard ne fasse pas de N+1 sur `GET /api/catalog/acts`. Pourquoi sur `catalog_act` plutôt qu'une table de liaison `act_insurance_eligibility(act_id, insurance_code, eligible)` : on a 3 schémas marocains stables (CNOPS/CNSS/RAMED), les flags ne migrent jamais une fois fixés, et la JOIN à chaque facturation aurait coûté inutilement.

2. **V042 — gate-and-resume + RC/IF/legal_form sur `configuration_clinic_settings`**. Cinq colonnes additives :
   - `onboarding_completed_at TIMESTAMPTZ NULL` : non-null = clic "Ouvrir mon cabinet" déjà fait, gate désactivé.
   - `onboarding_current_step VARCHAR(32) NULL` : `cabinet|medecin|horaires|equipe|tarifs|documents|recap` ou NULL = jamais démarré OU terminé.
   - `rc`, `if_no`, `legal_form` VARCHAR : mentions légales étendues pour parité maquette + injection PDF.
   
   Pourquoi cabinet-level et pas user-level (`identity_user.onboarding_*`) : le wizard configure du cabinet-wide state (clinic settings, working hours, tarifs, document templates). Une fois fait par un admin, les autres admins n'ont pas à le refaire. Le gate force `/onboarding` sur `ADMIN`/`MEDECIN` quand `completed_at IS NULL` — les autres rôles (SECRETAIRE, ASSISTANT, LAB, RADIO) passthrough parce que le controller gate déjà `PUT/POST` sur `ADMIN/MEDECIN` et bloquer ces rôles sur un écran qu'ils ne peuvent pas résoudre les enfermerait. Le gate vit dans `<RequireOnboardingComplete>` qui wrappe `<AppLayout>` dans le router.
   
   Persistance step : chaque `advanceTo(idx)` côté wizard PUT `onboarding_current_step`. Un refresh/logout au milieu de l'étape 4 ramène l'utilisateur sur l'étape 4, pas l'étape 1. L'`OnboardingStateController` crée un stub-row vide sur la première écriture si nécessaire — l'admin peut PUT sa progression avant même d'avoir sauvegardé l'identité cabinet (cas d'un drop-off prématuré entre l'étape 1 et son save).

3. **Iso-maquette polish — 4 chantiers parallèles**. Tous les écarts haute-priorité de l'audit traités en un cycle :
   - **Cabinet (step 1)** : 3-card "Type de cabinet" wired à V034 `establishment_type` (CABINET/CLINIQUE/CENTRE_MEDICAL), label "Raison sociale" (vs "Nom du cabinet"), Forme juridique `<select>` parmi 4 valeurs marocaines, RC + IF dans une rangée 3-col avec ICE. `SettingsController.PUT` utilise `COALESCE(?, rc)` pour ne pas écraser les valeurs courantes si un client legacy n'envoie pas les nouveaux champs.
   - **Médecin (step 2)** : refactor du formulaire solo en team list multi-praticiens. `AdminUserView` étendu avec `specialty/inpe/cnom/cnops/hasSignature` + SQL `listUsers()` enrichi pour rendre tous les MEDECIN en une requête (pas de N+1). Le current admin a un badge "VOUS" et son card est éditable inline ; les autres médecins sont read-only avec la grille credentials. Modal `AddDoctorModal` POST `/api/admin/users` avec les credentials (CreateUserRequest étendu).
   - **Tarifs (step 5)** : table nomenclature complète Code / Acte / Prix MAD / CNOPS / CNSS / RAMED rendue depuis `GET /api/catalog/acts`. La remise Premium reste éditable en-dessous. L'édition fine des flags est différée à Paramétrage → Catalogue (logged BACKLOG).
   - **Documents (step 6)** : tab bar Ordonnance/Facture/Certificat/CR (visuel pour l'instant), real logo upload réutilisant `PUT /api/settings/clinic/logo` avec drop-zone 88×88, en-tête READ-ONLY sourçant nom/spécialité/INPE/CNOM/ICE des steps 1+2 (pas de duplication d'édition), signature status reflétant l'upload de l'étape 2, pied-de-page auto-calculé concaténant ICE/RC/IF, et 3 checkboxes options visuelles disabled (filigrane/QR/bilingue) marquées Paramétrage-v1.1.
   - **Récap (step 7)** : success banner vert + table summary 6 rows avec icon ok/warn dynamique + boutons "Modifier" qui re-route au step concerné (via `onGoToStep` callback) + grille 2×2 "Prochaines étapes". Le sidebar passe à "Votre abonnement" (essai 14j) + "Besoin d'aide ?" + Maroc badge — match prototype lignes 463-507.
   - **Sidebar transverse** : `OnboardingSidebar` rend un panel contextuel par step (Why-cards, Comment-ça-marche tips, mini-agenda live, forfait usage bar, facture preview live, aperçu A4, abonnement+help). Le CSS `.ob-body grid-template-columns: 1fr 360px` était déjà en place — il fallait juste rendre le 2ᵉ enfant.

**Consequence**:
- 3 migrations idempotentes (V040 ADR-033 + V041 + V042) ; aucune ne nécessite de backfill stratégique.
- 4 commits parité polish + 1 commit gate-and-resume sur la branche `feat/desktop-refresh-and-brand-refresh` (cf. PROGRESS.md).
- Tests onboarding 3/3 + routes 7/7 PASS. Build front green. Validation Playwright bout-en-bout : gate bounce, walk 7 steps, complete CTA, refresh post-complete (no bounce), reset state à step 3 → resume direct.
- Pattern réutilisable : si une future feature a besoin d'un gate cabinet-level (premier abonnement Premium, mise à jour CGU…), ajouter une colonne `xxx_completed_at` à `configuration_clinic_settings` + `<RequireXxxComplete>` wrapper. ADR-034 fige le squelette.
- Items différés en BACKLOG `Onboarding wizard — parité design différée` réduits drastiquement (il reste : édition flags CNOPS/CNSS/RAMED inline, currency toggle MAD/EUR, tiers-payant / majoration toggles, cachet officiel upload, options filigrane/QR/bilingue activables, document template body editor Paramétrage).

## ADR-035 — Chat interne médecin ↔ staff v1 : DM 1-1 + polling
**Date**: 2026-05-20
**Status**: accepted
**Context**: Demande Y. Boutaleb d'une messagerie entre médecin et son équipe. Cabinet on-premise (1 process, pas de Redis ni broker), ~5-7 users, polling déjà utilisé partout (queue 15 s, badges 30 s). Pas de besoin grand public.
**Choice**:
1. **Modèle conversationnel** : DM 1-1 uniquement en v1, pas de canaux/groupes ni de chat patient-contextualisé. Décision : 7 personnes se connaissent — un fil par paire suffit.
2. **Transport** : polling TanStack Query (badge sidebar 30 s, liste conversations 10 s, fil ouvert 5 s). Pas de SSE ni WebSocket — latence 5-10 s acceptable, on garde la simplicité du contrat REST et 0 nouvelle dépendance. Upgrade SSE possible plus tard sur le même contrat.
3. **Contenu** : texte 1..2000 chars seulement. Pas de PJ, pas de lien patient/RDV. Périmètre v1 livrable en ~2 J — extensions tracées en BACKLOG.
4. **RBAC** : tous ↔ tous (au sein du cabinet), pas de permission atomique `CHAT_USE` en v1. Cabinet petit, cloisonnement non demandé.
5. **Messages immuables** : pas d'édition ni de suppression. Cohérent avec la nature audit-friendly d'un SI médical. Ré-évaluer en v2 si demandé.
6. **Schéma canonique** : `chat_conversation (user_a_id < user_b_id)` UNIQUE — garantit une seule conv par paire sans logique de dédoublonnage côté code (on swap à l'insertion).
7. **Persistence** : pur JdbcTemplate (pattern dashboard), pas d'entité JPA. 3 tables simples sans cross-entité.

Endpoint dédié `GET /api/chat/colleagues` pour le picker "Nouveau message" (`/admin/users` est gated ADMIN-only et exclut secrétaires/assistants).
**Consequence**: V048 + 6 endpoints + 12 IT + slice frontend complet desktop+mobile + badge sidebar + entrée menu Plus mobile. Si un cabinet pilote demande PJ ou canaux thématiques, on étend (table de liaison pour PJ, table `chat_channel` pour groupes) sans casser le contrat REST 1-1 existant.

---

## ADR-036 — Modèles de courrier confrère : module dédié (miroir consentement), pas d'extension du carnet

**Date**: 2026-05-27
**Status**: accepted
**Context**: Bug backlog — « quand un médecin charge un modèle pour courrier confrère, le texte de la lettre ne se charge pas ». La modale « Courrier confrère » n'avait qu'un sélecteur « Confrère (carnet) » (pré-remplit le destinataire). Aucun système de modèles de lettre n'existait. Le médecin attend un comportement type consentement : choisir un modèle → remplir le corps.
**Choice**:
1. **Nouveau module `confrere_letter_template`** (V063) plutôt que stocker le texte dans le carnet (`referral_contact.notes`) : un modèle de lettre est un texte réutilisable indépendant du destinataire, alors qu'un contact est une personne. Mélanger les deux aurait lié 1 modèle à 1 confrère.
2. **Miroir exact des modèles de consentement** (entité + repo + service + controller CRUD + onglet Paramétrage ADMIN), **sans champ `type`** (une lettre n'a pas de catégorie métier). RBAC : lecture MEDECIN+ADMIN (médecin = actifs seuls), écriture ADMIN.
3. **Pas de placeholders** en v1 (texte brut). Le PDF de la lettre vit déjà dans `ConfrereLetterService` (QA9-10) ; le modèle n'alimente que le corps côté UI.
**Consequence**: V063 + module `ma.careplus.confrere.*LetterTemplate*` + 6 IT verts. Frontend : `useLetterTemplates`, select « Modèle de courrier » dans la modale, onglet « Courriers confrère ». Extension placeholders/variables traçable plus tard sans casser le contrat.

## ADR-037 — Salle d'attente multi-médecin : cartes compactes par colonne, pas la table plate

**Date**: 2026-05-27
**Status**: accepted
**Context**: Bug backlog — affichage décalé / sauts de ligne injustifiés quand la secrétaire gère ≥2 médecins. Les colonnes par médecin (QA9-11) réutilisaient la table plate à 8 colonnes (`tableHead`) dans un conteneur ~300 px → cellules et boutons d'action qui débordent, hauteurs de lignes irrégulières entre colonnes.
**Choice**: rendre le contenu de chaque colonne en **cartes verticales compactes** (`QueueColumnCard` : identité+statut sur une ligne, méta sur la 2e, actions en pied avec `flex-wrap`) au lieu d'une table large. La table plate reste utilisée en mode solo (1 praticien actif) où la largeur le permet. Colonne = `role="list"` (test ajusté de `table` → `list`).
**Consequence**: nouveau composant + CSS `.sa-col-list/.sa-col-card*`. Pas de changement de contrat ni de données. Mode solo intact.

## ADR-038 — Téléchargement PDF post-`await` : `<a download>`, pas `window.open`

**Date**: 2026-05-27
**Status**: accepted
**Context**: Bug backlog — la génération du courrier confrère ouvrait un `window.open(blobUrl)` APRÈS deux `await` (POST génération + GET blob). Hors du geste utilisateur, les navigateurs bloquent la pop-up → « rien ne se passe ».
**Choice**: livrer le blob via un `<a download>` créé/cliqué par programme (pattern `downloadDocument()` du dossier patient), qui n'est PAS soumis au blocage de pop-up même après un `await`. Le document restait rattaché côté serveur ; seul l'aperçu était bloqué. Pattern à privilégier pour toute livraison PDF différée (les autres modales — consentement, certificat, écho — gardent `window.open` pour l'instant ; à migrer si le même retour terrain remonte).
**Consequence**: fix local `ConfrereLetterDialog`, toast clarifié « généré et rattaché à la consultation ».

## ADR-039 — Assistant IA médecin : provider abstrait OpenAI-compatible, Gemini par défaut

**Date**: 2026-05-27
**Status**: accepted
**Context**: Besoin d'un assistant IA pour les médecins (chat médical général + aide contextuelle sur le dossier patient). Exigence : « une IA gratuite pour l'instant, mais configurable pour basculer vers Claude/GPT ». Contraintes careplus : déploiement on-premise possible, données médicales sensibles, pas de nouvelle dépendance lourde (ADR-015/016/017).
**Choice**:
1. **Abstraction `AiChatClient`** comme unique point de couplage au fournisseur. Implémentation par défaut `OpenAiCompatibleChatClient` parlant le protocole *OpenAI Chat Completions* — couvre d'emblée **Gemini** (endpoint de compatibilité OpenAI de Google), **OpenAI/GPT**, **Groq** et **Ollama** (local) par simple reconfiguration `careplus.ai.{provider,base-url,model,api-key}`. **Claude** (schéma Anthropic différent) = future 2e implémentation de la même interface, zéro changement applicatif.
2. **Provider par défaut = Gemini `gemini-2.5-flash`** (free tier), clé via `GEMINI_API_KEY` (env, jamais commitée). Sans clé → module « non configuré » : endpoints 503 propres, IHM affiche un bandeau + composer désactivé.
3. **Client HTTP = Spring `RestClient`** (déjà fourni par `spring-boot-starter-web`, pas de WebFlux/feign à ajouter) ; parsing par `JsonNode` (tolérant aux variations entre providers).
4. **Persistance JdbcTemplate** (pattern dashboard/chat), 2 tables V064 (`assistant_conversation` + `assistant_message`), cloisonnées par `owner_id`. Messages horodatés `clock_timestamp()` (et non `now()`, figé en transaction) pour un ordre USER→ASSISTANT déterministe.
5. **Contexte patient anonymisant** : le résumé clinique injecté (prénom, âge, sexe, groupe, allergies, antécédents, dernières constantes/consultations) **exclut** les identifiants directs (CIN, téléphone, adresse, nom de famille) — minimise ce qui transite vers un provider cloud.
6. **RBAC MEDECIN + ADMIN** uniquement (aide à la décision clinique, pas outil de secrétariat).
**Consequence**: module `ma.careplus.assistant` (config + abstraction + impl + service + controller 5 endpoints `/api/assistant/**`) + V064 + `AssistantIT` 10/10 verts (provider stubé, aucun appel réseau en test). Frontend `features/assistant/` (chat desktop 2-cols + mobile + bouton « Demander à l'IA » dans le dossier). Le seul chemin non testé en automatique = l'appel HTTP réel au modèle (nécessite une clé + réseau) ; le reste de la logique est couvert par le stub.

---

## ADR-040 — Notifications sortantes : module event-driven + provider SPI, WhatsApp Meta Cloud API + email SMTP

**Date**: 2026-05-27
**Status**: accepted (socle + trigger RDV créé livrés ; providers réels + UI en phases suivantes)
**Context**: demande client — notifier le patient à la création d'un RDV, rappel J-1, et (différé) envoyer l'ordonnance à la clôture. Canal **WhatsApp** (pas SMS) + email **gratuit**. Cabinet on-premise (pas de broker — ADR-020), PII médicale sensible.
**Choice**:
1. **WhatsApp = Meta Cloud API** (palier gratuit ~1000 conv/mois, officiel). Pas d'API WhatsApp gratuite illimitée ; les libs non-officielles (Baileys) violent les CGU → écartées pour un produit médical. Messages business-initiated → **templates Meta approuvés** (setup cabinet, hors code).
2. **Email = SMTP configurable** (`spring-boot-starter-mail`) : le cabinet branche son fournisseur gratuit (Gmail/Brevo/propre). Aucun couplage fournisseur.
3. **Module `ma.careplus.notification` event-driven** : `AppointmentCreatedEvent` (publié par scheduling) + `@TransactionalEventListener(AFTER_COMMIT)` → jamais bloquant pour le métier. **Provider SPI** (`NotificationSender` par canal) ; sans envoyeur réel configuré → **NoOp** (statut `SENT_SIMULATED`, aucun envoi). Master switch `careplus.notifications.enabled` (OFF par défaut).
4. **Outbox** (`notification_outbox`) : journal + file, idempotence via `dedupe_key` UNIQUE, retry borné, tolérance hors-ligne.
5. **Templates** (`notification_template`) par (event_key, channel), placeholders `{{patientNom}}…`, admin-managed (UI phase 4).
6. **Confidentialité** : envoi seulement si `patient.notifications_opt_in` + contact présent ; documents médicaux (ordonnance, v2) par **lien signé**, jamais le PDF en clair.
**Consequence**: V065 (templates+outbox+opt-in patient) + module + `AppointmentCreatedEvent` câblé dans `SchedulingService.create()` + NotificationOutboxIT 5/5. Phases restantes : rappel J-1 (`@Scheduled`), providers réels (SMTP+Meta, derrière config) + onglet Paramétrage Notifications + case opt-in dossier patient. Envoi réel non testable en CI (identifiants Meta/SMTP cabinet) → couvert par provider stub + futur test de contrat du payload Meta.

---

## ADR-040 — Rôle SUPER_ADMIN + gating des techniciens internes

**2026-05-30** · Status: accepted

V069. Nouveau rôle `SUPER_ADMIN` (hiérarchie additive : il porte aussi `ADMIN`). Seul un super admin peut modifier les sections sensibles du paramétrage cabinet — **Identité du centre**, **Services internes** (labo/radio/pharmacie), **Hospitalisation**. Un `ADMIN` normal garde tout le reste (utilisateurs, catalogue, tarifs…) mais voit ces 3 sections en lecture seule (fieldset grisé + bouton masqué IHM ; garde réelle dans `SettingsController.updateClinic` : compare les valeurs entrantes à l'état en base, 403 si un champ protégé change). Migration : tous les `ADMIN` existants promus `SUPER_ADMIN` (aucune install ne perd l'accès) ; le bootstrap du premier admin accorde les deux rôles. Même lot : créer un technicien RADIO exige `imaging_internal`, LAB exige `lab_internal` (front masque l'option + garde BE 400). Pourquoi diff-de-valeurs plutôt que `@PreAuthorize` strict : le même endpoint porte des champs non sensibles (cloisonnement, rôles orphelins, modules) qu'un admin normal doit pouvoir éditer.

---

## ADR-041 — Habilitation des modules par l'admin

**2026-05-30** · Status: accepted

V070. Colonne `configuration_clinic_settings.disabled_modules TEXT[]` (vide = tout activé → aucune régression, pas de backfill). L'admin active/désactive les fonctionnalités **secondaires** (vaccinations, grossesses, stock, messages, assistant, charges) depuis un panneau Paramètres ; un module désactivé disparaît de la nav desktop (Sidebar) ET mobile (menu « Plus »). Modules cœur (agenda, patients, salle, consultations, facturation, catalogue, personnel, paramètres) **non** débrayables — le backend rejette toute valeur hors liste blanche (400). L'hospitalisation garde sa capability dédiée (V054). Liste de DÉSACTIVÉS et non d'ACTIVÉS pour que le défaut « tout activé » ne touche aucune install existante.

---

## ADR-042 — Sauvegarde/restauration BDD + protection du code source

**2026-05-30** · Status: accepted

**Sauvegarde** : scripts PowerShell on-premise (`scripts/backup/careplus-backup.ps1`) — `pg_dump -Fc` horodaté vers disque externe (`CAREPLUS_BACKUP_DIR`), rétention configurable, planifiable via le Planificateur Windows (README fourni). **Restauration** : double accès — script CLI de secours (`careplus-restore.ps1`) ET écran in-app réservé `SUPER_ADMIN` (`BackupController` + `BackupRestorePanel`, double confirmation « RESTAURER », validation anti-traversée, `pg_restore --clean --if-exists`).

**Dépendance d'exploitation** : l'écran in-app shelle `pg_restore` sur la machine **où tourne la JVM** ; il doit donc y être installé (cas du déploiement on-premise où PostgreSQL est sur l'hôte). En dev où PostgreSQL est dans Docker, l'hôte n'a pas le binaire → l'écran renvoie une 500 actionnable (`RESTORE_PG_RESTORE_MISSING`, configurer `careplus.backup.pg-restore-bin`) ; le script CLI et le mécanisme `pg_dump`/`pg_restore` (format custom, `--clean`) sont, eux, vérifiés bout-en-bout (un user créé après le dump disparaît après restore).

**Protection du code source** : stratégie par étapes — JAR scellé + bundle JS obfusqué + secrets hors-binaire + Swagger off en prod, complétée par une clause contractuelle (détail dans [`docs/adr/ADR-042-source-code-protection.md`](adr/ADR-042-source-code-protection.md)). Aucune protection n'est inviolable quand le client possède la machine ; l'objectif est de relever la barre. Étape A (hygiène de livraison) applicable ; B (obfuscation, avec son ADR de dépendance) et C (ProGuard, optionnel) planifiées.

---

## ADR-043 — Recherche de menus + i18n multilangue maison (FR/EN/AR/ES, RTL)

**2026-05-30** · Status: accepted

**#123 — recherche de menus** : champ en tête de sidebar qui filtre les items de
navigation déjà visibles (insensible casse/accents), liste « Résultats » à plat,
Entrée → 1er match. Respecte le gating existant (rôles, capabilities, modules V070) :
on ne filtre que ce que l'utilisateur peut voir.

**#122 — multilangue** : 4 langues (fr/en/ar/es), langue réglée par le SUPER_ADMIN
(V071 — champ protégé de `/settings/clinic`). **i18n maison, zéro dépendance** plutôt
que react-i18next : besoin v1 simple (clés plates, interpolation `{var}`, fallback fr,
bascule RTL), et la règle ADR-015/016/017 impose de défendre toute dépendance front
contre la contrainte on-prem + design custom — une `Map` par langue + un Context y
répondent sans surface supplémentaire. `I18nProvider` lit la langue cabinet, expose
`useT()` et pose `<html dir/lang>` (RTL pour l'arabe). 1re tranche traduite : la
navigation ; les autres écrans migrent leurs chaînes vers `lib/i18n` au fil de l'eau.

Garde #120 associée : seul un SUPER_ADMIN peut créer/promouvoir un SUPER_ADMIN
(garde serveur dans `AdminUserController`, en plus du masquage IHM).

Limite assumée : traductions ar/es fonctionnelles mais à faire relire par un
locuteur natif avant prod ; couverture i18n partielle (nav d'abord), élargie ensuite.

---

## ADR-044 — Apparence configurable par le super admin + mode sombre (thème global)

**2026-05-30** · Status: accepted

Demande : porter le panneau *Tweaks* de la maquette « Calm Premium » en réglage réel
**configurable par le super admin**, mode sombre inclus.

**Périmètre des réglages.** On retient le sous-ensemble *app-wide* qui a un sens sur le
shell réel : **police**, **ambiance (canvas, 7 tons)**, **accent**, **mode sombre**. On
**écarte** les tweaks *logo / nav-style / button-style* de la maquette : le logo passe
déjà par `LogoSettingsSection` (upload réel) et le shell n'a pas d'état « nav active
remplie encre » distinct de l'accent — les forcer aurait demandé de refondre la sidebar
sans gain. L'accent recolore déjà nav + CTA de façon cohérente.

**Mécanisme.** Le thème est appliqué en écrivant des variables CSS sur `<html>`
(`lib/theme/appearance.ts`), ce qui surcharge à la fois les tokens de `tokens.css` et les
`--ds2-*` lus par le shell — toute l'app bascule d'un coup. Pas de feuille de styles
sombre dédiée à maintenir : une palette sombre + les tons clairs sont calculés et posés
en variables. Bootstrap **sans flash** : `main.tsx` applique le dernier thème (cache
`localStorage`) avant le 1er rendu ; `AppearanceProvider` (sous le QueryClient, comme
`I18nProvider`) reconcilie ensuite avec la valeur cabinet.

**Persistance = champ protégé super admin, comme la langue.** L'apparence est un JSON
stocké dans `configuration_clinic_settings.appearance` (**V072**), exposé par
`/settings/clinic` et **protégé** par `requireSuperAdminIfProtectedChanges` (mêmes garde
et schéma que `language`/V071, ADR-043). Choix de la persistance backend (et non
localStorage seul) : « configurable par le super admin » signifie un réglage **cabinet**
qui s'applique à tous les postes — le cache local ne sert qu'à l'anti-flash. Si le backend
ne renvoie pas encore d'apparence (cabinet neuf), on retombe sur le cache plutôt que de
réinitialiser.

Pas de dépendance ajoutée (règle ADR-015/016/017) : variables CSS natives + polices déjà
bundlées (`@fontsource` Geist / Plus Jakarta) ; l'option « Système » n'embarque rien.

Limite assumée : 1er passage de mode sombre — couverture par tokens (la grande majorité
des écrans) ; quelques couleurs codées en dur dans des écrans profonds peuvent demander un
ajustement ultérieur. ITs `SettingsController` (round-trip `appearance` + garde 403) à
ajouter en 2e passe.

## ADR-045 — Apparence personnelle par utilisateur (override du défaut cabinet)

**2026-06-02** · Status: accepted · étend ADR-044

Demande produit : « le paramétrage de l'apparence doit être associé à chaque utilisateur ;
chacun doit pouvoir personnaliser son affichage, pas un réglage général à tous ». ADR-044
avait fait de l'apparence un réglage **cabinet** unique (super admin). On garde ce défaut
cabinet et on ajoute un **override personnel**.

**Résolution.** Le thème effectif appliqué par `AppearanceProvider` est :
**override perso → défaut cabinet (V072) → défaut application**. L'override est un objet
d'apparence complet (pas un patch champ-par-champ) ; `null` = suit le défaut cabinet.

**Persistance.** Nouvelle colonne `identity_user.appearance` (**V073**, VARCHAR 2000, JSON
opaque comme la valeur cabinet). Endpoints dédiés `GET`/`PUT /api/users/me/appearance`,
ouverts à **tout utilisateur authentifié** (chacun gère le sien — pas de garde super admin,
contrairement au défaut cabinet). Endpoints isolés préférés à l'ajout d'un champ sur
`UserView`/`/me` pour ne pas faire rippler le DTO d'auth.

**IHM.** Le panneau Apparence montre « Mon apparence » (tous) + « Apparence par défaut du
cabinet » (super admin seulement), avec une action « Réinitialiser au défaut du cabinet »
(PUT `appearance:null`).

**Robustesse.** Si l'endpoint répond en erreur (backend antérieur à V073, réseau), le front
traite comme « pas d'override » et retombe sur cabinet/défaut plutôt que de bloquer
l'application du thème (même esprit que `useClinicSettings`). Le cache local ne sert qu'à
l'anti-flash ; le backend reste la vérité par utilisateur. Pas de dépendance ajoutée.

## ADR-046 — Dissuasion capture d'écran / enregistrement : filigrane d'identité, pas de blocage dur

**2026-06-02** · Status: accepted

Demande produit : « ne pas permettre les captures d'écran ni les enregistrements vidéo ».

**Limite assumée (honnête).** Une application **web** ne peut pas empêcher techniquement une
capture OS (Impr.écran, outil Capture, photo d'un téléphone, OBS, partage d'écran) — le
navigateur n'a pas cet accès. Un vrai blocage exigerait un conteneur natif desktop
(ex. Electron `setContentProtection(true)`), hors périmètre v1.

**Décision : dissuasion + traçabilité, pas blocage.** Composant `ScreenProtection` monté
dans `AppLayout` (écrans authentifiés) :
1. **Filigrane d'identité** répété en diagonale (nom · e-mail · horodatage de l'utilisateur
   connecté), `position:fixed`, `pointer-events:none`, faible opacité → toute capture /
   tout enregistrement reste **attribuable** à la session (dissuasif réel).
2. **Clic droit désactivé** (gêne « Enregistrer l'image »).
3. **Impr.écran** : meilleure-effort (efface le presse-papiers + toast d'avertissement) —
   non garanti (touche gérée par l'OS), purement dissuasif.

On n'a **pas** bloqué `copier` / `Ctrl+P` (usages légitimes : copier un téléphone, imprimer
une ordonnance). Le filigrane reste visible à l'impression (sinon vecteur de capture sans
traçabilité). Évolution si exigence de blocage dur : wrapper desktop dédié (à arbitrer avec
ADR-020 packaging).

## ADR-047 — Autorisation de déploiement (anti-déploiement non autorisé) — PROPOSÉ

**2026-06-02** · Status: proposed · revient sur ADR-010 · détail : `docs/design/DEPLOYMENT_AUTHORIZATION.md`

Demande produit : empêcher qu'un technicien réutilise le livrable pour déployer chez
d'autres clients sans notre accord. ADR-010 avait acté « pas de module de licence en v1 » —
ce besoin **revient sur** cette position.

**Orientation recommandée (à valider).** Licence **signée hors-ligne** (Ed25519, clé
publique embarquée, vérifiée au boot) **liée à une empreinte machine**, + couche
**révocation/renouvellement en ligne** optionnelle (best-effort). Justifié par la réalité
on-prem marocaine (connectivité intermittente) : boot 100 % hors-ligne, **jamais** de
lock-out d'un client payant si notre serveur est injoignable (fenêtre de grâce, dégradation
en lecture seule plutôt que service mort).

**Limite assumée.** Du logiciel sur une machine que le client contrôle ne peut pas être
inviolable ; l'objectif est de rendre le déploiement non autorisé **coûteux, détectable et
contractuellement opposable**, pas impossible — le vrai garde-fou final est la clause
contractuelle « une licence = un cabinet ». Détail (modèle de menace, options, empreinte,
gestion des clés, comportements d'échec, esquisse d'implémentation) : voir le doc de
conception. Décision finale à figer avant build.

## ADR-048 — Mode dégradé + import de données (Excel/CSV) — PROPOSÉ

**2026-06-02** · Status: proposed · détail : `docs/design/DEGRADED_MODE_IMPORT.md`

Demande produit : pouvoir travailler en **mode dégradé** (Excel ou autre) quand
l'application est indisponible, puis **importer** les données une fois l'app revenue.

**Orientation recommandée (à valider).** Deux moitiés : (a) **capture hors-ligne** via un
modèle Excel/CSV structuré (1 feuille par entité) + un **export-instantané** des données
courantes pour travailler sur une copie récente pendant la panne ; (b) **import** par
pipeline upload → parse → validation (toutes les erreurs ligne par ligne) → **dry-run**
(NEW/DUPLICATE/ERROR) → commit, **idempotent** (clé de dédup par entité). Slice MVP :
**Patients d'abord**, puis RDV, puis consultations BROUILLON. **Facturation exclue**
(immuabilité légale, ADR-011).

**Réutilisation.** Généralise le `CatalogImportService` déjà livré (parseur CSV, erreurs
ligne à ligne). Pour le `.xlsx`, proposition `fastexcel-reader` (org.dhatim, compagnon
lecture du `fastexcel` déjà au pom — ADR-025) plutôt qu'Apache POI (écarté ADR-009), à
promouvoir de `test` à `runtime` → **nécessite un ADR de dépendance** (règle
ADR-015/016/017). Détail (entités/colonnes réelles, intégrité référentielle, RBAC, esquisse
backend, phasage) : voir le doc de conception. Décision finale à figer avant build.

---

## How to add an entry

Append at the bottom. Never edit an accepted ADR in place — add a superseding one referencing it (`**Status**: superseded by ADR-NNN`).
