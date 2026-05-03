# careplus — deployment

This document covers the **cloud staging** deploy (auto-deployed on every push
to `main`). Production cabinets will later ship as a jpackage Windows installer —
that path is tracked in [BACKLOG.md](BACKLOG.md) and NOT addressed here.

**Current setup** (per ADR-022): **Render** (web service, free tier) + **Neon**
(Postgres, free tier). Zero YAML in this repo — Render picks up the `Dockerfile`
from the repo root automatically on every push to `main`.

> **Alternative prête à l'emploi** : si on doit quitter Render (cold starts,
> région, prix), voir [`DEPLOY_DOCKER_IMAGE.md`](DEPLOY_DOCKER_IMAGE.md) —
> on push l'image vers GHCR et on la déploie chez Scaleway / Coolify-OVH /
> Fly. Le `Dockerfile` et `docker-compose.prod.yml` sont déjà en place.

---

## Topology

```
   ┌───────────────────────────────────────┐
   │  GitHub thesbex/careplusv2 (main)     │
   └──────────────┬────────────────────────┘
                  │ push
                  ▼
   ┌───────────────────────────────────────┐
   │  Render Web Service                   │
   │  - builds from Dockerfile             │
   │  - one container, 512MB, shared vCPU  │
   │  - autosleeps after 15 min idle       │
   │  - URL: careplus-v2.onrender.com      │
   └──────────────┬────────────────────────┘
                  │ jdbc + ssl
                  ▼
   ┌───────────────────────────────────────┐
   │  Neon Postgres (free tier)            │
   │  - 0.5 GB storage forever             │
   │  - region: Europe (Frankfurt)         │
   └───────────────────────────────────────┘
```

---

## First-time setup (≈10 min)

### 1. Neon — create the database

1. Sign up at <https://neon.tech> (email login, no credit card on free tier).
2. **Create project** → name: `careplus`, region: Europe (Frankfurt) — closest
   to Morocco on the free tier.
3. Database name: `careplus`, user: keep the auto-generated one.
4. From the Dashboard → **Connection Details**, grab the **pooled connection
   string** in JDBC format. Looks like:
   ```
   jdbc:postgresql://ep-xxx-pooler.eu-central-1.aws.neon.tech/careplus?sslmode=require
   ```
   Keep the **user** and **password** separately — we'll split them into three
   env vars.

> Use the **pooled** endpoint (ends in `-pooler`). Neon sits transactions
> behind PgBouncer in transaction mode, which HikariCP + Flyway handle fine.
> The non-pooled endpoint caps you at a few concurrent connections.

### 2. Render — create the web service

1. Sign up at <https://render.com> using your GitHub account (no credit card
   needed for free tier).
2. Click **New +** → **Web Service** → select the `thesbex/careplusv2` repo.
   - Render detects the `Dockerfile` at repo root and proposes Docker
     build — accept.
   - **Name**: `careplus-v2` (becomes the subdomain).
   - **Region**: Frankfurt (match Neon to keep round-trip latency <5 ms).
   - **Instance Type**: **Free**.
   - **Branch**: `main`.
   - **Auto-Deploy**: **Yes**.
3. Before clicking **Create**, scroll down to **Environment Variables** and
   add these (values from Neon + one you generate yourself):

| Key                       | Value                                             |
|---------------------------|---------------------------------------------------|
| `SPRING_PROFILES_ACTIVE`  | `prod-cloud` (already the Dockerfile default)    |
| `DATABASE_URL`            | the JDBC URL from Neon (`jdbc:postgresql://…`)    |
| `DATABASE_USER`           | Neon user                                         |
| `DATABASE_PASSWORD`       | Neon password                                     |
| `CAREPLUS_JWT_SECRET`     | **64-char random hex** — generate locally         |

Generate the JWT secret once (don't reuse staging's in prod later):

```bash
openssl rand -hex 32
```

