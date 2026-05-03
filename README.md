# careplus

Système d'Information de Cabinet Médical (SICM) pour médecins généralistes — backend.

## Status

🚧 **MVP in progress.** See [docs/SPRINT_MVP.md](docs/SPRINT_MVP.md) for day-by-day plan and [docs/PROGRESS.md](docs/PROGRESS.md) for live state.

## What it does

One backend that handles the full generalist-cabinet workflow: patient records, appointment booking, check-in, vitals intake, consultation & prescription, PDF ordonnance with editable headers, billing with legal sequential numbering. Designed for hybrid deployment (on-premise at cabinet with encrypted auto-backup to Moroccan cloud).

See [docs/WORKFLOWS.md](docs/WORKFLOWS.md) for the full product spec.

## Stack

Java 21 · Spring Boot 3.3 · PostgreSQL 16 · Flyway · MapStruct · JWT auth · springdoc-openapi · openhtmltopdf · Testcontainers.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the technical spec and [docs/DECISIONS.md](docs/DECISIONS.md) for why each choice was made.

## Prerequisites

- JDK 21
- Maven 3.9+
- Docker (for Postgres + Testcontainers)

## Quick start

_Available after J1 ships._

```bash
docker compose up -d           # Postgres on :5432
mvn clean verify               # build + full test suite
mvn spring-boot:run            # app on :8080
```

Then open:
- Swagger UI: http://localhost:8080/swagger-ui.html
- Actuator: http://localhost:8080/actuator/health

Default credentials (seeded in `dev` profile): see `src/main/resources/db/migration/R__seed_dev.sql` once it ships.

## Contributing (Claude Code sessions)

Read [CLAUDE.md](CLAUDE.md) first. Every session starts by reading `docs/PROGRESS.md` and ends by updating it.

## License

Proprietary. Not open source.
