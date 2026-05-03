# Filtres avancés + export détaillé sur les factures

**Date** : 2026-05-02
**Module** : `ma.careplus.billing`
**Source** : demande utilisateur "appliquer des filtres (dates, type…) sur les factures et faire un export détaillé"
**Backlog entry** : `docs/BACKLOG.md` § Billing — "Filtres + export détaillé sur les factures"

---

## 1. Contexte

`GET /api/invoices` actuel ne supporte que `status` et `patientId`. `FacturationPage.tsx` n'expose que des chips de statut. Pas d'export. Use cases bloqués : clôture comptable mensuelle, déclaration fiscale (TVA / IR / journal des ventes), contrôle URSSAF / CNSS, analyse interne par praticien / acte.

Le module billing est complet en lecture (`Invoice` aggregate + `Payment` + `CreditNote` + jointures `Patient` / `MutuelleInsurance`). Aucune nouvelle table requise.

## 2. Décisions de design (issues du brainstorming 2026-05-02)

| # | Question | Choix |
|---|---|---|
| Q1 | Use case principal | Générique (couvre clôture / fiscal / analyse) |
| Q2 | Granularité export | 1 ligne par facture (entête) |
| Q3 | Plage de dates | Un seul date-picker + toggle radio Émission / Encaissement |
| Q4 | Filtres v1 | Statut multi + Mode paiement multi + Patient + Montant min/max. Praticien / Type d'acte / Mutuelle → backlog |
| Q5 | Format export | CSV + xlsx (lib `fastexcel`) |
| Q6 | Volume | In-memory + garde-fou `count(*) > 10 000` → 422 |
| Q7 | Permissions | Filtrer = tous rôles existants ; Exporter = MEDECIN + ADMIN seulement |
| Q8 | Colonnes | 14 colonnes (cf. § 5.2). Praticien retiré (mono-praticien) |
| Q9 | UX desktop | Chips Statut inline conservées + bouton "Filtres avancés" → popover + CTA "Exporter" toujours visible |
| Q10 | Mobile | Filtres oui, export non (bouton masqué sous breakpoint mobile) |

## 3. Architecture

### 3.1 Endpoints

```
GET /api/invoices/search        → recherche filtrée paginée (JSON)
GET /api/invoices/export        → export fichier (CSV ou xlsx)
```

Le `GET /api/invoices` existant est conservé (deprecated dans Swagger) pour ne pas casser l'existant. Le frontend bascule entièrement sur `/search`.

### 3.2 Paramètres communs

| Param | Type | Sémantique |
|---|---|---|
| `dateField` | enum `ISSUED` \| `PAID` (défaut `ISSUED`) | Quel champ utilise la plage |
| `from`, `to` | `LocalDate` | Plage inclusive (TZ Africa/Casablanca) |
| `status` | `List<InvoiceStatus>` | Multi-valué |
| `paymentMode` | `List<PaymentMode>` | Sémantique : `EXISTS payment WHERE mode IN …` |
| `patientId` | `UUID` | Optionnel |
| `amountMin`, `amountMax` | `BigDecimal` | Sur `net_amount` |

Spécifique `/export` : `format=csv|xlsx` (défaut `csv`).
Spécifique `/search` : `page`, `size` (défaut 50, max 200).

### 3.3 Implémentation

- Filtres traduits via **JPA Specifications** (`InvoiceSpecifications.build(filter)`) — combinaisons AND dynamiques, plus lisible que `@Query` avec optionals. À documenter dans DECISIONS.md (préférence Specifications vs QueryDSL : zéro dep additionnelle).
- Garde-fou export : `count(spec)` avant `findAll(spec)`. Si > 10 000 → `422 Unprocessable Entity` body `{code:"EXPORT_TOO_LARGE", limit:10000, actual:N}`.
- Cache HTTP : `no-store` (paiements live).

### 3.4 Permissions

```java
@GetMapping("/api/invoices/search")
@PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")

@GetMapping("/api/invoices/export")
@PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
```

## 4. Modèle de données & SQL

### 4.1 Index Flyway (migration `V0XX__invoice_filter_indexes.sql`)

```sql
CREATE INDEX idx_invoice_issued_at    ON billing_invoice(issued_at)  WHERE issued_at IS NOT NULL;
CREATE INDEX idx_invoice_status       ON billing_invoice(status);
CREATE INDEX idx_invoice_net_amount   ON billing_invoice(net_amount);
CREATE INDEX idx_payment_received     ON billing_payment(received_at);
CREATE INDEX idx_payment_invoice_mode ON billing_payment(invoice_id, mode);
```

### 4.2 Predicates

| Filtre UI | Predicate JPA |
|---|---|
| `dateField=ISSUED, from, to` | `issued_at >= from AND issued_at < to+1day` |
| `dateField=PAID, from, to` | `EXISTS (SELECT 1 FROM payment p WHERE p.invoice_id = inv.id AND p.received_at >= from AND p.received_at < to+1day)` |
| `status=[…]` | `status IN (…)` |
| `paymentMode=[…]` | `EXISTS (… WHERE p.mode IN (…))` |
| `patientId` | `patient_id = ?` |
| `amountMin/Max` | `net_amount BETWEEN ? AND ?` |