4. Click **Create Web Service**. Render starts building from the Dockerfile.
   First build takes ~5–8 min (Maven downloads all deps). Subsequent builds
   use layer caching and finish in ~2–3 min.

### 3. Verify

Once deployment shows `Live`:

```bash
curl https://careplus-v2.onrender.com/actuator/health
# → {"status":"UP"}

curl -X POST https://careplus-v2.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fatima.zahra@careplus.ma","password":"ChangeMe123!"}'
```

Wait — **there are no seeded users in staging**. The `DevUserSeeder` only
runs under the `dev` profile; staging runs `prod-cloud`. To demo login,
either:
- temporarily set `SPRING_PROFILES_ACTIVE=prod-cloud,dev` in Render env vars
  (re-deploy triggers), OR
- `psql $DATABASE_URL` from Neon's SQL editor and seed a user manually with
  a BCrypt hash.

Cleanest long-term: add a small `/api/admin/setup` endpoint that creates the
first admin user when the DB is empty (tracked in `BACKLOG.md → Admin & ops`).

---

## Day-2 operations

### Read logs

Render dashboard → service → **Logs** tab. Streamed, filterable. No CLI
needed for now.

### Force redeploy

Render dashboard → service → **Manual Deploy** → **Deploy latest commit**.
Useful after env-var changes (which don't auto-redeploy).

### Roll back

Render dashboard → service → **Deploys** → find the last-green deploy →
**Redeploy**. Sub-minute. Since deploys are immutable Docker images, rollback
is guaranteed.

### Run migrations

Flyway runs on app start, so every deploy migrates automatically. No manual
step. To inspect history:

```sql
-- Neon SQL editor
SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC;
```

### Cold starts

Render free-tier web services sleep after **15 min of no traffic**. First
request wakes the container (~30–60 s JVM startup on 512 MB). Fine for
demos; unacceptable for real users. When upgrading to paid:

| Tier          | Cost / mo | Cold start |
|---------------|-----------|-----------|
| Free          | $0        | 30–60 s   |
| Starter       | $7        | none (always-on) |
| Standard      | $25       | none + more RAM |

Upgrade is a dropdown click; no re-deploy.

---

## Secrets & env-var hygiene

| Secret                   | Where it lives                                      |
|--------------------------|-----------------------------------------------------|
| `CAREPLUS_JWT_SECRET`    | Render env vars (NOT `.env`, NOT git)              |
| `DATABASE_PASSWORD`      | Render env vars                                     |
| Neon DB URL              | Render env vars                                     |
| GitHub PAT (for push)    | Windows Credential Manager on your machine          |
| Local dev values         | `application-dev.yml` (committed — these are fakes) |

Rotation: if the JWT secret leaks, rotate in Render and redeploy — all issued
access tokens become invalid immediately, all users forced to re-login. The
HttpOnly refresh cookie is fine because the refresh path re-signs.

---

## Upgrading to paid

When you decide to pay:

1. Render → bump web service from **Free** → **Starter ($7/mo)** to kill
   cold starts.
2. Neon → bump from free tier → **Launch ($19/mo)** when the 0.5 GB storage
   cap gets close. Before that, free stays free forever.
3. Add a custom domain on Render (Starter+ includes TLS): `app.careplus.ma`
   pointing CNAME to `careplus-v2.onrender.com`.
4. Revisit this doc and update the ADR.

Eventual migration to production (OVH Casablanca for data residency) =
rebuild this Dockerfile on any host running Docker. Nothing in the image is
Render-specific.

---

## Rejected alternatives (for context)

- **Fly.io** — killed free tier Oct 2024; needs card.
- **Railway** — killed free tier 2023.
- **AWS/GCP/Azure free tiers** — 12-month expiry.
- **Oracle Cloud Always Free** — most generous forever, but 30 min extra VM
  setup cost and no native GitHub auto-deploy. Worth revisiting for a
  production replica in Morocco later.

See [DECISIONS.md → ADR-022](DECISIONS.md) for the full rationale.
