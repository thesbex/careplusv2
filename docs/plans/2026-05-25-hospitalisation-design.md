# Hospitalisation / Séjour — Conception fonctionnelle (2026-05-25)

> **Statut : proposition.** Document de réflexion fonctionnelle demandé par Y. Boutaleb.
> But : faire de careplus un produit **passe-partout** — même codebase utilisée en
> cabinet GP, en centre médical polyvalent, et en **clinique avec lits où les patients
> sont hospitalisés**. Aucune décision figée ici : ce doc pose le besoin, ce qui se fait
> ailleurs, et des propositions chiffrées. Les **Décisions à valider** sont en fin de doc.

---

## 1. Le besoin en une phrase

Quand un établissement a des lits, il faut pouvoir : **admettre** un patient (lui affecter
une chambre/un lit), **suivre son séjour** (visites, soins, constantes, prescriptions
pendant l'hospitalisation), **le transférer** d'un lit à l'autre, **le faire sortir**, et
**facturer le séjour** comme une prestation à part — avec un **coût journalier** (prix de
journée / forfait) qui s'additionne aux actes réalisés pendant le séjour.

C'est exactement le périmètre que l'industrie appelle **ADT (Admission – Discharge –
Transfer)** côté flux patient, et **IPD (In-Patient Department)** côté module. ([techvariable](https://techvariable.com/blogs/admission-discharge-transfer-in-healthcare/), [Wikipedia ADT](https://en.wikipedia.org/wiki/Admission,_discharge,_and_transfer_system))

---

## 2. Ce qui se fait ailleurs (recherche terrain)

### 2.1 Modules IPD standards du marché (HMS internationaux)

Les HMS (patientERP, eCare-HMS, Med2TEC, Medizen…) découpent tous l'hospitalisation en
quelques briques récurrentes : ([patienterp IPD](https://www.patienterp.com/highlights/ipd-management.html), [eCare-HMS](https://ecarehms.com/inpatient-management/), [okcare modules](https://okcare.in/blogs/hospital-management-system-modules-and-benefits/))

| Brique | Contenu |
|---|---|
| **Admission** | enregistrement, motif d'admission, médecin admetteur, classe de chambre, affectation lit |
| **Bed/Ward management** | référentiel chambres + lits, **statut temps réel** (libre / occupé / réservé / en nettoyage), taux d'occupation |
| **Patient monitoring** | constantes, soins infirmiers, prescriptions, plan de soins pendant le séjour |
| **Transferts** | changement de lit / chambre / service, tracé horodaté |
| **Discharge** | sortie, résumé de sortie (compte-rendu d'hospitalisation), date/heure |
| **Billing** | cumul **forfait journalier (prix de journée)** + actes + médicaments + consommables → **une facture de séjour** |
| **Reporting** | admissions/sorties/jour, durée moyenne de séjour (DMS), taux d'occupation |

Le **Tableau de bord des lits** (statut temps réel : occupé / disponible / réservé / en
nettoyage) revient partout comme l'écran central de l'IPD. ([patienterp ward/bed](https://patienterp.com/highlights/ward-bed-management.html))

### 2.2 Contexte clinique privée Maroc

- Le séjour passe par un **Bureau des Admissions et de Facturation (BAF)** : c'est lui qui
  ouvre le dossier administratif à l'entrée et solde les frais à la sortie (avant remise du
  bulletin de sortie). ([CHU Ibn Rochd](https://chuibnrochd.ma/?page_id=985))
- Les **frais d'hospitalisation** couvrent l'hébergement (lit, chauffage, éclairage, linge,
  repas) **+** les interventions, produits, prothèses, etc. — donc une ligne
  « hébergement / journée » distincte des actes.
- L'AMO (CNOPS/CNSS) rembourse l'hospitalisation sur des **grilles de tarifs forfaitaires**
  (forfait par acte / par journée selon la grille ANAM). ([grille ANAM](https://anam.ma/anam/wp-content/uploads/2021/09/Grille3_2007.pdf))
- Il n'existe **pas** de standard d'échange national (HL7/FHIR) à adresser en 2026 — cohérent
  avec ce qu'on a déjà constaté pour l'import documentaire (QA5-1). Le séjour est donc un
  flux **100 % interne** à l'établissement.

### 2.3 Qui fait l'admission ? (la question explicite du brief)

Dans les ADT, l'enregistrement est fait par du **registration / admission staff** (agent
d'admission), et le **suivi de lit** par le **personnel infirmier / unit manager**. ([Definitive ADT](https://www.definitivehc.com/resources/glossary/admission-discharge-transfer-systems), [talkinghealthtech](https://www.talkinghealthtech.com/glossary/admission-discharge-transfer-adt-systems))

**Faut-il un profil spécial ?** Oui sur le principe, **mais** careplus suit déjà un modèle
**auto-adaptatif solo→clinique** (mémoire `multi_practitioner_direction`, décision
2026-05-07) et le précédent **ADR-013** (les constantes sont saisissables par *n'importe
quel* rôle pertinent selon le staffing du cabinet, sans brancher le code par rôle). On
applique la même philosophie ici (voir §4).

---

## 3. Principe directeur : une capability, pas un fork

careplus = **un seul codebase auto-adaptatif**. On n'introduit pas un « mode clinique ». On
ajoute une **capacité activable**, exactement comme `lab_internal` / `imaging_internal`
l'ont été dans **V034**.

- Nouveau flag `hospitalization_enabled BOOLEAN` sur `configuration_clinic_settings`.
- **Défaut** : `FALSE` si `establishment_type = 'CABINET'`, suggéré `TRUE` (proposé à
  l'onboarding) si `establishment_type ∈ {'CLINIQUE','HOPITAL'}`. `CENTRE_MEDICAL` = au choix.
- Quand `FALSE` : **rien ne change** pour un cabinet GP — aucune entrée de menu, aucun
  écran, aucun rôle supplémentaire. Le module est totalement invisible (même discipline que
  `internal-requests` masqué quand `lab_internal=false`).
- Quand `TRUE` : la sidebar gagne « Hospitalisation », le paramétrage gagne « Chambres &
  lits », l'agenda/dossier patient gagnent les surfaces de séjour.

C'est **ça** qui rend l'app passe-partout : la même installation devient un SIH de petite
clinique en cochant une case, sans dégrader l'expérience du cabinet solo.

---

## 4. Rôles & profil d'admission (proposition)

On distingue **l'acte administratif** (admettre / affecter un lit / facturer le séjour) de
**l'acte clinique** (visite, prescription, sortie médicale).

### Proposition retenue (alignée ADR-013 + modèle auto-adaptatif)

1. **Pas de nouveau rôle obligatoire pour l'admission.** L'admission administrative est
   ouverte au **SECRETAIRE** (qui *est* le bureau des admissions dans une petite clinique)
   **+ MEDECIN + ADMIN**. Dans une grande structure, on crée un utilisateur dédié avec une
   permission atomique.
2. **Nouvelle permission atomique `HOSPITALIZATION_ADMIT`** (admettre / transférer / gérer
   les lits) — par défaut accordée à SECRETAIRE + MEDECIN + ADMIN. Éditable dans la matrice
   de droits (QA3-3) → un établissement qui veut un vrai « agent d'admission » crée un user
   et ne lui coche que cette permission.
3. **Nouveau rôle `INFIRMIER` (personnel soignant / unit manager)** — pertinent dès qu'il y
   a des lits : saisit les constantes et les soins au lit, voit le tableau des lits de son
   service. Calqué sur l'ajout des rôles `RADIO`/`LAB` (services internes, V037). Cumulable
   comme tous les rôles (`identity_user_role` est déjà multi-rôle).
4. **La sortie médicale (compte-rendu d'hospitalisation, décision de sortie) reste
   MEDECIN-only**, comme la signature de consultation.

> **Pourquoi pas un rôle `ADMISSION` dédié ?** Parce qu'imposer un rôle casserait le cabinet
> solo et le centre médical où la secrétaire fait tout. La **permission** atomique donne la
> granularité (grande clinique) sans imposer la lourdeur (petite structure). C'est
> exactement le compromis qu'on a tranché pour le RBAC granulaire (QA3-3).

---

## 5. Modèle de données (proposition)

Module proposé : `ma.careplus.hospitalization` (bounded context, même contrat que les autres).

### 5.1 Référentiel — chambres & lits (paramétrage)

```
hospitalization_ward         (service / unité)
  id, code, label_fr, active, created_at…              ex: "Maternité", "Médecine", "Soins intensifs"

hospitalization_room         (chambre)
  id, ward_id FK, code, label_fr,
  room_class VARCHAR(32),    -- INDIVIDUELLE | DOUBLE | COMMUNE | SUITE (CHECK fermé, 'AUTRE' échappatoire)
  daily_rate_amount NUMERIC, -- prix de journée par défaut de la chambre (MAD)
  active, created_at…

hospitalization_bed          (lit)
  id, room_id FK, code,      -- ex: "Ch.102 - Lit A"
  status VARCHAR(16),        -- LIBRE | OCCUPE | RESERVE | NETTOYAGE | HORS_SERVICE
  active, created_at…
```

> **Statut du lit** : on suit le standard marché (libre / occupé / réservé / nettoyage /
> hors-service). Question ouverte D3 : statut **stocké** sur le lit (rapide mais risque de
> dérive) vs **calculé** à la volée depuis les séjours actifs (toujours cohérent, pattern
> ADR-026/030 lazy). Recommandation : **calculé** pour `OCCUPE/LIBRE`, **stocké** seulement
> pour les états manuels `NETTOYAGE/HORS_SERVICE/RESERVE`.

### 5.2 Le séjour (aggregate central)

```
hospitalization_stay
  id, patient_id FK,
  attending_practitioner_id FK identity_user,  -- médecin responsable
  admitted_by FK identity_user,
  admission_reason TEXT,
  status VARCHAR(24),                          -- voir state machine §6
  admitted_at TIMESTAMPTZ,
  discharged_at TIMESTAMPTZ NULL,
  discharge_summary TEXT NULL,                 -- compte-rendu d'hospitalisation (MEDECIN)
  discharge_type VARCHAR(24) NULL,             -- DOMICILE | TRANSFERT_EXT | CONTRE_AVIS | DECES
  invoice_id FK billing NULL,                  -- facture de séjour (cross-module event)
  version, created_at, updated_at, deleted_at, created_by, updated_by

hospitalization_bed_assignment               -- l'historique ADT des transferts de lit
  id, stay_id FK, bed_id FK,
  daily_rate_amount NUMERIC,                  -- gelé au moment de l'affectation (reproductibilité facture)
  from_at TIMESTAMPTZ, to_at TIMESTAMPTZ NULL, -- to_at NULL = affectation courante
  assigned_by FK, created_at…
```

- Un séjour **1 patient ↔ N affectations de lit** (transferts) — l'historique BAF.
- Le **prix de journée est gelé** sur chaque affectation (même logique que les tarifs
  historisés `effective_from/to`, WF7c) → une facture reste reproductible si on change le
  tarif d'une chambre plus tard.
- Les **constantes, prescriptions, consultations** pendant le séjour réutilisent les modules
  existants : on ajoute simplement un `stay_id` nullable optionnel sur les constantes /
  consultations pour les rattacher au séjour (ou un lien via event, à arbitrer — D4).

### 5.3 Config

```
configuration_clinic_settings
  + hospitalization_enabled BOOLEAN NOT NULL DEFAULT FALSE
  + hospitalization_orphan_visible_roles VARCHAR(32)[]   -- cloisonnement, voir §10
```

---

## 6. State machine du séjour (ADT)

```
                  (admission)
   (néant) ─────────────────────►  ADMIS
                                     │  affectation lit initiale
                                     ▼
                                EN_COURS  ◄──┐
                                  │   │      │ transfert de lit
                                  │   └──────┘ (nouvelle bed_assignment, séjour reste EN_COURS)
        décision de sortie médecin │
                                  ▼
                            SORTIE_PREVUE   (lit passe RESERVE→NETTOYAGE à la sortie effective)
                                  │  passage au BAF / règlement
                                  ▼
                              FACTURE  ──►  CLOS

   Branches :
     ADMIS|EN_COURS ──(annulation admission, jamais entré)──► ANNULE
     EN_COURS ──(discharge_type = TRANSFERT_EXT / CONTRE_AVIS / DECES)──► SORTIE_PREVUE
```

- Calque sur les state machines existantes (Appointment, Invoice, Pregnancy) — même style
  de doc dans `WORKFLOWS.md`.
- Le **séjour reste `EN_COURS`** pendant les transferts de lit (un transfert = nouvelle
  ligne `bed_assignment`, on ferme la précédente `to_at`).

---

## 7. Workflows

### WF-H1 — Admission
1. Bureau des admissions (SECRETAIRE / user avec `HOSPITALIZATION_ADMIT`) ouvre « Nouvelle
   admission », cherche/crée le patient (réutilise la recherche patient existante).
2. Saisit motif, médecin responsable, classe de chambre souhaitée.
3. **Tableau des lits** : choisit un lit `LIBRE` (ou `RESERVE` pour ce patient) → crée le
   séjour `ADMIS` + 1ʳᵉ `bed_assignment` → lit `OCCUPE`.
4. (option) bracelet / fiche d'admission PDF.

### WF-H2 — Suivi de séjour
- Le patient hospitalisé apparaît dans une **worklist « Patients hospitalisés »** (polling,
  même pattern que la queue salle / vaccination / grossesse).
- L'**INFIRMIER** saisit constantes + soins au lit (réutilise l'écran constantes existant).
- Le **MEDECIN** fait ses visites : il peut ouvrir une consultation rattachée au séjour,
  prescrire (médicaments / analyses / imagerie — routables en interne via V037 si
  `lab_internal`/`imaging_internal`).

### WF-H3 — Transfert
- Transférer le patient vers un autre lit/chambre/service → ferme `bed_assignment` courante
  (`to_at = now`), ouvre une nouvelle, l'ancien lit passe `NETTOYAGE`, le nouveau `OCCUPE`.

### WF-H4 — Sortie
1. Le MEDECIN décide la sortie, rédige le **compte-rendu d'hospitalisation**
   (`discharge_summary`, MEDECIN-only) et choisit `discharge_type`.
2. Séjour → `SORTIE_PREVUE`. Lit → `NETTOYAGE` puis `LIBRE`.
3. Le BAF déclenche la **facture de séjour** (§8). Séjour → `FACTURE` → `CLOS`.

---

## 8. Facturation du séjour — « prestation à part »

C'est le point le plus sensible (et la demande explicite : *coût quotidien*).

### Composition de la facture de séjour
```
Facture séjour #YYYY-NNNNNN
  ├─ Hébergement : N journées × prix de journée (par affectation de lit)   ← la prestation "à part"
  │     ex: 3 j × 400 MAD (Ch. individuelle) + 1 j × 250 MAD (après transfert chambre double)
  ├─ Actes réalisés pendant le séjour (consultations, ECG, pansements…)    ← catalog_act existant
  ├─ Médicaments / consommables (module Stock, si décrémentés au lit)
  └─ Total → remise tier PREMIUM / mutuelle (réutilise WF6)
```

### Calcul des journées (D2 — à valider)
Règle marché Maroc fréquente : **on compte les nuits**, ou **(date_sortie − date_admission)
arrondi au jour entamé**. Les cliniques facturent souvent **le jour d'entrée ET le jour de
sortie** (d'où les litiges de surfacturation relevés par la presse). **Recommandation** :
règle paramétrable `stay_billing_day_rule` (NUITS | JOURS_ENTAMES) avec défaut NUITS, et
affichage transparent du détail jour par jour sur la facture.

### Comment ça se branche sur le billing existant
- On **réutilise le module `billing`** (numérotation séquentielle légale ADR-011,
  états facture, PDF, paiements, caisse). Pas de nouveau moteur de facture.
- Le « prix de journée » devient un **acte spécial** du `catalog_act`
  (`code = HEBERGEMENT_*` par classe de chambre) **OU** une ligne de facture générée par le
  module hospitalisation à l'émission. **Recommandation** : ligne générée par
  l'hospitalisation à partir des `bed_assignment` (le tarif est porté par la chambre, pas
  par le catalogue d'actes) — l'hébergement n'est pas un « acte médical » mais un forfait
  d'occupation. Émission via **event** `StayReadyForBillingEvent` → `billing` crée le
  brouillon (pattern `@TransactionalEventListener` AFTER_COMMIT déjà en place).

---

## 9. Paramétrage (onglet « Chambres & lits »)

Visible dans `/parametres` seulement si `hospitalization_enabled = true`. CRUD complet
(MEDECIN/ADMIN) calqué sur le CRUD catalogue existant :

- **Services / unités** (ward) : ajouter / renommer / désactiver.
- **Chambres** : code, libellé, service, classe, **prix de journée**, nb de lits.
- **Lits** : générés ou ajoutés à la main sous une chambre ; statut manuel
  (`NETTOYAGE`/`HORS_SERVICE`) togglable.
- Règle de comptage des journées (`stay_billing_day_rule`).

Onboarding : si l'admin choisit `CLINIQUE`/`HOPITAL` à l'étape 1, on propose une étape
optionnelle « Vos chambres » (seed minimal : 1 service, 2 chambres).

---

## 10. Impact sur les modules existants

| Module | Impact |
|---|---|
| **configuration** | +2 colonnes (`hospitalization_enabled`, `hospitalization_orphan_visible_roles`) ; onglet paramétrage ; option onboarding |
| **identity** | nouveau rôle `INFIRMIER` ; nouvelle permission `HOSPITALIZATION_ADMIT` (matrice QA3-3) |
| **clinical** | `stay_id` nullable optionnel sur constantes/consultation pour rattacher au séjour ; rien ne change hors séjour |
| **billing** | consomme `StayReadyForBillingEvent` → brouillon facture séjour ; aucune modif du moteur de numérotation |
| **catalog** | option : actes `HEBERGEMENT_*` ; sinon ligne générée |
| **patient** | badge « Hospitalisé » sur le dossier (jointure simple, comme le badge grossesse) ; onglet/section « Séjours » |
| **shell/nav** | entrée sidebar « Hospitalisation » + menu Plus mobile (mémoire `new_module_navigation`) — gated par le flag |
| **cloisonnement** | la worklist hospitalisés réutilise `<OrphanRolesPanel module="hospitalization" />` + colonne `hospitalization_orphan_visible_roles` (squelette figé ADR-032) si multi-praticien strict |

---

## 11. Ajouts à la matrice de permissions

| | SECRETAIRE | ASSISTANT | INFIRMIER | MEDECIN | ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|
| Admettre / affecter lit / transférer (`HOSPITALIZATION_ADMIT`) | ✅ | ❌ | 🟡 | ✅ | ✅ |
| Voir tableau des lits | ✅ | ✅ | ✅ | ✅ | ✅ |
| Constantes / soins au lit | ✅ | ✅ | ✅ | ✅ | ❌ |
| Visite / prescription pendant séjour | ❌ | ❌ | ❌ | ✅ | ❌ |
| Compte-rendu de sortie / décision de sortie | ❌ | ❌ | ❌ | ✅ | ❌ |
| Gérer chambres/lits (paramétrage) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Facturer le séjour (émettre) | ✅ | ❌ | ❌ | ✅ | ✅ |

(🟡 = éditable selon staffing via la matrice de droits.)

---

## 12. Découpage proposé (slices) & estimation indicative

| Slice | Contenu | Effort |
|---|---|---|
| **A — Paramétrage lits** | migration (`ward/room/bed` + flag + rôle/perm) + CRUD chambres/lits + onglet param + tableau des lits read-only | ~2 j |
| **B — Admission + séjour** | aggregate `stay` + `bed_assignment`, WF-H1/H3 (admettre, affecter, transférer), worklist hospitalisés, badge dossier | ~3 j |
| **C — Suivi clinique** | rattachement constantes/consultation/prescription au séjour (INFIRMIER + MEDECIN) | ~2 j |
| **D — Sortie + facturation** | WF-H4, compte-rendu PDF, `StayReadyForBillingEvent` → facture séjour (journées + actes) | ~2-3 j |
| **E — Cloisonnement (si besoin)** | `OrphanRolesPanel` + colonne orphan, calque ADR-032 | ~0,5 j |

Chaque slice = backend + frontend desktop **et** mobile 390 px (mémoire
`feedback_qa_mobile_parity`) + IT siblings + QA IHM Playwright avant commit. Livraison
**parallel-sync** (ADR-021).

---

## 13. Décisions à valider (avant code)

- **D1 — Rôles** : OK pour `INFIRMIER` (rôle) + `HOSPITALIZATION_ADMIT` (permission ouverte
  à la secrétaire), plutôt qu'un rôle `ADMISSION` imposé ? *(reco : oui)*
- **D2 — Comptage des journées** : NUITS vs JOURS_ENTAMES, paramétrable ? *(reco : NUITS par
  défaut + détail transparent)*
- **D3 — Statut des lits** : calculé à la volée (occupé/libre) + stocké pour états manuels ?
  *(reco : oui, hybride)*
- **D4 — Rattachement clinique** : `stay_id` nullable sur constantes/consultation, ou lien
  par event ? *(reco : colonne nullable directe, plus simple à requêter)*
- **D5 — Hébergement** : ligne générée par l'hospitalisation (reco) vs acte `HEBERGEMENT_*`
  dans le catalogue ?
- **D6 — Périmètre v1** : inclut-on le **plan de soins infirmiers** structuré et la gestion
  des **repas/régimes** dès v1, ou post-pilote ? *(reco : post-pilote, comme on a découplé
  vaccination/grossesse au départ)*
- **D7 — Multi-fœtus du séjour** (jumeaux mère + nouveau-nés) : un séjour mère + fiches
  enfants liées (réutilise le lien grossesse→enfant ADR-031) ? *(reco : post-v1)*

---

## 14. Sources

- [Admission Discharge Transfer (ADT) in Healthcare — TechVariable](https://techvariable.com/blogs/admission-discharge-transfer-in-healthcare/)
- [ADT system — Wikipedia](https://en.wikipedia.org/wiki/Admission,_discharge,_and_transfer_system)
- [ADT Systems — Definitive Healthcare](https://www.definitivehc.com/resources/glossary/admission-discharge-transfer-systems)
- [ADT systems — TalkingHealthTech](https://www.talkinghealthtech.com/glossary/admission-discharge-transfer-adt-systems)
- [Inpatient (IPD) Management — patientERP](https://www.patienterp.com/highlights/ipd-management.html)
- [Ward & Bed Management — patientERP](https://patienterp.com/highlights/ward-bed-management.html)
- [Inpatient Management — eCare-HMS](https://ecarehms.com/inpatient-management/)
- [11 Key Modules of an HMS — okcare](https://okcare.in/blogs/hospital-management-system-modules-and-benefits/)
- [Hospitalisation (Admission/Séjour/Sortie) — CHU Ibn Rochd](https://chuibnrochd.ma/?page_id=985)
- [Grille de tarifs forfaitaires des actes — ANAM](https://anam.ma/anam/wp-content/uploads/2021/09/Grille3_2007.pdf)
