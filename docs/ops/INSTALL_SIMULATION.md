# Banc de simulation d'installation cabinet (Linux on-premise)

> **Statut : BROUILLON pour relecture du lead.** Ce document décrit un poste de
> référence reproductible (« banc ») pour **préparer et répéter** les installations
> en cabinet avant de se déplacer sur site. Il ne remplace pas l'installeur
> jpackage Windows (encore au BACKLOG) ; il sert à valider le couple
> JVM + PostgreSQL + jar + sauvegarde dans les conditions réelles d'un cabinet
> marocain (coupures de courant et de réseau, personnel non technicien).

Cadrage par rapport au reste du repo :

- **ADR-020** : un seul processus. Spring Boot sert le bundle Vite depuis
  `src/main/resources/static/`. **Pas de Nginx, pas de second serveur web** dans le
  cabinet. Le banc respecte ça : un service `careplus`, un service `postgresql`,
  point.
- **ADR-006** : déploiement hybride = cabinet + sauvegarde chiffrée vers OVH Object
  Storage Casablanca. **À ce jour la partie OVH n'est PAS implémentée** (voir §6) ;
  le banc couvre la sauvegarde locale qui existe réellement.
- **CLAUDE.md / mémoire projet** : la prod applique **`db/migration` uniquement**,
  jamais `db/seed`. Le banc doit donc savoir basculer entre un mode « démo seedée »
  (pour s'entraîner) et un mode « migration-only » (fidèle à la prod).
- Cible technique gelée (pom.xml) : **Java 21**, **Spring Boot 3.3.5**,
  **PostgreSQL 16**, Flyway 10. 72 migrations à ce jour (V001 → V072).

> ⚠️ Le tooling de sauvegarde existant (`scripts/backup/careplus-backup.ps1`,
> `careplus-restore.ps1`) est **PowerShell / Windows uniquement**. Le banc Linux
> n'a pas d'équivalent dans le repo : les scripts bash de la §6 sont **proposés
> ici, à committer** (décision lead, voir §8).

---

## 1. Objectif

Disposer d'une machine Linux jetable et **reproductible à l'identique** qui reflète
un vrai poste de cabinet, pour :

1. **Répéter l'installation complète** (du Linux nu à l'app accessible sur le LAN)
   chronomètre en main, avant chaque déploiement client réel.
2. **Valider une nouvelle version** (nouveau jar) sur des migrations Flyway
   réelles avant de la pousser en cabinet.
3. **Entraîner un installateur non expert** sur un runbook copier-coller.
4. **Tester la restauration** (drill) : une sauvegarde jamais restaurée ne vaut
   rien.

Le banc n'est PAS un serveur de prod ni de staging (le staging cloud, c'est
Render/Fly + Neon, cf. `docs/DEPLOY.md`). C'est un **simulateur on-premise**.

Idéalement le banc tourne **dans une VM** (VirtualBox / KVM / Proxmox) pour pouvoir
**snapshotter avant install et remettre à zéro en 30 s** (voir §7). Une machine
physique convient aussi mais perd le reset instantané.

---

## 2. Spécification matérielle

Le dimensionnement vient de la pile réelle, pas d'un pifomètre :

- **JVM Spring Boot 3.3** : démarre autour de **400 Mo RSS**, monte avec le
  nombre de modules chargés (identity, patient, scheduling, clinical, billing,
  catalog, documents, hospitalisation, vaccination, grossesse, assistant…). On vise
  un heap confortable. Le Dockerfile prod utilise `-XX:MaxRAMPercentage=75` ; sur
  une box 4 Go ça donne ~3 Go de plafond RAM JVM, largement suffisant.
- **PostgreSQL 16** : `shared_buffers` ~25 % de la RAM, `work_mem` par tri/jointure,
  cache OS pour le working set. Cible NFR (ARCHITECTURE.md) : recherche patient
  < 200 ms p95 **sur 50k patients**. Le working set chaud d'un cabinet solo tient
  en quelques centaines de Mo.
- **OS Linux serveur (sans bureau)** : ~400–700 Mo de RAM, ~3–5 Go disque.
- **Documents (PDF, pièces jointes)** stockés sur le filesystem
  (`CAREPLUS_DOCUMENTS_ROOT`, défaut `./data/documents`). BACKLOG estime
  **~2 Mo × patient**, soit ~10 Go pour 5 000 patients à 5 ans. **C'est le poste
  disque qui grossit, pas la base.**
