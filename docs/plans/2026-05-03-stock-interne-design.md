# Module Stock interne — Design

**Date** : 2026-05-03
**Statut** : design validé, prêt à implémentation
**Origine** : demande terrain Y. Boutaleb (BACKLOG QA7-1, 2026-05-02). Brainstorming Q1-Q8 figé via décisions ci-dessous.

## Contexte projet

- careplus = SICM mono-cabinet pour médecin généraliste marocain.
- Module #2 de la wave QA7 (après Vaccination, livré 2026-05-03 commits `290129f`→`b697dd8`).
- ADRs en vigueur : ADR-013 (RBAC modulaire), ADR-018 (régression frontend J-day), ADR-021 (parallel-sync), ADR-026/028 (matérialisation à la volée + PageView).

## Recherche marché — synthèse rapide

### EMR / ERP médicaux internationaux

Features standard :
- **Référentiel articles** avec catégories (médicaments, consommables, instruments).
- **Lots & péremption** sur médicaments (FIFO recommandé, alerte J-30).
- **Mouvements** IN/OUT/AJUSTEMENT avec audit user + horodatage + motif.
- **Seuil mini par article** + alerte « stock faible ».
- **Fournisseurs** + dernier prix d'achat par article.
- **Inventaire** batch trimestriel (out of MVP scope).
- **Lien consommation → patient/consultation** (out of MVP scope per Q1 décision).

### Spécificités cabinet GP marocain

