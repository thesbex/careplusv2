# Design — Mode dégradé + import de données

> **ADR assigné : ADR-048** (proposé) dans `docs/DECISIONS.md`. Toute mention interne de « ADR-045 » dans ce brouillon est remplacée par **ADR-048** ; l'ADR de dépendance `fastexcel-reader` reste à créer séparément. Référencé dans `docs/BACKLOG.md` (batch 2026-06-02).

**Statut**: DRAFT — pour relecture par le lead. Aucun code applicatif écrit. Ce document
est le seul artefact produit.

**Auteur**: agent de recherche · **Date**: 2026-06-02

**Demande (product owner, FR)**: « Je veux une solution de travail en mode dégradé (excel
ou autre) avec un import de données une fois l'application disponible. »

**Reformulation**: quand careplus est indisponible (panne serveur/BDD, coupure de courant
ou réseau, panne matérielle, ou cabinet pas encore installé / migration depuis un système
legacy ou papier), le cabinet continue à travailler sur **Excel/CSV**, puis **importe** ces
données dans careplus dès que l'app redevient disponible.

---

## 0. Contexte technique pré-existant (à ne pas réinventer)

Avant de concevoir, deux briques existent déjà dans le code et **doivent être réutilisées /
mises en cohérence** :

1. **Import CSV catalogue** — `ma.careplus.catalog.application.CatalogImportService`
   + `CatalogImportController` (`POST /api/catalog/{medications|lab-tests|imaging-exams}/import`).
   - Parser CSV maison RFC4180-lite (pas de dépendance), UTF-8, **auto-détection du
     séparateur `,` vs `;`** (Excel FR exporte `;`), normalisation d'en-tête (sans accents,
     alias FR `nom`→`name`, `categorie`→`category`…), **erreurs accumulées ligne-par-ligne**
     (une mauvaise ligne n'avorte pas l'import), retour `ImportResult(added, updated, skipped, errors)`.
   - Limite de taille **5 Mo**, garde RBAC `hasAnyRole('ADMIN','MEDECIN')`, permission
     `CATALOG_IMPORT` (V018).
   - **Décision ADR-009 explicite : XLSX volontairement hors scope, pas d'Apache POI au pom**
     (« on documente le format CSV requis dans la modale »).
   > Le pipeline d'import patient/RDV décrit ici **généralise ce service existant**. On garde
   > le même style (counters + erreurs ligne-par-ligne, auto-détection séparateur), on y ajoute
   > le **dry-run** et l'**idempotence** qui manquent au service catalogue.

2. **Export xlsx (fastexcel)** — `ma.careplus.billing.application.export.XlsxInvoiceExporter`
   (ADR-025). Lib `org.dhatim:fastexcel` (~200 Ko vs ~15 Mo Apache POI), cellules typées
   Number/Date, en-têtes gras, freeze pane, formules SUM. **C'est l'outil d'export déjà
   présent** — il sert de base à l'export-snapshot du §2a et au générateur de templates.
   - À noter : fastexcel **écrit** le xlsx ; pour **lire** un xlsx il faut `fastexcel-reader`
     (déjà au pom en `test`, ADR-025) — voir §8 pour la décision parser.

**Conséquence de conception** : le mode dégradé n'est pas un nouveau module isolé, c'est
l'extension d'un pattern déjà validé en prod. On vise un module `ma.careplus.dataio`
(export + import génériques) ou, plus simple en MVP, on étend le module `patient` puis
`scheduling`. Voir §9.

---

## 1. Scénarios

On distingue deux régimes par leur **durée** — c'est ce qui décide quoi capturer.

### 1.1 Courte panne (minutes → quelques heures)
- **App server down** (JVM plantée, redémarrage Windows en cours), **BDD down** (service
  PostgreSQL arrêté), **coupure courant/onduleur** brève.
- Le cabinet a besoin de **continuer l'accueil et la consultation du jour** : qui arrive,
  pour quel médecin, à quelle heure ; le médecin griffonne sa consultation.
- **Donnée la plus précieuse pendant la panne = la liste des patients existants** (pour
  retrouver un dossier, un téléphone, des allergies). D'où l'**export-snapshot** (§2a) :
  sans lui, en panne, le cabinet n'a *aucune* visibilité sur l'existant.
- À la reprise : ressaisie légère. Souvent **les RDV du jour + 0–N nouveaux patients**.