- **SSD obligatoire**. Un cabinet sur HDD = latence agenda/recherche perçue comme
  « ça rame ». Non négociable pour le confort secrétaire.

### (a) Petit cabinet solo (1 médecin, 1–2 postes, ~3–7 utilisateurs)

| Ressource | Minimum | Recommandé |
|---|---|---|
| CPU | 2 cœurs x86-64 | **4 cœurs** |
| RAM | 4 Go | **8 Go** |
| Disque | 64 Go SSD | **256 Go SSD** (croissance documents) |
| Réseau | Ethernet 100 Mb/s | Gigabit + Wi-Fi pour tablettes |

À 4 Go on tient (JVM ~1,5–2 Go + Postgres ~1 Go + OS), mais zéro marge pour la
sauvegarde concurrente, un éditeur PDF, ou un pic. **8 Go est le vrai confort** et
c'est aujourd'hui le plancher d'un mini-PC neuf.

### (b) Clinique multi-praticiens (≥2 médecins actifs → UI multi-médecin, +hospitalisation)

| Ressource | Minimum | Recommandé |
|---|---|---|
| CPU | 4 cœurs | **6–8 cœurs** |
| RAM | 8 Go | **16 Go** |
| Disque | 256 Go SSD | **512 Go SSD NVMe** (+ disque externe sauvegarde) |
| Réseau | Gigabit | Gigabit + onduleur (voir ci-dessous) |

Justification du saut : plus de connexions simultanées (pool Hikari plus large que
les 5 du cloud), hospitalisation (constantes au lit, facturation séjour) =
plus d'écritures, working set Postgres plus chaud → on monte `shared_buffers`, donc
plus de RAM. 16 Go laisse ~4 Go à Postgres, ~3–4 Go à la JVM, et garde le cache OS
chaud.

### Contraintes Maroc-cabinet (transverses, non optionnelles)

- **Onduleur (UPS) obligatoire** sur le PC + le switch réseau. Les coupures EDF
  sont fréquentes ; une coupure pendant une écriture Postgres sans `fsync` propre
  risque la corruption. L'UPS doit tenir assez pour un arrêt propre (`systemctl stop`).
- **Disque externe dédié à la sauvegarde** (USB3), idéalement **rotation de 2
  disques** stockés hors site (risque incendie/vol). Chiffrer le disque (LUKS).
- **Connectivité intermittente** : tout doit marcher hors-ligne. L'app est
  `ON_PREMISE` par défaut (`careplus.deployment-mode`), aucune dépendance réseau
  pour fonctionner. Seul l'upload OVH (futur) nécessite Internet, et doit être
  best-effort/rattrapable.

---

## 3. Choix de l'OS

**Recommandation : Debian 12 (« Bookworm »), édition serveur (sans bureau
graphique).**

Justification face aux alternatives :

- **Debian 12** — stable, prévisible, support sécurité jusqu'à ~2028 (LTS via
  Debian-Security puis ELTS). PostgreSQL 16 et Temurin 21 disponibles via dépôts
  officiels (PGDG + Adoptium). Empreinte minimale, pas de surcouche commerciale,
  pas de `snap`. Idéal pour une **appliance** que personne ne « bricole » au
  quotidien. **Le pick.**
- **Ubuntu Server 24.04 LTS** — très bon second choix, support 5 ans (2029),
  documentation abondante. Léger surcoût : `snapd` et MOTD pub. Acceptable si
  l'équipe connaît mieux l'écosystème Ubuntu. **Choix de repli légitime.**
- **Rocky/AlmaLinux 9** — excellent pour le support long (2032) façon RHEL, mais
  `dnf`/SELinux ajoutent de la friction pour un technicien non expert, et nos
  scripts sont écrits en logique Debian. À retenir seulement si le client impose
  du RHEL.
- **Fedora / Arch / openSUSE Tumbleweed** — rolling ou cycle court : **rejetés**,
  trop de churn pour une appliance médicale qu'on installe et qu'on oublie.

Réglages OS communs sur le banc et en prod :