- Pas d'obligation légale d'inventaire formalisé (vs pharmacie d'officine).
- Pas de gestion de stupéfiants en GP standard (carnet à souche papier obligatoire si applicable).
- Achats principaux : compresses, gants nitrile, seringues, désinfectant (Bétadine, alcool), papier ECG, coton, abaisse-langues, échantillons médecins (rares).
- Volume typique : ~50-80 articles distincts, ~5-10 mouvements/jour.

## Décisions de design (issues du brainstorming Q1-Q8)

| # | Question | Décision | Rationale |
|---|---|---|---|
| Q1 | Profondeur fonctionnelle | **B Standard** : articles + IN/OUT/AJUSTEMENT + seuils + lots/péremption (médicaments) + fournisseurs simples | Sans lots/péremption sur médicaments on rate le risque clé (médicament périmé). Sans gestion de commandes (out of scope), pas besoin de fournisseurs sophistiqués. |
| Q2 | Couverture lots | **MEDICAMENT_INTERNE seulement** | Saisie de lot+date pour chaque carton de gants ralentit le check-in sans gain. La péremption a un enjeu clinique/légal direct uniquement sur médicaments. |
| Q3 | UX saisie | **Quick-action sur fiche article** (drawer +/-) | 90% des mouvements sont OUT unitaires. Page dédiée ralentit le cas commun. Saisie en masse en v2 si demandé. |
| Q4 | Alertes | **Badge sidebar uniquement** + filtre liste | Salle d'attente déjà chargée. L'écran dédié `/stock/alertes` peut attendre v2 — le filtre intégré à la liste suffit. |
| Q5 | RBAC | **MEDECIN/ADMIN tout, ASSISTANT mouvements, SECRETAIRE IN + AJUSTEMENT** | La secrétaire signe le bon de livraison → IN. La consommation OUT est faite par le soignant. |
| Q6a | Stratégie OUT | **FIFO automatique par péremption** | Médecin n'a pas le temps de sélectionner un lot par sortie. Lot rappelé → marqué INACTIVE en bloc, FIFO l'ignore. |
| Q6b | Lot épuisé | Auto `EXHAUSTED` à qty=0 | Garde la row pour audit + stats, exclu du FIFO. |
| Q7 | Inventaire | **AJUSTEMENT direct depuis fiche article** | 95% des cas couverts. Inventaire batch (B) en v2 si retour pilote le réclame. |
| Q8 | Fournisseurs | **Minimal : nom + téléphone** | Sans module commandes, le « dernier prix d'achat » est une donnée morte. Évolution naturelle en v2 avec le module commandes. |

## Modèle de données

### Quatre tables nouvelles

**`stock_supplier`** — fournisseurs (éditable Paramétrage)
- `id` UUID PK
- `name` VARCHAR(200) NOT NULL
- `phone` VARCHAR(50)
- `active` BOOLEAN DEFAULT TRUE
- audit cols (`created_at`, `updated_at`) + `version`

**`stock_article`** — référentiel articles (éditable Paramétrage)
- `id` UUID PK
- `code` VARCHAR(64) UNIQUE NOT NULL — ex. `GANT-NITRILE-S`, `BETADINE-125`
- `label` VARCHAR(200) NOT NULL
- `category` ENUM(`MEDICAMENT_INTERNE`, `DOSSIER_PHYSIQUE`, `CONSOMMABLE`) NOT NULL
- `unit` VARCHAR(32) NOT NULL — ex. `boîte`, `flacon`, `unité`, `mL`
- `min_threshold` INT DEFAULT 0 — seuil d'alerte stock faible
- `supplier_id` UUID NULL REFERENCES stock_supplier(id)
- `location` VARCHAR(200) — texte libre (« Armoire 1, tiroir B »)
- `active` BOOLEAN DEFAULT TRUE
- `tracks_lots` BOOLEAN GENERATED ALWAYS AS (category = 'MEDICAMENT_INTERNE') STORED — colonne calculée
- audit cols + `version`
- INDEX (category, active)

**`stock_lot`** — lots actifs et historiques (uniquement MEDICAMENT_INTERNE)
- `id` UUID PK
- `article_id` UUID NOT NULL REFERENCES stock_article(id)
- `lot_number` VARCHAR(100) NOT NULL
- `expires_on` DATE NOT NULL
- `quantity` INT NOT NULL — quantité restante dans le lot
- `status` ENUM(`ACTIVE`, `EXHAUSTED`, `INACTIVE`) DEFAULT 'ACTIVE'
- audit cols + `version`
- UNIQUE (article_id, lot_number)
- INDEX (article_id, status, expires_on)

**`stock_movement`** — historique de tous les mouvements (immutable, jamais soft-delete)
- `id` UUID PK
- `article_id` UUID NOT NULL REFERENCES stock_article(id)
- `lot_id` UUID NULL REFERENCES stock_lot(id) — nul pour articles sans lots
- `type` ENUM(`IN`, `OUT`, `ADJUSTMENT`) NOT NULL
- `quantity` INT NOT NULL — toujours positif ; le signe est porté par `type`
- `reason` VARCHAR(500) — obligatoire si `ADJUSTMENT`, libre sinon
- `performed_by` UUID NOT NULL REFERENCES identity_user(id)
- `performed_at` TIMESTAMPTZ DEFAULT now() NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT now()
- INDEX (article_id, performed_at DESC) — historique par article

### Vue calculée : `stock_article_view` (pas une matérialisée — query)

Le « stock disponible » d'un article est calculé à la volée :
- Pour `tracks_lots = false` : `SUM(IN.quantity) - SUM(OUT.quantity) + SUM(ADJUSTMENT signé)` depuis stock_movement
- Pour `tracks_lots = true` : `SUM(stock_lot.quantity WHERE status = 'ACTIVE')`

Pas de colonne dénormalisée `current_quantity` sur `stock_article` pour éviter la dérive entre cache et historique. Calcul à la requête, indexé.

### Stratégie clé : FIFO sur OUT (médicaments)

Quand un OUT est saisi sur un article médicament avec quantité Q :
1. Lister les lots `ACTIVE` triés par `expires_on ASC, created_at ASC`.
2. Décrémenter dans l'ordre jusqu'à atteindre Q. Un OUT peut donc créer plusieurs `stock_movement` rows (un par lot consommé) si Q > qty d'un seul lot.
3. Si un lot atteint `quantity = 0` → `status = 'EXHAUSTED'`.
4. Si stock total ACTIVE < Q → 422 INSUFFICIENT_STOCK.

Le médecin saisit Q ; le service fait le split lot automatiquement.

## API REST

Module Spring : `ma.careplus.stock` (`domain` / `application` / `infrastructure.web` / `infrastructure.persistence`).

### Articles — `/api/stock/articles`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/stock/articles` | tous | Liste paginée. Query : `category`, `supplierId`, `belowThreshold` (true/false), `q` (recherche label/code), `page`, `size`. Returns `PageView<StockArticleView>` avec `currentQuantity` calculé + `nearestExpiry` pour médicaments. |
| GET | `/api/stock/articles/{id}` | tous | Détail article + lots actifs + dernier mouvement. |
| POST | `/api/stock/articles` | MEDECIN/ADMIN | Créer article. |
| PUT | `/api/stock/articles/{id}` | MEDECIN/ADMIN | Modifier (sauf `category` immutable post-mouvements). |
| DELETE | `/api/stock/articles/{id}` | MEDECIN/ADMIN | Soft-delete via `active=false`. |

### Mouvements — `/api/stock/articles/{id}/movements`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/stock/articles/{id}/movements` | tous | Historique paginé desc, query : `from`, `to`, `type`. |
| POST | `/api/stock/articles/{id}/movements` | matrice RBAC | `{type, quantity, reason?, lotNumber?, expiresOn?}`. Pour IN sur médicament : `lotNumber` + `expiresOn` requis (création/incrément du `stock_lot`). |

### Lots — `/api/stock/articles/{id}/lots`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/stock/articles/{id}/lots` | tous | Liste lots de l'article (ACTIVE + EXHAUSTED + INACTIVE selon param `status`). |
| PUT | `/api/stock/lots/{lotId}/inactivate` | MEDECIN/ADMIN | Marque un lot INACTIVE (rappel fournisseur). Ne crée pas de mouvement OUT. |

### Fournisseurs — `/api/stock/suppliers`

| Verbe | Path | Rôle |
|---|---|---|
| GET | `/api/stock/suppliers` | tous |
| POST/PUT/DELETE | `/api/stock/suppliers[/{id}]` | MEDECIN/ADMIN |

### Alertes — `/api/stock/alerts`

| Verbe | Path | Rôle | Description |
|---|---|---|---|
| GET | `/api/stock/alerts/count` | tous | `{lowStock: int, expiringSoon: int}` — pour le badge sidebar (polling 30 s). |
| GET | `/api/stock/alerts` | tous | Liste détaillée des articles below threshold + lots péremption < J30. |

### Matrice RBAC

| Action | SECRETAIRE | ASSISTANT | MEDECIN | ADMIN |
|---|---|---|---|---|
| Lecture catalog/lots/mouvements/alertes | ✅ | ✅ | ✅ | ✅ |
| POST IN | ✅ | ✅ | ✅ | ✅ |
| POST OUT | ❌ (403) | ✅ | ✅ | ✅ |
| POST ADJUSTMENT | ✅ | ✅ | ✅ | ✅ |
| PUT lot inactivate | ❌ | ❌ | ✅ | ✅ |
| CRUD article | ❌ | ❌ | ✅ | ✅ |
| CRUD fournisseur | ❌ | ❌ | ✅ | ✅ |

Enforcement via `@PreAuthorize` au controller layer.

## Frontend — slice `features/stock/`

### 1. Page `/stock` — liste articles

- Route `RequireRole={['SECRETAIRE','ASSISTANT','MEDECIN','ADMIN']}`.
- Tableau paginé : code | label | catégorie | quantité actuelle | seuil | unité | fournisseur | actions (Voir, Edit MEDECIN/ADMIN).
- Filtres toolbar : catégorie (3 chips), fournisseur (select), `belowThreshold` checkbox, recherche `q`.
- Pour médicaments : pill « Périme dans Xj » sur la prochaine péremption < 30j.
- Bouton « Ajouter article » (MEDECIN/ADMIN).
- Mobile 390 px : cartes empilées.
- Sidebar : item `Stock` avec badge polling 30 s sur `/api/stock/alerts/count` (somme `lowStock + expiringSoon`).

### 2. Page `/stock/articles/{id}` — fiche article

- Header : code, label, catégorie, fournisseur, quantité actuelle, seuil min.
- Section « Mouvements rapides » : 3 boutons gros : `+ Entrée`, `− Sortie`, `Ajuster`.
- Section « Lots actifs » (médicaments uniquement) : tableau lots (numéro, péremption, qty, action `Inactiver` MEDECIN/ADMIN).
- Section « Historique » : tableau paginé des 50 derniers mouvements (date, type pill, qty, lot?, motif, par qui).
- Drawer commun aux 3 boutons : `MovementDrawer` avec form contextuel (lot+exp pour IN médicament, motif obligatoire pour ADJUSTMENT, etc.).
- Mobile : header empilé, boutons full-width, sections collapsibles.

### 3. Onglet `Stock` dans `ParametragePage` (desktop ADMIN/MEDECIN)

Deux sections :
- Section 1 — Fournisseurs (CRUD : nom, téléphone, actif).
- Section 2 — Articles (lien vers la liste `/stock` + bouton « Importer CSV » placeholder désactivé en MVP).

Pas de version mobile pour Paramétrage (rejected scope, aligné Vaccination).

### Hooks
- `useStockArticles(filters)`
- `useStockArticle(id)`
- `useStockMovements(articleId, filters)`
- `useStockLots(articleId)`
- `useStockAlertsCount()` — polling 30 s pour badge sidebar
- `useStockAlerts()` — détail
- `useStockSuppliers()`
- `useUpsertArticle`, `useDeactivateArticle`
- `useRecordMovement` (IN/OUT/ADJUSTMENT — drawer commun)
- `useInactivateLot`
- `useUpsertSupplier`, `useDeactivateSupplier`

## Tests d'intégration — `Stock*IT.java`

Pattern : Testcontainers Postgres + MockMvc + JdbcTemplate (aligné `VaccinationCatalogIT` / `BillingIT`).

### `StockCatalogIT` (~10 scénarios)
1. Créer article CONSOMMABLE → 201, `tracks_lots = false`.
2. Créer article MEDECIN_INTERNE → 201, `tracks_lots = true` (calculé).
3. CRUD fournisseurs.
4. RBAC : POST article SECRETAIRE 403, ASSISTANT 403, MEDECIN/ADMIN 201.
5. Code unique → POST 2× même code 409.
6. PUT category après mouvement → 422 CATEGORY_LOCKED.
7. Soft-delete (active=false) → reste dans GET avec filtre `includeInactive`.

### `StockMovementIT` (~12 scénarios)
1. IN consommable simple : qty +10 → currentQuantity = 10, pas de lot créé.
2. IN médicament : `lotNumber=L1, expiresOn=2027-06-01` → lot créé `qty=10`.
3. IN médicament sans lot/exp → 400 LOT_REQUIRED.
4. OUT consommable : qty -3 → currentQuantity = 7.
5. OUT médicament FIFO : lot L1 expire 2026-12, lot L2 expire 2027-06 → OUT 5 décrémente L1.
6. OUT médicament FIFO multi-lots : lot L1 qty=3 expire bientôt + lot L2 qty=10 → OUT 5 → L1 EXHAUSTED + L2 qty=8.
7. OUT médicament insuffisant : stock total 5, OUT 10 → 422 INSUFFICIENT_STOCK.
8. ADJUSTMENT : nouvelle qty = 8 (était 10) → mouvement type ADJUSTMENT, qty=2 (différence absolue), reason persisté.
9. ADJUSTMENT sans reason → 400 REASON_REQUIRED.
10. RBAC : POST OUT SECRETAIRE 403, ASSISTANT 201, MEDECIN 201.
11. Lot inactivate : médicament avec lots L1+L2, inactivate L1 → FIFO ignore L1, OUT 5 décrémente L2.
12. Historique mouvements ordonné desc + filtré par type.

### `StockAlertIT` (~5 scénarios)
1. Article qty=5, seuil=10 → présent dans `/alerts` (lowStock).
2. Lot médicament expire dans 20 j → présent dans `/alerts` (expiringSoon).
3. Lot médicament expire dans 60 j → absent.
4. Lot INACTIVE → exclu des alertes.
5. `/alerts/count` agrège correctement.

### Manual QA après merge (agent `manual-qa`)
- Walk desktop : créer article médicament → faire IN avec lot/exp → voir badge augmenter si seuil → faire OUT → voir FIFO → faire AJUSTEMENT.
- Walk mobile 390 px : même flow en bottom-sheet.
- Walk Paramétrage : ajouter fournisseur → l'utiliser dans un article.
- Walk RBAC : login SECRETAIRE → vérifier OUT 403, IN OK.

## Plan d'implémentation séquentiel

1 commit feature + 1 commit IT par étape (`feedback_ship_order.md`).

### Étape 1 — Backend schéma + référentiel articles + fournisseurs (~1 j)
- `V024__stock_module.sql` : 4 tables + indexes + colonne calculée `tracks_lots`.
- Domain : entités + enums (Category, MovementType, LotStatus).
- Repos : `StockArticleRepository`, `StockSupplierRepository`, `StockLotRepository`, `StockMovementRepository`.
- Services : `StockCatalogService` (CRUD articles + suppliers).
- Endpoints `/articles` GET/POST/PUT/DELETE + `/suppliers` GET/POST/PUT/DELETE + RBAC.
- IT : `StockCatalogIT` (10 scénarios).

### Étape 2 — Backend mouvements + lots + FIFO (~1 j)
- `StockMovementService` (recordIn, recordOut, recordAdjustment, FIFO logic).
- `StockLotService` (inactivate).
- Endpoints `/articles/{id}/movements` POST/GET, `/articles/{id}/lots` GET, `/lots/{id}/inactivate` PUT.
- IT : `StockMovementIT` (12 scénarios).

### Étape 3 — Backend alertes + worklist agrégée (~0.5 j)
- `StockAlertService.queryAlerts()` : articles below threshold + lots near expiry.
- Endpoints `/alerts` + `/alerts/count`.
- IT : `StockAlertIT` (5 scénarios).

### Étape 4 — Frontend liste + fiche article + drawer mouvement (~1.5 j)
- Slice `features/stock/` : 11 hooks + types + schemas zod.
- `/stock` page liste (desktop + mobile 390 px).
- `/stock/articles/{id}` page fiche (desktop + mobile).
- `MovementDrawer` (3 modes IN/OUT/ADJUSTMENT, form contextuel).
- Sidebar : item Stock + badge `useStockAlertsCount()`.
- Tests vitest (~30 scénarios).

### Étape 5 — Frontend onglet Paramétrage fournisseurs + manual QA + docs (~0.5 j)
- `StockParamTab` dans `ParametragePage` (CRUD fournisseurs).
- Agent `manual-qa` : 4 walks desktop + mobile + Paramétrage + RBAC.
- Mise à jour `docs/PROGRESS.md`, `docs/API.md`, `docs/DECISIONS.md` (ADR-030 « Module stock — calcul de quantité à la volée + FIFO automatique »), retrait QA7-1 du BACKLOG.

**Total estimé : ~4 jours.**

## Risques & non-couverts (v1)

- **Pas de gestion de commandes/factures fournisseur** : la création d'un IN ne déclenche pas de PO. Hors scope, géré par BACKLOG.
- **Pas d'inventaire trimestriel batch** : si demandé après pilote, ajouter une page `/stock/inventaire`.
- **Pas de lien consommation → consultation** : un OUT n'est attaché à aucun patient. Si rappel fournisseur sur un lot consommé, on ne peut pas tracer les patients exposés. Q1 décision (B) ; ADR à écrire si on bascule un jour vers C.
- **Pas de stupéfiants/psychotropes** : pas de carnet à souche numérique. Hors scope GP standard ; si demandé, design dédié.
- **Pas de multi-emplacement** : `location` est texte libre. Si le cabinet a plusieurs salles avec stock séparé → v2.
- **Pas d'import CSV** des articles : MVP saisie manuelle. Si > 50 articles à seeder → ouvrir un import CSV similaire au module catalog.