### 1.2 Fonctionnement prolongé sur papier/Excel (jours)
- **Panne matérielle lourde** (disque mort, PC à remplacer), **sinistre**, ou réseau coupé
  longtemps en mode HYBRID/CLOUD.
- Le cabinet bascule **plusieurs jours** sur un classeur Excel partagé (le « template » du §2a)
  : nouveaux patients, RDV, voire consultations succinctes et encaissements notés à part.
- À la reprise : **import en volume** (dizaines à centaines de lignes), avec un vrai besoin
  de dry-run, de déduplication et de rapport d'erreurs.

### 1.3 Nouveau cabinet pas encore live / migration legacy ou papier
- **Avant la mise en service** : le cabinet a déjà une patientèle dans un vieux logiciel
  (export CSV/Excel possible) ou sur **fiches papier**.
- L'onboarding (ADR-033/034) configure le cabinet ; il manque **le chargement initial de la
  patientèle**. C'est le cas d'usage **à plus fort volume** (le « big bang » d'import) et le
  plus aligné avec la priorité « patients d'abord ».
- Différence clé vs §1.2 : ici il n'y a **pas de snapshot careplus pré-existant** à exporter ;
  on part d'un fichier externe. Le template doit donc être **autosuffisant et documenté**.

> **Implication transverse** : courte panne = ressaisie légère (priorité patients + RDV) ;
> prolongé / migration = import volume (priorité patients, puis RDV, puis consultations,
> puis billing avec ses contraintes légales). La facturation est **toujours** le cas le plus
> délicat (immutabilité légale, cf. §3.4 et §6).

---

## 2. Les deux moitiés de la solution

### 2a. Capture hors-ligne (pendant la panne)

Deux livrables complémentaires :

**(i) Un TEMPLATE Excel/CSV structuré — une feuille par entité.**
Recommandé **fortement** sur le format libre : un classeur libre est *impossible* à importer
de façon fiable (colonnes inconnues, enums en toutes lettres, dates ambiguës). Le template :
- 1 feuille par entité : `Patients`, `RendezVous`, `Allergies`, `Antecedents`,
  `Consultations`, (plus tard `Encaissements`). Voir §4.
- 1 feuille `Instructions` (formats, valeurs autorisées, exemples) — **non importée**.
- 1 feuille `Listes` cachée alimentant les **listes déroulantes Excel (data validation)**
  pour les enums (sexe, sévérité allergie, type RDV…) : réduit drastiquement les erreurs de
  saisie à la source, donc le travail de l'import.
- Distribué **deux fois** : `.xlsx` (saisie confortable, validations) **et** `.csv` par
  feuille (fallback si pas d'Excel, ouvrable dans LibreOffice / Google Sheets / Notepad).

**(ii) Un EXPORT-snapshot de l'existant.**
À froid (proactif), un export programmé/manuel produit un classeur des données courantes —
au minimum **Patients (identité + contacts + allergies)** — pour que, *pendant* la panne, le
cabinet ait une photo récente exploitable hors-ligne. Réutilise **fastexcel** (déjà en place).
- Déclenchement : bouton « Exporter pour mode dégradé » (Paramètres) **et** export inclus
  dans la sauvegarde quotidienne du daemon HYBRID (ADR-006) → un xlsx « patients » à côté du
  dump chiffré, lisible sans careplus.
- **Le template d'import et le format d'export-snapshot doivent partager les mêmes colonnes**
  → l'export d'hier peut être ré-ouvert, complété pendant la panne, et ré-importé tel quel.
  C'est le pivot du design : *export et import sont le même schéma*.

### 2b. Import (à la reprise)

Une fois l'app disponible, l'ADMIN/SUPER_ADMIN ouvre l'écran Import (§7), dépose le classeur
rempli, lance un **dry-run** (validation + diff sans écrire), revoit le rapport
(nouveaux / doublons / erreurs), puis **confirme** pour commiter. Pipeline détaillé §5.
Idempotent (§5), référentiellement sûr (§6), tracé en audit (§6).

---

## 3. Périmètre : entités supportées, par priorité

Ordre = valeur métier × faisabilité. Les noms de champs ci-dessous sont **les colonnes
réelles** des entités (`Patient.java`, `Appointment.java`, `Consultation.java`,
`Invoice.java`, `Allergy.java`, `Antecedent.java`, `VitalSigns.java`).

### 3.1 Patients — PRIORITÉ 1 (et MVP)
Table `patient_patient`. C'est l'entité fondatrice : tout le reste la référence.

| Colonne template | Champ entité | Obligatoire | Notes |
|---|---|---|---|
| `last_name` | `lastName` (VARCHAR 64) | **oui** | clé de dédup |
| `first_name` | `firstName` (VARCHAR 64) | **oui** | clé de dédup |
| `birth_date` | `birthDate` (LocalDate) | recommandé | `YYYY-MM-DD` ; clé de dédup |
| `gender` | `gender` ("M"/"F"/"O") | non | défaut vide |
| `cin` | `cin` (VARCHAR 32, **UNIQUE**) | non | si présent = **clé de dédup la plus forte** |
| `phone` | `phone` | non | format §4 |
| `emergency_phone` | `emergencyPhone` | non | |
| `email` | `email` | non | |
| `address`, `city`, `country` | idem | non | `country` défaut « Maroc » (cf. `prePersist`) |
| `marital_status`, `profession`, `blood_group` | idem | non | |
| `number_children` | `numberChildren` (int) | non | défaut 0 |
| `tier` | `tier` ("NORMAL"/"PREMIUM") | non | défaut NORMAL |
| `mutuelle_name` | → `mutuelleInsuranceId` | non | **résolu** vs `catalog_insurance` (libellé→UUID) ; voir parties dures |
| `mutuelle_policy_number` | `mutuellePoliceNumber` | non | |
| `notes` | `notes` (TEXT) | non | |
| `external_ref` | (colonne d'import, voir §5) | non | id du logiciel legacy → clé de dédup explicite |

**Parties dures**
- `cin` est UNIQUE en base → un doublon CIN dans le fichier OU déjà présent doit être géré
  proprement (skip/update, pas un 500). C'est aussi la **meilleure clé de matching**.
- `gender` stocké en VARCHAR libre ("M"/"F"/"O") : valider et normaliser (« Homme/Femme »,
  « H/F », « Masculin »… → M/F).
- `mutuelle_name` n'est pas un champ direct : il faut **résoudre le libellé** (CNOPS, CNSS,
  RAMED, …) en `mutuelleInsuranceId` via `catalog_insurance`. Libellé inconnu → erreur de
  ligne, pas un crash. (Idem `tier` : valeur hors {NORMAL,PREMIUM} → erreur.)
- `status` (PROSPECT/ACTIF/ARCHIVE/ANONYMISE) **non exposé** à l'import : un patient importé
  est ACTIF par défaut. ANONYMISE ne doit jamais être créé par import.
- Audit : poser `created_by` = utilisateur qui importe (cf. §6).

### 3.2 Rendez-vous / agenda — PRIORITÉ 2
Table `scheduling_appointment`. Dépend de Patient **et** d'un praticien (`User`).

| Colonne template | Champ entité | Obligatoire | Notes |
|---|---|---|---|
| `patient_*` (clé patient) | `patientId` | **oui** | résolu par la même clé que §3.1 (cf. §6 two-pass) |
| `practitioner` | `practitionerId` | **oui** | email ou nom du médecin → UUID `identity_user` |
| `start_at` | `startAt` (TIMESTAMPTZ) | **oui** | `YYYY-MM-DD HH:mm` (heure cabinet, Africa/Casablanca) |
| `end_at` | `endAt` | non | défaut = start + durée du motif |
| `reason_code` | `reasonId` | non | code → UUID `scheduling_appointment_reason` |
| `type` | `type` | non | CONSULTATION/CONTROLE/URGENCE/SUIVI_GROSSESSE, défaut CONSULTATION |
| `status` | `status` | non | défaut PLANIFIE ; valeurs présence (ARRIVE…) **à interdire** à l'import (cf. dur) |
| `walk_in`, `urgency` | idem | non | bool |
| `notes`/`cancel_reason` | `cancelReason` | non | |

**Parties dures**
- **Intégrité référentielle** : un RDV exige un patient existant. Si le même fichier crée le
  patient ET le RDV, il faut un **résolveur two-pass** (§6).
- `practitioner_id` : le fichier humain ne connaît pas les UUID. Mapper **email** (unique) ou
  nom → `identity_user`. Médecin inconnu → erreur de ligne.
- `status` : la machine d'état présence (`AppointmentStatus`: ARRIVE, EN_CONSULTATION,
  FACTURE, CLOS…) ne doit **pas** être réinjectée telle quelle (elle porte des timestamps
  `arrived_at`, `consultation_started_at`… cohérents). À l'import on **n'autorise que**
  PLANIFIE/CONFIRME/ANNULE/NO_SHOW. Les RDV passés notés sur papier → PLANIFIE historique ou
  un flag « rétro ».
- Time zone : convertir l'heure locale cabinet en TIMESTAMPTZ (mémo `feedback_local_date_iso`
  — ne pas utiliser un naïf `toISOString()`).