### 4.3 Bords

- BROUILLON n'a pas de `issued_at` → filtre `dateField=ISSUED + status=BROUILLON` = résultat vide. Documenté dans Swagger.
- TZ : conversion `LocalDate` → `OffsetDateTime` au boundary HTTP : `from.atStartOfDay(ZoneId.of("Africa/Casablanca")).toOffsetDateTime()`. Cohérent avec `CaisseTodayPanel`.
- Tri : `issued_at DESC NULLS LAST, created_at DESC`.

## 5. DTO & format de sortie

### 5.1 DTO `/search`

```java
public record InvoiceSearchResponse(
    List<InvoiceListRow> items,
    int totalCount,
    BigDecimal totalNet,
    BigDecimal totalPaid,
    BigDecimal totalRemaining
) {}

public record InvoiceListRow(
    UUID id, String number, InvoiceStatus status,
    UUID patientId, String patientFullName, String patientPhone,
    String mutuelleName,
    BigDecimal totalAmount, BigDecimal discountAmount,
    BigDecimal netAmount, BigDecimal paidAmount,
    Set<PaymentMode> paymentModes,
    OffsetDateTime issuedAt, OffsetDateTime lastPaymentAt, OffsetDateTime createdAt
) {}
```

### 5.2 Colonnes export (14)

| # | Colonne | Source |
|---|---|---|
| 1 | Numéro | `invoice.number` (vide si BROUILLON) |
| 2 | Date émission | `invoice.issued_at` (`JJ/MM/AAAA`) |
| 3 | Statut | libellé FR |
| 4 | Patient | `last_name + first_name` |
| 5 | Téléphone | `patient.phone` |
| 6 | Mutuelle | `mutuelle_insurance.name` |
| 7 | Total brut (MAD) | `invoice.total` |
| 8 | Remise (MAD) | `invoice.discount_amount` |
| 9 | Net (MAD) | `invoice.net_amount` |
| 10 | Encaissé (MAD) | `invoice.paid_total` |
| 11 | Reste (MAD) | `net - paid` |
| 12 | Modes de paiement | concat distinct (`"ESPECES, CB"`) |
| 13 | Date dernier encaissement | `max(payments.received_at)` |
| 14 | Date création | `invoice.created_at` |

### 5.3 Format CSV

- UTF-8 **BOM** (`﻿`) → Excel-Windows lit les accents.
- Séparateur `;`. Décimales `1234,56`. Dates `JJ/MM/AAAA`.
- Quote uniquement si la cellule contient `;` `"` `\n`.
- En-têtes en français en ligne 1.
- Filename : `factures_2026-04-01_2026-04-30.csv`.

### 5.4 Format xlsx (`fastexcel`)

- 1 feuille `Factures`.
- En-têtes en gras, fond gris clair, freeze pane sur ligne 1.
- Colonnes typées : montants → `Number` format `#,##0.00 "MAD"` ; dates → `Date` format `dd/mm/yyyy`.
- Ligne SUM en pied (Net / Encaissé / Reste) en gras.
- Auto-width des colonnes.
- Filename : `factures_2026-04-01_2026-04-30.xlsx`.

## 6. UX

### 6.1 Layout `FacturationPage` (desktop)

```
CaisseTodayPanel (existant, inchangé)
[chips Statut: Toutes|Brouillons|…]   [Filtres avancés ▾]  [Exporter ▾]
[KPI: Total net | Encaissé | À encaisser]   ← réagissent aux filtres
[table factures]
```

### 6.2 Popover "Filtres avancés" (~360 px de large, Radix Popover)

```
Date à appliquer  ( ) Émission  (•) Encaissement
Du [__/__/____]  au  [__/__/____]
                                 [Ce mois] [Mois dernier] [Cette année]

Modes de paiement  (multi)
[ ] Espèces  [ ] Chèque  [ ] CB  [ ] Virement  [ ] Tiers payant

Patient
[autocomplete: nom ou téléphone]

Montant net (MAD)
Min [_____]   Max [_____]

[Réinitialiser]                              [Appliquer]
```

- Presets de plage (3 boutons) → 1 clic, fixe `from`/`to`.
- État synchronisé en URL (`?from=…&status=EMISE`) — bookmarkable, back-button friendly.
- Badge `(N)` sur le bouton "Filtres avancés" si N filtres ≠ défaut.

### 6.3 Bouton Exporter (split button)

```
[Exporter ▾]
   ├─ Exporter en CSV (.csv)
   └─ Exporter en Excel (.xlsx)
```

- Hook `useInvoiceExport()` : `fetch` blob avec auth, déclenche `<a download>` (filename via `Content-Disposition`).
- Pendant DL : bouton désactivé + spinner + texte "Préparation…".
- 422 → toast `Trop de résultats (N). Affinez vos filtres (max 10 000).`.
- 403 → bouton caché à la base via `useCurrentUser().hasRole('MEDECIN','ADMIN')`.