- **Fuseau** : `Africa/Casablanca` (`timedatectl set-timezone Africa/Casablanca`).
  Cohérent avec `-Duser.timezone=Africa/Casablanca` et `PGTZ` côté Postgres.
- **Locale** : `fr_FR.UTF-8` (UI et messages métier en français) + `en_US.UTF-8`.
- **NTP activé** (`timedatectl set-ntp true`) pour des timestamps `TIMESTAMPTZ` justes.
- Pas d'environnement de bureau : moins de RAM, moins de surface d'attaque.

---

## 4. Pile logicielle à installer

| Composant | Version exacte | Distribution / source | Rôle |
|---|---|---|---|
| JDK | **Java 21 (LTS)** | **Eclipse Temurin 21** (dépôt Adoptium) | Exécute le jar |
| Base | **PostgreSQL 16** | dépôt **PGDG** officiel | Données |
| Application | `careplus-*.jar` (fat-jar Spring Boot) | construit par `mvn -DskipTests clean package` | App + SPA |
| Outils sauvegarde | `pg_dump` / `pg_restore` 16 | fournis par le paquet `postgresql-client-16` | Backup/restore |

Notes :

- **Temurin** plutôt qu'OpenJDK distro ou Oracle JDK : builds OpenJDK gratuits,
  signés, sans licence piège, alignés sur la stage Docker
  (`maven:3.9-eclipse-temurin-21`) — donc même JDK qu'en CI/build, zéro surprise.
- **JRE vs JDK** : un **JRE 21 suffit** pour exécuter le jar en prod cabinet. Sur
  le banc on prend le **JDK** (utile pour `jcmd`, `jstack`, diagnostic). L'archi
  (ARCHITECTURE.md) parle bien de « Java 21 JRE + JAR » côté cabinet.
- **AUCUN serveur web séparé** (ADR-020). Spring Boot embarque Tomcat et sert la
  SPA. N'installez pas Nginx/Apache sur le banc — ce serait diverger de la prod.
- Le jar est **auto-suffisant** : il contient le frontend buildé (stage Docker
  `COPY --from=frontend-build … ./src/main/resources/static/`). Sur le banc on peut
  soit réutiliser le jar produit par le build Docker/CI, soit le construire
  localement (cf. §5.4).

---

## 5. Runbook d'installation (du Linux nu à l'app sur le LAN)

> Toutes les commandes sont pour **Debian 12**. Exécuter en tant qu'utilisateur
> avec `sudo`. Adapter les chemins/mots de passe ; ne jamais committer de vrai
> secret.

### 5.0 Pré-requis OS

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Africa/Casablanca
sudo timedatectl set-ntp true
sudo apt -y install ca-certificates curl gnupg lsb-release ufw
```

### 5.1 Installer le JDK 21 (Temurin)

```bash
# Dépôt Adoptium
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public \
  | sudo gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg
echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/adoptium.list
sudo apt update
sudo apt -y install temurin-21-jdk    # en prod cabinet: temurin-21-jre suffit
java -version                          # doit afficher 21.x (Temurin)
```

### 5.2 Installer PostgreSQL 16 (dépôt PGDG)

```bash
sudo install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt -y install postgresql-16 postgresql-client-16
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "SHOW server_version;"   # 16.x
```

Régler le fuseau Postgres (cohérence avec l'app) :

```bash
sudo -u postgres psql -c "ALTER SYSTEM SET timezone TO 'Africa/Casablanca';"
sudo -u postgres psql -c "ALTER SYSTEM SET log_timezone TO 'Africa/Casablanca';"
sudo systemctl restart postgresql
```

### 5.3 Créer la base et l'utilisateur applicatif

```bash
# Mot de passe fort, généré une fois (NE PAS réutiliser celui du banc en clientèle)
DB_PASS="$(openssl rand -base64 24)"
echo "Mot de passe DB careplus (à conserver dans le coffre): $DB_PASS"

sudo -u postgres psql <<SQL
CREATE ROLE careplus LOGIN PASSWORD '${DB_PASS}';
CREATE DATABASE careplus OWNER careplus ENCODING 'UTF8'
  LC_COLLATE 'fr_FR.UTF-8' LC_CTYPE 'fr_FR.UTF-8' TEMPLATE template0;