### 3.3 Consultations — PRIORITÉ 3
Table `clinical_consultation`. Texte libre SOAP. Référence patient **et** médecin.

| Colonne template | Champ entité | Obligatoire | Notes |
|---|---|---|---|
| `patient_*` | `patientId` | **oui** | clé patient (two-pass) |
| `practitioner` | `practitionerId` | **oui** | médecin signataire |
| `started_at` | `startedAt` (TIMESTAMPTZ) | **oui** | date de la consultation |
| `motif` | `motif` (TEXT) | recommandé | |
| `examination` | `examination` (TEXT) | non | |
| `diagnosis` | `diagnosis` (TEXT) | non | |
| `notes` | `notes` (TEXT) | non | |
| (optionnel) constantes | → `clinical_vital_signs` | non | TA, T°, poids, etc. — feuille séparée |

**Parties dures**
- **Signature & immutabilité** : une consultation SIGNEE est immuable (le service l'impose,
  `isSigned()`). Décision recommandée : **importer en BROUILLON**, le médecin relit puis
  signe dans l'app. *Ne pas* importer directement en SIGNEE (on perdrait le contrôle médecin
  + on créerait un acte juridiquement signé sans geste réel). Optionnel : champ
  `import_as_signed` réservé MEDECIN, à débattre (open question §10).
