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

---

## How to add an entry

Append at the bottom. Never edit an accepted ADR in place — add a superseding one referencing it (`**Status**: superseded by ADR-NNN`).
