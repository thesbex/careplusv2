# Architecture

## Deployment shape

One JAR + Postgres + (in hybrid mode) a backup daemon. Three supported modes, single codebase, mode chosen by configuration.

```
┌─────────────────────────────────────────────────────────┐
│  Cabinet PC (Windows) — ON_PREMISE or HYBRID            │
│    Service "CarePlus-App"    → Java 21 JRE + JAR        │
│    Service "PostgreSQL 16"                              │
│    Service "CarePlus-Backup" (hybrid only, cron 02h)    │
└─────────────────────────────────────────────────────────┘
                        │ (hybrid only)
                        ↓ AES-256-GCM, key from cabinet master password
┌─────────────────────────────────────────────────────────┐
│  OVH Object Storage Casablanca                          │
│  Bucket: careplus-backup-<cabinetId>                    │
└─────────────────────────────────────────────────────────┘
```

Cloud-pure mode: same JAR on a VPS OVH Casablanca (Nginx + LetsEncrypt in front).

Mode selection:

```yaml
careplus:
  deployment-mode: ON_PREMISE | HYBRID | CLOUD
```

## Modular monolith

One Spring Boot app, one database, one process. Modules are Java packages with explicit public APIs. Not microservices.

```
ma.careplus
├── identity         auth, users, roles, audit
├── patient          dossier patient
├── scheduling       agenda, RDV, créneaux
├── presence         check-in, file d'attente
├── clinical         consultations, constantes, prescriptions
├── pregnancy        (post-MVP) suivi grossesse
├── billing          factures, paiements, caisse
├── catalog          médicaments, analyses, radios, actes, tarifs
├── documents        PDF generation, file storage, templates
├── notification     SMS, email (post-MVP)
├── dashboard        read-model (post-MVP)
├── configuration    cabinet settings, onboarding
├── backup           (post-MVP) dump + encryption + upload
└── shared           shared kernel: common types, events, exceptions
```

### Module contract

Each module:
- Exposes a **public API** via `application/` package (service interfaces + events).
- Keeps everything else **package-private**.
- Never reads another module's JPA entity or repository directly.
- Communicates with other modules only through:
  - Its own public service interface (direct call, same process)
  - Domain events via `ApplicationEventPublisher` (async via `@TransactionalEventListener(phase = AFTER_COMMIT)`)

### Internal layout per module

```
ma.careplus.<module>/
├── domain/
│   ├── <Entity>.java              JPA entity, field annotations
│   ├── <Enum>.java                states, types
│   └── event/
│       └── <Event>.java           domain events published by this module
├── application/
│   ├── <Entity>Service.java       public interface
│   ├── <Entity>ServiceImpl.java   @Service
│   └── <Query>/<Command>.java     use case inputs
└── infrastructure/
    ├── web/
    │   ├── <Entity>Controller.java   @RestController
    │   ├── dto/<Entity>Dto.java      records
    │   └── mapper/<Entity>Mapper.java MapStruct
    └── persistence/
        └── <Entity>Repository.java   Spring Data JPA
```

## Data model principles

- **PostgreSQL 16** only. No H2 even in tests (Testcontainers uses real Postgres).
- **Schema**: single schema `public`, tables prefixed with module name (`patient_patient`, `scheduling_appointment`).
- **IDs**: `UUID` Postgres type, generated app-side via `UUID.randomUUID()` in MVP.
- **Timestamps**: `TIMESTAMPTZ` always. Never `TIMESTAMP` without zone.
- **Audit columns** on every table:
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `created_by UUID` (FK to `identity_user`, nullable for system-generated rows)
  - `updated_by UUID`
- **Soft delete** via `deleted_at TIMESTAMPTZ NULL` on patient-medical tables. **NEVER** on billing tables (legal immutability).
- **Optimistic locking**: `version BIGINT NOT NULL DEFAULT 0` on mutable aggregates (`patient_patient`, `clinical_consultation`, `scheduling_appointment`).
- **Encrypted columns**: sensitive fields (e.g. `patient.cin`) use `@Convert(converter = EncryptedStringConverter.class)` (AES-GCM, key externalized via env).