- Lien RDV/facture : à l'import on **délie** (pas d'`appointmentId`/billing auto). Le
  versionnement (`versionNumber`, `parentConsultationId`) n'est pas exposé : import = v1.
- Constantes (`VitalSigns`) : entité append-only riche (systolic/diastolic, temperature_c,
  weight_kg, height_cm, bmi, heart_rate_bpm, spo2_percent, glycemia_g_per_l, …). Si on les
  importe, feuille dédiée liée à la consultation/patient. **Hors MVP** (volume + complexité).

### 3.4 Facturation — PRIORITÉ 4 (la plus délicate, probablement HORS périmètre import)
Table `billing_invoice` (+ `billing_invoice_line`, `billing_payment`, `billing_credit_note`).

> **Alerte légale (CLAUDE.md + ADR-011)** : les factures sont **immuables par la loi
> marocaine** — numérotation **strictement séquentielle, sans trou, sans réémission**
> (`billing_invoice_sequence` + `SELECT FOR UPDATE`, format `YYYY-NNNNNN`), pas de soft
> delete, annulation **uniquement** par avoir (`CreditNote`).

Conséquences pour l'import :
- On **n'importe PAS** de factures émises (numéro déjà attribué) : ré-injecter des numéros
  briserait la séquence légale et l'unicité (`number` UNIQUE). Strictement à proscrire.
- Ce qu'on **peut** envisager (post-MVP, à valider lead) : importer les **encaissements en
  attente** notés pendant la panne sous forme de **brouillons d'invoice** (status BROUILLON,
  `number` NULL) que le caissier émet ensuite dans l'app → la séquence reste pilotée par
  careplus. Jamais d'écriture directe d'un `number`.
- Recommandation MVP : **billing exclu de l'import**. Pendant la panne, encaissements notés
  sur papier puis **re-saisis manuellement** via le workflow facturation normal (qui garantit
  la séquence). Documenté comme limite assumée.

### Récap priorités
1. **Patients** (MVP) — 2. **RDV** — 3. **Consultations (BROUILLON)** — 4. **Billing**
(exclu/po­st-MVP, encaissements en brouillon au mieux). Allergies & antécédents : feuilles
satellites de Patients (importables avec, P1.5).

---

## 4. Conception du template

