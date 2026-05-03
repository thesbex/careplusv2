# careplus — déploiement par image Docker (alternative à Render)

> Ce document est l'**alternative** à `DEPLOY.md` (Render + Neon, ADR-022).
> Render reste le déploiement actif. Ce doc existe pour qu'on puisse basculer
> vite si Render ne convient plus (cold starts, prix, région, etc.) sans
> repartir de zéro.

L'idée : on construit **une image Docker versionnée**, on la **push sur un
registry**, et on la **déploie** chez n'importe quel provider qui prend une
image. Le même artefact tourne en cloud staging, en démo VPS, et plus tard
on-premise au cabinet (cf. CLAUDE.md, stratégie hybride).

---

## Pourquoi prévoir cette alternative ?

| Limite Render free actuelle              | Conséquence                               |
|------------------------------------------|--------------------------------------------|
| Cold start 30–60 s après 15 min d'idle   | Démo client → bouton login qui rame       |
| Région Frankfurt (pas de Casablanca)     | ~80 ms latence DB ↔ utilisateur Maroc     |
| Pas de contrôle JVM/locale/fonts fins    | openhtmltopdf + `fr_MA` parfois capricieux |
| Buildpack ≠ image cabinet on-premise     | Divergence staging / prod finale          |

L'image Docker règle les 4 d'un coup et garantit que **le même binaire**
tourne partout — c'est ce qui matche le mieux notre cible finale (cabinet
on-premise, ADR cabinet dans CLAUDE.md).

---

## Pré-requis (déjà en place)

- `Dockerfile` multi-stage à la racine (frontend Vite → fat jar → distroless).
- `docker-compose.prod.yml` à la racine (app + Postgres + backup quotidien).
- `.env.prod.example` — template des secrets pour le compose stack.

---

## Build local (sanity check)

```bash
# Build
docker build -t careplus:local .

# Test rapide avec Postgres compose
cp .env.prod.example .env.prod
# édite .env.prod (au minimum POSTGRES_PASSWORD + CAREPLUS_JWT_SECRET)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Vérif
curl http://localhost:8080/actuator/health
# → {"status":"UP"}

# Logs
docker compose -f docker-compose.prod.yml logs -f app

# Stop
docker compose -f docker-compose.prod.yml down
```

---

## Push vers un registry

Choix recommandé : **GHCR (GitHub Container Registry)**. Gratuit, intégré au
repo, auth via PAT GitHub déjà disponible.

```bash
# Auth (une fois, PAT avec scope write:packages)
echo $GHCR_PAT | docker login ghcr.io -u <github-user> --password-stdin

# Tag + push
docker tag careplus:local ghcr.io/<github-user>/careplus:0.1.0
docker tag careplus:local ghcr.io/<github-user>/careplus:latest
docker push ghcr.io/<github-user>/careplus:0.1.0
docker push ghcr.io/<github-user>/careplus:latest
```

Alternatives si GitHub ne convient pas :

| Registry              | Free tier            | Latence depuis Maroc |
|-----------------------|----------------------|----------------------|
| GHCR (recommandé)     | illimité public      | EU                   |
| Docker Hub            | 1 repo privé         | EU/US                |
| Scaleway Container Reg| 75 GB free           | Paris (proche)       |
| OVH Private Registry  | payant, ~3 €/mo      | Roubaix / **Casa** ⭐|

OVH Casablanca est le **bon choix le jour où on signe le premier cabinet** —
co-localisé avec OVH Object Storage Casablanca déjà prévu pour les backups.

---

## Providers qui consomment une image

Ordre de préférence pour careplus (région + coût + simplicité) :

### 1. Scaleway Serverless Containers ⭐ (recommandé pour staging cloud)

- **Région** : Paris (`fr-par`) — 2× plus proche de Casablanca que Frankfurt.
- **Pricing** : facturé à la milliseconde, free tier généreux (400 000 GB-s/mois).
- **Cold start** : ~3–8 s (vs 30–60 s Render free).
- **Setup** : pointe vers l'image GHCR, dashboard équivalent à Render.
- **Limite** : pas de Postgres managé Scaleway en free tier → coupler avec Neon
  ou Supabase pour le staging gratuit.

### 2. Coolify / Dokploy auto-hébergé sur VPS OVH

- **Région** : OVH Roubaix (~50 ms) ou demain OVH Casablanca (~5 ms).
- **Pricing** : ~3–5 €/mois pour un VPS 2 GB qui héberge l'app + Postgres + Coolify.
- **Avantage** : **identique à la cible cabinet** — zéro divergence d'env.
- **Workflow** : Coolify watch GHCR, redeploy au push d'un nouveau tag.
- **Setup** : 1h la première fois (installer Coolify), ensuite c'est du clic.

### 3. Render avec image (au lieu de buildpack)

- Render accepte aussi les images du registry (`Existing Image` au create).
- Garde le confort Render (auto-deploy, dashboard, logs) mais avec un artefact
  identique au cabinet. Pas de cold start réduit, mais reproductibilité gagnée.
- **Bon compromis** si on veut bouger d'un cran sans changer de provider.

### 4. Fly.io

- Excellent pour Spring Boot, région `cdg` (Paris).
- **Killer** : carte bancaire requise depuis oct 2024 (fin du free tier sans CB).
- À considérer le jour où on accepte de payer 5–10 $/mois pour zéro cold start.

### 5. Hetzner / OVH bare VPS + `docker compose`

- Le plus simple conceptuellement : `scp docker-compose.prod.yml` + `docker compose up -d`.
- Mais on perd l'auto-deploy au push. À combiner avec Watchtower ou un GitHub
  Action `ssh + docker pull + docker compose up -d`.

---

## Workflow CI suggéré (à activer le jour où on bascule)

`.github/workflows/docker-publish.yml` (à créer le moment venu — pas avant) :

```yaml
on:
  push:
    tags: ['v*']            # build l'image uniquement sur tag git
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/careplus:${{ github.ref_name }}
            ghcr.io/${{ github.repository_owner }}/careplus:latest
```

Tag = `git tag v0.1.0 && git push --tags` → image disponible 5 min plus tard.

---

## Décision

**Aujourd'hui** : on reste sur Render + Neon (ADR-022). Ça marche, ça coûte 0 €,
le cold start est tolérable pour la phase de dev.

**On bascule** dès qu'un de ces signaux apparaît :
- premier client réel qui se plaint du cold start ;
- on signe avec un cabinet et il faut une démo en région Maroc ;
- la 0.5 GB Neon devient juste ;
- on prépare la livraison cabinet on-premise (alors le compose stack de ce
  doc devient littéralement le déploiement de prod).

À ce moment-là, l'ordre d'action est :
1. Tag git → image GHCR.
2. Pointer Scaleway Serverless ou Coolify-on-OVH vers l'image.
3. Couper Render (ou le garder en backup).
4. Mettre à jour `docs/DECISIONS.md` avec un nouvel ADR (ADR-023 probablement).

Ce document existe pour que l'étape 1–3 prenne **une demi-journée** au lieu
d'une semaine.