## Migrations

- **Flyway 10**, scripts in `src/main/resources/db/migration/`.
- Naming: `V<number>__<module>_<description>.sql` (e.g. `V002__patient_baseline.sql`).
- **Never edit an applied migration.** Add a new one.
- Each module's baseline migration creates its tables + FKs + indexes.
- `R__seed_dev.sql` (repeatable) loads dev seed data — runs on `dev` profile only via `spring.flyway.locations` override.

## Cross-cutting

### Authentication
- JWT (access 15 min, refresh 7 d), HS256 signed (key from env).
- Login: email + bcrypt password (cost 12).
- `SecurityFilterChain` per Spring Security 6 DSL.
- `@PreAuthorize("hasRole('MEDECIN')")` method-level + resource-level via `@PreAuthorize("@patientAccess.canView(#id, authentication)")`.

### Error handling
- `@RestControllerAdvice` global handler produces `application/problem+json` (RFC 7807).
- Business errors: 422 + error code + message. Not found: 404. Validation: 400 with field errors.

### Logging
- JSON structured logs via Logback + `logstash-logback-encoder`.
- Correlation id via MDC (filter generates one per request, propagates in logs and event payloads).

### Audit
- `identity_audit_log` append-only table.
- AOP aspect on `@Auditable` methods writes before/after JSON (Jackson), user id, IP, timestamp.
- Never exposed writable — only readable by ADMIN.

### Events
- Emit via `ApplicationEventPublisher.publishEvent(new FooEvent(...))`.
- Consume via `@TransactionalEventListener(phase = AFTER_COMMIT) void on(FooEvent e)`.
- All events extend `ma.careplus.shared.event.DomainEvent` (has `eventId`, `occurredAt`, `correlationId`).

### Testing
- Unit: JUnit 5 + Mockito, per class.
- Integration: `@SpringBootTest` + `@Testcontainers` with `@ServiceConnection PostgreSQLContainer`.
- Naming: `*Test` unit, `*IT` integration. Surefire runs unit, Failsafe runs IT.
- One smoke test class `ma.careplus.smoke.SmokeIT` exercises each MVP workflow end-to-end via MockMvc.

### OpenAPI
- `springdoc-openapi` generates `/v3/api-docs` + `/swagger-ui.html`.
- Every controller annotated with `@Tag` (module name) and operations documented.
- OpenAPI JSON committed to repo at `docs/openapi.json` on every release (for future Angular client generation).

### PDF generation
- Templates in `src/main/resources/templates/pdf/*.html` (Thymeleaf).
- Variables documented in each template's header comment.
- Render pipeline: Thymeleaf → HTML string → openhtmltopdf → PDF bytes.
- Headers/footers editable per cabinet via `config_document_template` table (overrides defaults).

### Build structure (MVP)

MVP = **single-module Maven project** for speed. Post-MVP we split into multi-module if justified. Module boundaries live in package structure, enforced by [ArchUnit](https://www.archunit.org/) tests (one test class checks no cross-module internal access).

## Non-functional targets (MVP)

| Concern | Target |
|---|---|
| Cold start | < 15s |
| Login response | < 300ms p95 |
| Patient search query | < 200ms p95 on 50k patients |
| PDF generation (ordonnance) | < 1s |
| Full test suite | < 5 min on laptop |
| Container image size | n/a MVP (native installer post-MVP) |

## Conventions summary

- `ma.careplus.<module>` root, no cross-module imports outside of `application/` public surface.
- Records for DTOs, classes for entities.
- MapStruct for DTO ↔ entity. No manual mapping.
- All mutations go through a service; no `@Autowired Repository` in controllers.
- No `@Transactional` on controllers; always on services.
- French for user-facing strings (domain values, error messages). English for code identifiers.