Principes : **une feuille par entité**, en-tête en ligne 1, valeurs dès la ligne 2.
Colonnes nommées **exactement** comme les clés canoniques (le parser réutilise la
normalisation d'en-tête de `CatalogImportService` : insensible casse/accents + alias FR).

**Formats imposés (feuille `Instructions`)**
- Dates : `YYYY-MM-DD` (ex. `1985-07-03`). Datetime : `YYYY-MM-DD HH:mm` (heure cabinet).
- Téléphone : chaîne, conserver le `0` initial (Excel le mange si numérique → colonne en
  **Texte**). Accepter `06xxxxxxxx`, `+2126xxxxxxxx`, espaces tolérés et normalisés.
- Décimaux (poids, montants) : point décimal `.` ; séparateur de milliers interdit.
- Booléens : `oui/non`, `true/false`, `1/0` (réutilise `parseBool` existant).
- Enums = **valeurs de référence exactes** (listes déroulantes Excel) :
  - `gender` : `M` | `F` | `O`
  - `tier` : `NORMAL` | `PREMIUM`
  - allergie `severity` : `LEGERE` | `MODEREE` | `SEVERE`
  - antécédent `type` : `MEDICAL` | `CHIRURGICAL` | `FAMILIAL` | `GYNECO_OBSTETRIQUE` | `HABITUS`
  - antécédent `category` (optionnel, fin) : 17 valeurs `AntecedentCategory` (PERSONNEL_*, FAMILIAL, MEDICAMENTEUX_*, SOCIAL_*, GYNECO_OBSTETRICAL, PSYCHIATRIQUE)
  - RDV `type` : `CONSULTATION` | `CONTROLE` | `URGENCE` | `SUIVI_GROSSESSE`
  - RDV `status` (import) : `PLANIFIE` | `CONFIRME` | `ANNULE` | `NO_SHOW`
  - `mutuelle_name` : libellés `catalog_insurance` (CNOPS, CNSS, RAMED, …) — liste générée
    dynamiquement à l'export du template depuis la base.
- `external_ref` : identifiant stable du système d'origine (numéro de dossier legacy). Si
  fourni, il **prime** comme clé de dédup → réimports idempotents garantis (§5).

**Exemples d'en-tête (ligne 1) par feuille**

`Patients`
```
external_ref,last_name,first_name,birth_date,gender,cin,phone,emergency_phone,email,address,city,country,marital_status,profession,blood_group,number_children,tier,mutuelle_name,mutuelle_policy_number,notes
```
`Allergies` (satellite Patients — relié par la clé patient)
```
patient_external_ref,patient_last_name,patient_first_name,patient_birth_date,substance,severity,atc_tag,notes
```
`Antecedents`
```
patient_external_ref,patient_last_name,patient_first_name,patient_birth_date,type,category,description,occurred_on
```
`RendezVous`
```
patient_external_ref,patient_last_name,patient_first_name,patient_birth_date,practitioner,start_at,end_at,reason_code,type,status,walk_in,urgency,notes
```
`Consultations`
```
patient_external_ref,patient_last_name,patient_first_name,patient_birth_date,practitioner,started_at,motif,examination,diagnosis,notes
```

**Feuille `Instructions`** (non importée) : 1 tableau par feuille listant
colonne / obligatoire / format / valeurs autorisées / exemple ; un encart « comment remplir
pendant une panne » ; un rappel « dates en YYYY-MM-DD, téléphone en Texte, ne pas renommer
les colonnes ».

---

## 5. Conception du pipeline d'import

`upload → parse → validate (toutes erreurs) → dry-run/diff → commit`. Idempotent.

1. **Upload** : multipart `file`, comme l'existant. Accepte `.xlsx` (multi-feuilles) **ou**
   un `.csv` par entité (réutilise l'auto-détection `,`/`;`). Limite de taille (§8).
2. **Parse** : pour `.xlsx`, lire chaque feuille reconnue (`Patients`, `RendezVous`, …) ;
   ignorer `Instructions`/`Listes`. Normaliser les en-têtes (réutilise
   `CatalogImportService.normalizeHeader`). Construire `List<Map<col,val>>` par entité.
3. **Validate (row-level, collecte EXHAUSTIVE)** : pour chaque ligne, vérifier obligatoires,
   formats (date, tel, décimal), enums, résolution des références (mutuelle, praticien,
   reason). **Ne pas s'arrêter à la 1re erreur** — accumuler `RowError(sheet, line, column,
   code, message)` pour TOUTES les lignes (déjà l'esprit du service catalogue, à généraliser).
4. **Dry-run / preview / diff** : sans rien écrire, classer chaque ligne en
   **NEW** (clé absente en base) / **DUPLICATE** (clé déjà présente → action selon mode) /
   **ERROR** (validation/référence). Retour : compteurs + échantillon + **toutes** les erreurs.
   L'utilisateur voit « X nouveaux, Y existants, Z erreurs » avant tout écrit.
5. **Commit** : ré-exécute la résolution puis écrit. **Two-pass** (patients d'abord, puis
   entités dépendantes) — cf. §6. Renvoie le même `ImportResult` enrichi (added/updated/
   skipped + erreurs).

**Idempotence — clé de dédup (matching) par entité**
- **Patient** : `external_ref` si fourni ; sinon `cin` (UNIQUE) si fourni ; sinon
  `(last_name + first_name + birth_date)` normalisés (casse/accents/espaces). Réimporter le
  même fichier ne doit **rien doubler**.
- **Allergie** : `(patient, substance)` normalisé.
- **Antécédent** : `(patient, type, description, occurred_on)`.
- **RDV** : `(patient, practitioner, start_at)`.
- **Consultation** : `(patient, practitioner, started_at)` (+ `external_ref` si fourni).

**Gestion de conflit (doublon)** — mode choisi à l'upload, défaut prudent :
- `SKIP` (défaut) : doublon ignoré, compté en `skipped`. **Le plus sûr** pour ré-imports.
- `UPDATE` : met à jour les champs fournis (respecte le verrouillage optimiste `version` ;
  ne touche jamais `status`/billing). Utile pour corriger une saisie.
- `ERROR` : tout doublon est signalé, rien n'est écrit (import « strictement nouveau »).

> L'`external_ref` est le levier d'idempotence le plus robuste pour les migrations legacy :
> on stocke la correspondance `external_ref → patientId` (colonne d'import dédiée ou table
> `dataio_import_xref`) pour que les ré-imports et les feuilles satellites résolvent sans
> ambiguïté. À trancher avec le lead (§10).

---

## 6. Intégrité des données

- **Intégrité référentielle (ordre d'import)** : importer dans l'ordre **Patients →
  Allergies/Antécédents → RDV → Consultations**. Dans un même fichier, **résolution
  two-pass** : passe 1 = upsert des patients et construction de l'index
  `clé → patientId` (y compris ceux créés à l'instant) ; passe 2 = entités dépendantes
  résolues contre cet index. Référence introuvable (patient/praticien/mutuelle/reason) →
  **erreur de ligne ciblée**, jamais une contrainte FK qui remonte en 500.
- **Transaction : par fichier vs par ligne**. Recommandation : **une transaction par
  fichier** pour le commit (atomique : tout ou rien sur les lignes valides), précédée du
  dry-run qui a déjà écarté les lignes en erreur. Le dry-run garantit qu'un commit ne
  contient que des lignes saines → pas de rollback massif surprise. Si le lead préfère la
  tolérance maximale (« importe ce qui passe »), basculer en **savepoint par ligne**
  (commit les bonnes, skippe les mauvaises) — c'est l'option du service catalogue actuel.
  À trancher (§10). *Par défaut : transaction/fichier, parce que le dry-run a déjà filtré.*
- **Audit (qui a importé quoi)** : chaque ligne écrite porte `created_by` = utilisateur
  courant. En plus, journaliser l'opération dans `identity_audit_log` (méthode `@Auditable`,
  ADR Audit) **et/ou** une table `dataio_import_run` (id, user, fichier, hash, counts,
  horodatage) pour tracer le « run » complet et permettre un futur undo/reconciliation.
- **Échec partiel** : couvert par dry-run (filtre amont) + transaction/fichier (atomicité
  aval). L'utilisateur reçoit toujours le rapport d'erreurs téléchargeable (§7).
- **Immutabilité légale des factures** (rappel §3.4) : **aucune** écriture directe dans
  `billing_invoice` avec un `number` ; pas de bypass de `billing_invoice_sequence`. Le module
  d'import **ne doit pas dépendre** du repository billing (règle « pas de cross-module
  repository », ARCHITECTURE.md) — s'il faut un jour créer des brouillons d'encaissement, ça
  passe par l'interface publique `BillingService`, pas par un INSERT.

---

## 7. UI/UX (esquisse)

- **Emplacement** : **Paramètres → onglet « Import / Mode dégradé »** (cohérent avec l'import
  catalogue déjà dans Paramètres). Deux blocs : *Exporter pour mode dégradé* (télécharge le
  snapshot + le template vierge) et *Importer des données*.
- **Restriction de rôle** : **ADMIN / SUPER_ADMIN uniquement** (donnée transverse sensible).
  On peut suivre le précédent catalogue `hasAnyRole('ADMIN','MEDECIN')` + permission dédiée
  (ex. `DATA_IMPORT`, miroir de `CATALOG_IMPORT` V018) — à arbitrer ; *recommandé : ADMIN/
  SUPER_ADMIN*, plus restrictif que le catalogue car ça touche patients/RDV.
- **Flux dry-run → confirm** :
  1. Télécharger le template (xlsx + csv) et/ou le snapshot.
  2. Déposer le classeur rempli + choisir le **mode conflit** (SKIP/UPDATE/ERROR).
  3. « Vérifier » → écran de **prévisualisation** : compteurs **NEW / DUPLICATE / ERROR** par
     feuille, table d'aperçu des premières lignes, et **liste des erreurs** (feuille, ligne,
     colonne, message).
  4. Si erreurs → **bouton « Télécharger le rapport d'erreurs »** (csv/xlsx : la ligne fautive
     + colonne + message, pour corriger dans Excel et relancer).
  5. « Importer » (actif seulement si dry-run OK ou mode SKIP) → exécution → résumé final
     (added/updated/skipped) + toast.
- **Mobile/desktop** : l'écran est admin, principalement desktop ; prévoir un rendu mobile
  lisible (mémo `feedback_qa_mobile_parity`) même si l'usage réel est poste fixe.
- **i18n** : libellés via `lib/i18n` (ADR-043) — FR/EN/AR/ES.

---

## 8. Esquisse backend

- **Module** : nouveau `ma.careplus.dataio` (`application` + `infrastructure.web`) — ou, en
  MVP minimal, étendre `patient`. Pattern services à la `CatalogImportService` (JdbcTemplate
  pour l'upsert idempotent + ON CONFLICT, comme l'existant).
- **Endpoints** (miroir du flux UI ; multipart `file`) :
  - `GET  /api/dataio/template` → télécharge le template xlsx (+ option `?format=csv&sheet=patients`).
  - `GET  /api/dataio/export/patients` → snapshot xlsx (fastexcel, réutilise le style exporter).
  - `POST /api/dataio/import/dry-run` (params: `mode=SKIP|UPDATE|ERROR`) → `ImportPreview`
    (counts NEW/DUPLICATE/ERROR + erreurs), **n'écrit rien**.
  - `POST /api/dataio/import/commit` (même body + `mode`) → `ImportResult`.
  - `GET  /api/dataio/import/{runId}/errors` → rapport d'erreurs téléchargeable (csv/xlsx).
  - RBAC `@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")`.
- **Où vit le parsing** : couche `application` (services), comme `CatalogImportService`.
  Réutiliser `normalizeHeader` / `parseBool` / la collecte d'erreurs (extraire en util
  partagé `shared` plutôt que dupliquer).