### 6.4 Mobile (390 px)

- Popover devient Sheet plein écran.
- Bouton "Exporter" masqué (`useMediaQuery('(max-width: 767px)')`).

## 7. Tests

### 7.1 Backend `BillingExportIT.java` (Testcontainers + `@SpringBootTest`)

`/search` :
1. Aucun filtre → tout, ordre `issued_at DESC NULLS LAST`.
2. Plage `dateField=ISSUED` — facture du 31/03 et du 01/05 exclues.
3. Plage `dateField=PAID` — facture émise en mars + payée le 5 avril : présente avec `dateField=PAID&from=2026-04-01`, absente avec `dateField=ISSUED`.
4. `status=EMISE&status=PAYEE_TOTALE` — multi-valué OR, BROUILLON exclu.
5. `paymentMode=ESPECES` — facture mixte CB+ESPECES présente, full-CB absente.
6. `amountMin=500&amountMax=1000` — bornes inclusives.
7. Combinaison `from + status + amountMin` — AND strict.
8. TZ Casablanca — facture émise `2026-04-30T23:30:00+01:00` présente avec `to=2026-04-30`.
9. Pagination `page=1&size=10`.
10. KPIs agrégés sur le résultat filtré.
11. 403 — SECRETAIRE OK, MEDECIN OK.

`/export` :
12. CSV — `Content-Type: text/csv; charset=utf-8`, BOM, `;`, dates `JJ/MM/AAAA`, montants `1234,56`, header `Content-Disposition`.
13. xlsx — magic bytes `PK\x03\x04`, ouvre via fastexcel reader, en-têtes gras, montants typés Number, ligne SUM correcte.
14. Garde-fou — 10 001 factures seedées → `422 EXPORT_TOO_LARGE` body `{limit:10000, actual:10001}`.
15. Filtres respectés — `status=EMISE` → fichier sans BROUILLON.
16. 403 — SECRETAIRE → 403 sur `/export` mais 200 sur `/search`. MEDECIN/ADMIN → 200.
17. Brouillon dans CSV — numéro vide, date émission vide, mutuelle vide si non couvert.

### 7.2 Frontend `FacturationPage.test.tsx` (Vitest + RTL + msw)

1. Popover s'ouvre au clic.
2. Preset "Ce mois" remplit les date-pickers correctement.
3. "Appliquer" déclenche `useInvoiceSearch` avec les bons params.
4. Badge `(N)` quand N filtres ≠ défaut.
5. URL synchronisée.
6. Bouton "Exporter" caché si user.role = SECRETAIRE.
7. Click "Exporter en CSV" → fetch avec `format=csv`, blob téléchargé (mock `URL.createObjectURL`).
8. 422 → toast.
9. Mobile (mediaQuery < 768) — bouton Exporter absent.

## 8. Scope

### 8.1 Dans la v1 (~1 jour de dev)

- 2 endpoints (`/search`, `/export`).
- 1 migration Flyway (5 index).
- Dépendance `org.dhatim:fastexcel` + ADR dans DECISIONS.md.
- `InvoiceSpecifications` + `InvoiceExporter` (interface) + `CsvInvoiceExporter` + `XlsxInvoiceExporter`.
- Frontend : popover, split button, hook `useInvoiceExport`, sync URL, variant mobile (sheet, bouton export masqué).
- 17 + 9 scénarios de tests.
- Manual QA desktop + mobile 390 px avant push, IT sibling avant la 2ᵉ commit.

### 8.2 Hors scope — push BACKLOG

- Filtre Praticien (mono-praticien aujourd'hui).
- Filtre Type d'acte / Prestation (jointure InvoiceLine, sémantique multi-match).
- Filtre Mutuelle (utile feuilles de soins par caisse).
- Multi-onglets xlsx (Lignes + Paiements).
- Streaming `StreamingResponseBody` pour > 10 000 lignes.
- Audit log des exports (qui / quand / quels filtres / nb lignes) — relié à l'item Audit log existant.
- Export PDF "rapport du mois".
- Save de filtres "favoris".

### 8.3 Risques

- `fastexcel` < Apache POI (pas de formules, pas de chart) — suffit pour table plate + ligne SUM.
- In-memory peak ~50 Mo de heap pour 10 000 lignes xlsx — acceptable sur serveur 512 Mo.
- `dateField=PAID` sans index `payment.received_at` → seq scan. Index inclus dans la migration.

## 9. Plan d'attaque

1. Backend : migration + `InvoiceSpecifications` + endpoint `/search` + IT scénarios 1–11.
2. Backend : `CsvInvoiceExporter` + `XlsxInvoiceExporter` + endpoint `/export` + IT scénarios 12–17.
3. Frontend : refacto `useInvoices` → `useInvoiceSearch`, popover, split button, sync URL, tests 1–8.
4. Frontend : variant mobile (sheet + masquage Exporter), test 9.
5. Manual QA desktop + mobile, commit feature (feat).
6. Polish : doc Swagger, ADR `fastexcel`, mise à jour BACKLOG, commit IT/spec automatisée (test).