SQL
```

> Postgres écoute par défaut sur `localhost` uniquement — c'est ce qu'on veut :
> l'app et la base sont sur la même machine (ADR-020). **Ne pas** ouvrir Postgres
> au LAN. Seul le port HTTP de l'app (8080) sera exposé.

### 5.4 Construire ou récupérer le jar

Option A — réutiliser l'artefact de CI/Docker (recommandé en clientèle : on déploie
le jar déjà testé). Le copier en `/opt/careplus/careplus.jar`.

Option B — construire sur le banc (utile pour tester une branche) :

```bash
# sur une machine avec le repo + Maven (le banc peut juste recevoir le jar)
cd /chemin/vers/careplus-v2/frontend && npm ci && npm run build
# le bundle doit atterrir dans src/main/resources/static avant package :
cp -r frontend/dist/* ../src/main/resources/static/
cd .. && mvn -q -DskipTests clean package
ls target/*.jar
```

Placer le jar et préparer l'arborescence runtime :

```bash
sudo useradd --system --home /opt/careplus --shell /usr/sbin/nologin careplus || true
sudo mkdir -p /opt/careplus/{data/documents,data/backups,logs}
sudo cp target/careplus-*.jar /opt/careplus/careplus.jar
sudo chown -R careplus:careplus /opt/careplus
```

### 5.5 Fichier d'environnement (secrets hors du jar)

`application-prod-onprem.yml` lit `DATABASE_URL`, `DATABASE_USER`,
`DATABASE_PASSWORD`, et le secret JWT via `CAREPLUS_JWT_SECRET`. On les injecte par
un EnvironmentFile **non lisible par tous** :

```bash
sudo tee /opt/careplus/careplus.env >/dev/null <<EOF
SPRING_PROFILES_ACTIVE=prod-onprem
DATABASE_URL=jdbc:postgresql://localhost:5432/careplus
DATABASE_USER=careplus
DATABASE_PASSWORD=${DB_PASS}
CAREPLUS_JWT_SECRET=$(openssl rand -hex 32)
CAREPLUS_DOCUMENTS_ROOT=/opt/careplus/data/documents
CAREPLUS_BACKUP_DIR=/opt/careplus/data/backups
CAREPLUS_DEPLOYMENT_MODE=ON_PREMISE
JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Duser.timezone=Africa/Casablanca
EOF
sudo chown careplus:careplus /opt/careplus/careplus.env
sudo chmod 600 /opt/careplus/careplus.env
```

> Le profil **`prod-onprem`** force `deployment-mode: ON_PREMISE`, `backup.enabled:
> false`, et écrit les logs dans `logs/careplus.log`. Flyway applique les 72
> migrations au premier démarrage (base vide → schéma créé). `db/seed` n'est PAS
> chargé en prod (mémoire projet).

### 5.6 Service systemd (démarrage au boot)

```bash
sudo tee /etc/systemd/system/careplus.service >/dev/null <<'EOF'
[Unit]
Description=CarePlus - Systeme d'Information de Cabinet Medical
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=careplus
Group=careplus
WorkingDirectory=/opt/careplus
EnvironmentFile=/opt/careplus/careplus.env
ExecStart=/usr/bin/java -jar /opt/careplus/careplus.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=5
# Durcissement léger
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/careplus

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now careplus
sudo systemctl status careplus --no-pager
```

Suivre le démarrage (cold start cible < 15 s, ARCHITECTURE.md) :

```bash
journalctl -u careplus -f          # logs systemd
tail -f /opt/careplus/logs/careplus.log
curl -s http://localhost:8080/actuator/health    # {"status":"UP"}
```

### 5.7 Pare-feu / port LAN

L'app écoute sur **8080**. On expose ce port au LAN du cabinet uniquement ;
Postgres reste fermé.

```bash
sudo ufw allow 22/tcp        # SSH d'admin (à restreindre au besoin)
sudo ufw allow 8080/tcp      # app sur le LAN
sudo ufw enable
sudo ufw status verbose
```

Les postes du cabinet accèdent via `http://<IP-LAN-du-PC>:8080`.

> **Décision lead (voir §8)** : en HTTP simple sur le LAN, le cookie refresh
> `Secure` (ADR-019) ne sera pas renvoyé sur une origine non-HTTPS. Option : TLS
> auto-signé géré **par l'app** (Spring Boot `server.ssl.*`, toujours un seul
> processus, conforme ADR-020) ou nom local + certif interne. À trancher.

### 5.8 Bootstrap du premier administrateur

Pas de seed en prod → la base est vide d'utilisateurs. Utiliser l'endpoint
one-shot `POST /api/admin/bootstrap` (verrouillé dès qu'un utilisateur existe) :

```bash
curl -s -X POST http://localhost:8080/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cabinet.ma","password":"<mot-de-passe-fort>",
       "firstName":"Admin","lastName":"Cabinet"}'
# 201 -> crée le 1er user avec rôles [ADMIN, SUPER_ADMIN]
```

Vérifier qu'il est bien verrouillé ensuite (doit renvoyer 409) :

```bash
curl -s -X POST http://localhost:8080/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.ma","password":"x","firstName":"x","lastName":"x"}'
# 409 BOOTSTRAP_LOCKED
```

Puis se connecter via le navigateur sur `http://<IP-LAN>:8080`, finir l'onboarding
cabinet (identité du centre, services, modules) avec le compte SUPER_ADMIN.

---

## 6. Sauvegarde périodique de la base

### État réel dans le repo (à connaître)

- **Sauvegarde locale Windows** : `scripts/backup/careplus-backup.ps1` +
  `careplus-restore.ps1` (PowerShell, `pg_dump -Fc`, rétention, log). **Pas
  d'équivalent Linux dans le repo.**
- **Restore in-app** : `BackupController` (`/api/admin/backups`,
  `/restore`, SUPER_ADMIN) liste les `.dump` du dossier `careplus.backup.dir` et
  restaure via `pg_restore --clean`. Marche aussi sous Linux **si** le dossier de
  sauvegarde est `CAREPLUS_BACKUP_DIR`.
- **Sauvegarde chiffrée OVH Object Storage Casablanca (ADR-006)** : **NON
  IMPLÉMENTÉE.** Le module `backup` est marqué *(post-MVP)* dans ARCHITECTURE.md,
  son toggle est `false` en on-prem/dev, et BACKLOG.md liste encore « Backup cloud:
  daily dump, encryption, upload, rotation, alerts » comme à faire. **Pour
  l'instant la sauvegarde s'arrête au disque local/externe.**

### Script de sauvegarde Linux (à committer — `scripts/backup/careplus-backup.sh`)

Équivalent bash du `.ps1`, à valider sur le banc puis ajouter au repo :

```bash
#!/usr/bin/env bash
# Sauvegarde quotidienne careplus -> dossier local/disque externe (pg_dump -Fc).
set -euo pipefail

BACKUP_DIR="${CAREPLUS_BACKUP_DIR:-/opt/careplus/data/backups}"
PGHOST="${PGHOST:-localhost}"; PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-careplus}"; PGUSER="${PGUSER:-careplus}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
LOG="$BACKUP_DIR/careplus-backup.log"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/careplus_${STAMP}.dump"

log(){ echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

log "DEBUT sauvegarde -> $OUT (db=$PGDATABASE host=$PGHOST:$PGPORT)"
# PGPASSWORD fourni par l'EnvironmentFile/timer, jamais en clair ici.
if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$OUT"; then
  log "OK $(du -h "$OUT" | cut -f1)"
else
  log "ECHEC pg_dump"; rm -f "$OUT"; exit 1
fi

# Rétention
find "$BACKUP_DIR" -name 'careplus_*.dump' -type f -mtime "+${RETENTION_DAYS}" \
  -print -delete | sed 's/^/Retention supprime: /' | tee -a "$LOG"
log "FIN"
```

> Le `-Fc` (format custom compressé) sauvegarde **la base seule**. Les documents
> filesystem (`CAREPLUS_DOCUMENTS_ROOT`) **ne sont pas** dans le dump → prévoir un
> `rsync`/`tar` séparé du dossier `data/documents` sur le même disque externe.
> **Décision lead §8** : intégrer les documents dans la routine de sauvegarde.

### Planification par systemd timer (préféré à cron)

```bash
sudo tee /etc/systemd/system/careplus-backup.service >/dev/null <<'EOF'
[Unit]
Description=CarePlus - sauvegarde quotidienne de la base
After=postgresql.service

[Service]
Type=oneshot
User=careplus
EnvironmentFile=/opt/careplus/careplus.env
# PGPASSWORD vient de DATABASE_PASSWORD via une petite indirection :
Environment=PGUSER=careplus PGDATABASE=careplus PGHOST=localhost PGPORT=5432
ExecStart=/bin/bash -lc 'PGPASSWORD="$DATABASE_PASSWORD" /opt/careplus/scripts/careplus-backup.sh'
EOF

sudo tee /etc/systemd/system/careplus-backup.timer >/dev/null <<'EOF'
[Unit]
Description=Declenche la sauvegarde careplus tous les jours a 02h00

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true      # rattrape si le PC etait eteint a 02h00 (coupure courant)

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now careplus-backup.timer
sudo systemctl list-timers careplus-backup.timer --no-pager
# Test immediat :
sudo systemctl start careplus-backup.service && tail -n 5 /opt/careplus/data/backups/careplus-backup.log
```

> `Persistent=true` est important au Maroc : si le PC était éteint (coupure) à 02h,
> la sauvegarde se déclenche au prochain démarrage. cron n'a pas cet équivalent
> simple (anacron oui, mais systemd timer est natif et déjà là).

### Où atterrissent les sauvegardes + lien OVH

- Local : `/opt/careplus/data/backups/careplus_*.dump` (rétention 30 j).
- **Hors site** : copier ces `.dump` sur un **disque externe chiffré (LUKS)**, en
  rotation de 2 disques. À automatiser dans le `.service` (`rsync` vers le point de
  montage du disque).
- **OVH (futur, ADR-006)** : quand le module `backup` sera implémenté, il chiffrera
  le dump (AES-256-GCM, clé dérivée du mot de passe maître cabinet) et l'enverra
  vers `careplus-backup-<cabinetId>` à OVH Casablanca. **D'ici là, le hors-site
  manuel sur disque externe est la seule protection contre incendie/vol — c'est un
  point à dire explicitement au client.**

### Drill de restauration (obligatoire — à répéter sur le banc)

Une sauvegarde non restaurée n'existe pas. Procédure sur le banc :

```bash
# 1. Arreter l'app (aucune connexion active sur la base)
sudo systemctl stop careplus

# 2. Restaurer un dump donne (DESTRUCTIF)
LATEST="$(ls -t /opt/careplus/data/backups/careplus_*.dump | head -1)"
sudo -u careplus bash -lc \
  "PGPASSWORD='$DB_PASS' pg_restore -h localhost -p 5432 -U careplus -d careplus \
     --clean --if-exists --no-owner '$LATEST'"

# 3. Redemarrer et verifier
sudo systemctl start careplus
curl -s http://localhost:8080/actuator/health
```

Alternative in-app : se connecter en SUPER_ADMIN → Paramètres → Sauvegarde, choisir
le `.dump`, confirmer. (S'appuie sur `BackupController`, même `pg_restore`.) Le
script CLI reste le recours quand l'app ne démarre plus.

**Critère de réussite du drill** : après restauration, login OK, un patient
attendu présent, l'agenda du jour cohérent. Chronométrer (RTO).

---

## 7. Simuler une installation cliente

Le but : répéter l'install **à blanc**, autant de fois qu'on veut, sans laisser de
résidu.

### Reset rapide (le levier du banc)

- **VM (recommandé)** : prendre un **snapshot** juste après la §5.0 (Linux nu +
  prérequis OS). Pour rejouer une install complète, **restaurer le snapshot** →
  on repart d'un Linux propre en ~30 s, puis on déroule §5.1 → §5.8.
- **Machine physique** (pas de snapshot) : script de remise à zéro =
  `systemctl stop careplus` ; `DROP DATABASE careplus; CREATE DATABASE careplus
  OWNER careplus …` ; vider `data/documents` et `data/backups` ; redémarrer →
  Flyway recrée tout.

### Seed vs migration-only

- **Mode fidèle prod (par défaut du banc en clientèle)** : profil `prod-onprem`,
  **migration-only** (`db/migration`), **pas** de `db/seed`. Base vide → bootstrap
  admin via §5.8. C'est ce qu'on livre au client. **Règle projet : la prod n'utilise
  jamais `db/seed`.**
- **Mode démo/entraînement** : pour montrer une UI déjà peuplée (former une
  secrétaire, démo commerciale), lancer ponctuellement avec le profil **`dev`**
  (`SPRING_PROFILES_ACTIVE=dev`) qui active `DevUserSeeder` (3 users dont
  `youssef.elamrani@careplus.ma`, mdp `ChangeMe123!`) et le seed Flyway dev.
  **Ne JAMAIS livrer un cabinet en profil `dev`** — supprimer le seed avant la
  vraie install (d'où l'intérêt du reset/snapshot).

### Check-list de validation « install saine »

À cocher à chaque répétition d'install :

- [ ] `java -version` = Temurin **21.x** ; `psql -V` = **16.x**.
- [ ] `systemctl is-active careplus postgresql` = `active` ; les deux `enabled`
      (redémarrent au boot — test : `sudo reboot`, l'app remonte seule).
- [ ] `curl localhost:8080/actuator/health` = `{"status":"UP"}`.
- [ ] Cold start < ~15 s (mesuré dans `journalctl -u careplus`).
- [ ] `flyway_schema_history` : 72 migrations appliquées, aucune `success=false`.
      (`sudo -u postgres psql careplus -c "SELECT count(*), bool_and(success)
      FROM flyway_schema_history;"`)
- [ ] Bootstrap admin OK (201) puis verrouillé (409).
- [ ] Login navigateur depuis **un autre poste du LAN** (`http://<IP>:8080`).
- [ ] UFW : 8080 ouvert, **5432 fermé** au LAN (`sudo ss -tlnp | grep 5432` →
      `127.0.0.1` seulement).
- [ ] Timer de sauvegarde armé (`systemctl list-timers careplus-backup.timer`) ;
      un `.dump` produit par un run manuel.
- [ ] **Drill de restauration** réussi (login + données après restore).
- [ ] Test **coupure courant** : couper brutalement la VM/PC, rallumer → Postgres
      récupère, app remonte, dernière sauvegarde intacte.
- [ ] Documents : un PDF (ordonnance) généré atterrit dans `data/documents`.

---

## 8. Questions / décisions pour le lead

1. **Scripts de sauvegarde Linux** : le repo n'a que les `.ps1` (Windows). On
   committe `scripts/backup/careplus-backup.sh` + les units systemd proposés ici ?
   (Décision : oui/non, et où.)
2. **TLS sur le LAN** : HTTP simple casse le cookie refresh `Secure` (ADR-019). On
   active TLS auto-signé **dans Spring Boot** (`server.ssl.*`, reste un seul
   processus, conforme ADR-020) ? Ou on assouplit le flag `Secure` en mode
   ON_PREMISE ? À trancher car ça touche l'auth.
3. **Sauvegarde OVH (ADR-006)** : toujours au BACKLOG. Calendrier ? Tant qu'elle
   n'existe pas, le seul hors-site est le disque externe manuel — assumé et
   documenté côté client ?
4. **Documents dans la sauvegarde** : `pg_dump` ne couvre PAS
   `CAREPLUS_DOCUMENTS_ROOT`. On ajoute un `tar`/`rsync` du dossier documents dans
   la routine (sinon restauration partielle) ? **Recommandé : oui.**
5. **Embedded Postgres** : CLAUDE.md évoque « embedded Postgres Windows » en prod ;
   sur Linux on installe Postgres en service système (ce doc). Confirmer qu'on
   **ne cherche pas** d'embedded sur le banc Linux (incohérent et inutile).
6. **Spec banc** : un mini-PC **8 Go / 256 Go SSD / 4 cœurs** comme machine de
   référence unique, qu'on snapshotte en VM pour les répétitions, c'est validé ?
7. **Stockage des secrets** : `careplus.env` en `chmod 600`. Faut-il un coffre
   (pass / Bitwarden) pour les mots de passe DB + secret JWT par cabinet, plutôt
   qu'un fichier sur la machine ?
8. **Onduleur** : doit-on imposer un UPS comme **prérequis contractuel** d'install
   (corruption Postgres en cas de coupure pendant écriture) ?

---

*Brouillon — relecture lead requise. Aligné sur ADR-006, ADR-020, ADR-019,
ADR-022 et la mémoire projet (prod = `db/migration` only).*