- **Taille de fichier** : garder la limite existante **5 Mo** (cohérence avec catalogue ; un
  classeur de plusieurs milliers de patients tient largement) ; valider `multipart.max-file-size`
  côté Spring. Rejet propre `IMPORT_FILE_TOO_LARGE` (déjà codifié).
- **Migration** : prochaine = **V073** (dernière appliquée = V072). Au besoin : colonne(s)
  `external_ref` (ex. `patient_patient.external_ref` nullable + index unique partiel) et/ou
  table `dataio_import_run` (+ `dataio_import_xref`). Additif, pas de backfill. **Ne jamais
  éditer une migration appliquée** (CLAUDE.md règle 7).

### Librairie de parsing xlsx — à défendre par un ADR (CLAUDE.md règle 9)
ADR-009 a **délibérément** exclu Apache POI (poids fat-jar) et l'import catalogue est resté
CSV-only. Pour lire un **xlsx multi-feuilles** côté import, options :

1. **`fastexcel-reader` (org.dhatim)** — *recommandé*. Compagnon lecture de la lib d'export
   **déjà au pom** (ADR-025, `XlsxInvoiceExporter`) ; ~léger ; API streaming feuille/ligne ;
   couvre exactement « lire des cellules typées sur N feuilles ». Cohérence totale : on écrit
   et on lit le xlsx avec la **même famille de lib**. Actuellement en scope `test` → il faudra
   le promouvoir en `runtime`/`compile` (1 ligne pom, à acter dans l'ADR).
2. **Apache POI (poi-ooxml) 5.x** — standard, le plus complet (styles riches, formules), mais
   **~15 Mo** de jars (ADR-009/025 l'ont écarté pour le fat-jar on-prem). Justifié seulement
   si on a besoin de fonctionnalités xlsx avancées qu'on n'a pas ici.
3. **CSV-only (zéro lib)** — réutilise tel quel le parser maison ; le « template » devient N
   fichiers CSV (un par entité). Aucune dépendance, mais UX dégradée (pas de feuilles, pas de
   listes déroulantes/validation Excel) et incohérent avec un export xlsx.

**Recommandation : `fastexcel-reader`** (même famille que l'export déjà en prod, footprint
mini, couvre le besoin), avec **fallback CSV gratuit** via le parser existant pour qui n'a pas
Excel. → **propose ADR-045** « parser xlsx en lecture = fastexcel-reader (vs Apache POI vs
CSV-only), cohérent ADR-025 ». (Prochain numéro libre : la dernière entrée est ADR-044.)

---

## 9. Phasage

- **MVP (plus petite tranche utile)** : **Patients seulement** — export-snapshot + template +
  import dry-run/commit idempotent (clé `external_ref` > `cin` > `nom+prénom+naissance`,
  modes SKIP/UPDATE). Couvre le cas le plus douloureux (panne longue & **nouveau cabinet /
  migration**) avec une seule entité et zéro contrainte légale. Allergies/antécédents en
  satellite immédiat si le coût est marginal (P1.5).
- **Lot 2** : **RendezVous** (résolveur praticien + two-pass patient, statuts d'import
  restreints). Débloque la « courte panne » (re-saisie de l'agenda du jour).
- **Lot 3** : **Consultations en BROUILLON** (relecture/signature dans l'app) ; constantes en
  option.
- **Hors périmètre / à débattre** : **Billing** (immutabilité légale) — au mieux des
  brouillons d'encaissement via `BillingService`, jamais d'écriture de `number`.

**Recommandation** : livrer d'abord **Patients (export + import)** — utile seul, sans risque
légal, et il pose toute la tuyauterie (template, dry-run, dédup, audit, two-pass index) que
les lots suivants réutilisent.

---

## 10. Questions ouvertes pour le lead

1. **Granularité du périmètre import** : valide-t-on bien **Billing exclu** en v1 (re-saisie
   manuelle des encaissements via le workflow facture) ? Ou faut-il dès maintenant les
   **brouillons d'encaissement** via `BillingService` ?
2. **Consultations** : import en **BROUILLON only** (recommandé) ? Ou un champ
   `import_as_signed` réservé MEDECIN pour les cabinets qui veulent figer l'historique papier
   directement signé (et assument la responsabilité juridique) ?
3. **Clé de dédup canonique** : impose-t-on une colonne **`external_ref`** (et donc une
   migration `patient_patient.external_ref` + table xref) comme clé primaire d'idempotence,
   ou se contente-t-on de `cin` / `nom+prénom+naissance` ? (Impacte la robustesse des
   ré-imports et des migrations legacy.)
4. **Stratégie transactionnelle** : **transaction par fichier** (atomique, recommandé car le
   dry-run filtre amont) ou **savepoint par ligne** (tolérant, comme le service catalogue
   actuel) ?
5. **RBAC** : **ADMIN/SUPER_ADMIN only** (recommandé pour patients/RDV) ou aligné sur le
   catalogue **ADMIN/MEDECIN** + permission `DATA_IMPORT` ?
6. **Parser xlsx** : on acte **`fastexcel-reader`** (cohérent ADR-025, promu de `test` à
   `runtime`) via un **ADR-045** ? Ou on reste **CSV-only** pour zéro dépendance et on assume
   l'UX dégradée (pas de feuilles/validations Excel) ?
7. **Mutuelle / praticien introuvable** : libellé mutuelle inconnu ou médecin inconnu →
   **erreur de ligne** (recommandé) ou **création à la volée** du référentiel manquant ?
8. **Snapshot automatique** : l'export xlsx « patients » doit-il être **inclus dans la
   sauvegarde quotidienne** du daemon HYBRID (ADR-006) pour être disponible hors-ligne sans
   action, ou rester un export **manuel** depuis Paramètres ?
9. **Module** : nouveau module **`ma.careplus.dataio`** (export + import génériques,
   réutilisable) ou extension pragmatique du module `patient` pour le MVP, quitte à extraire
   ensuite ?
