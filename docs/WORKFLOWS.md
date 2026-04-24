# Business workflows

Canonical spec for what the product does. The backend must make every workflow below executable via API; the frontend (future) implements the UI.

## Actors & roles

| Role | Code | Primary responsibility |
|---|---|---|
| Secrétaire | `SECRETAIRE` | RDV, accueil, facturation, caisse |
| Assistante médicale | `ASSISTANT` | Constantes, file d'attente |
| Médecin | `MEDECIN` | Consultation, prescription, contrôle |
| Administrateur | `ADMIN` | Paramétrage, utilisateurs, backup |

Roles are cumulative on a single user (solo cabinet v1: admin = médecin).

## State machines

### Appointment

```
Planifié → Confirmé → Arrivé → EnAttenteConstantes → ConstantesPrises
       → EnConsultation → ConsultationTerminée → Facturé → Clos

Branches:
  Planifié → Annulé
  Planifié → Reporté → Planifié
  Planifié → NoShow (auto at end of day)
  (none) → Arrivé  (walk-in)
```

### Consultation

```
Brouillon → Signée → Amendée (v2, v3... chain)

Signée is immutable. Correction requires new amendment version.
```

### Invoice

```
Brouillon → Émise → PayéePartielle → PayéeTotale → Clos
                 → Annulée (via CreditNote)

Number sequence: YYYY-NNNNNN, strictly monotonic, no gap allowed.
```

### Pregnancy (post-MVP)

```
Déclarée → SuiviT1 → SuiviT2 → SuiviT3 → Accouchement → Clôturée
Branches: FausseCouche, IVG, Transférée
```

## The workflows (end-to-end)

### WF1 — Phone booking

1. S opens global search (name/phone/CIN)
2. If patient found → select; else quick create (3 fields)
3. Choose reason → duration auto-calculated
4. Availability engine proposes compatible free slots
5. S picks slot → `Planifié` + SMS confirmation (MVP: log only)
6. Cron J-1 18h sends reminder (post-MVP)

Rules: no double-booking (except reason=Urgence), 5-min buffer (configurable), respects working hours, respects holidays.

### WF2 — Check-in & queue

1. Patient arrives → S marks `Arrivé` (timestamp)
2. Walk-in: S creates appointment + check-in atomically
3. Queue SSE pushes update to Assistant (post-MVP — MVP uses polling)
4. Priority override by Assistant or Médecin (urgence, grossesse, etc.)

### WF3 — Vitals intake & consultation start

Vitals can be recorded by **any** of SECRETAIRE / ASSISTANT / MEDECIN — whichever makes sense for the cabinet setup (dedicated assistant, polyvalent secretary, or doctor taking them himself at consultation start).

A habilitated SECRETAIRE or ASSISTANT (flag `canStartConsultation` on user) may also **start** the consultation by capturing vitals; this transitions the appointment to `EnConsultation` with a `Brouillon` consultation owned by the médecin assigned. Signature remains médecin-exclusive.

1. Operator (S/A/M) picks next `Arrivé` → moves to `EnAttenteConstantes`
2. Opens vitals form: TA, température, poids, taille (BMI auto), FC, SpO2, glycémie capillaire
3. Previous vitals visible as graph (post-MVP)
4. Out-of-range flags (post-MVP)
5. Validate → `ConstantesPrises` → visible to Médecin
6. If M takes vitals himself at consultation start, step 1 can be skipped: `Arrivé` → direct `EnConsultation` with vitals captured inline in the consultation screen.
7. If a habilitated S/A starts the consultation, the appointment is moved to `EnConsultation` and a `Brouillon` consultation is created; the médecin then takes over for motif / diagnostic / prescription / signature.

### WF4 — Consultation (core)

1. M picks next `ConstantesPrises` patient → `EnConsultation` (timestamp start). If a habilitated S/A already started the consultation during vitals (WF3 step 7), M opens the existing `Brouillon`.
2. Single rich screen with permanent banner: **allergies + chronic treatments + patient notes + mutuelle + premium flag**
3. Timeline of past consultations/prescriptions/labs (left)
4. Today's vitals + history graph (right)
5. M writes: motif, examen clinique, diagnostic, notes
6. M prescribes: médicaments / analyses / radios / certificat / arrêt travail
7. Allergy cross-check: blocking alert requires explicit override (audit-logged)
8. M plans follow-up (optional) → pre-books a **contrôle** appointment directly from the consultation screen. The new appointment is typed `CONTROLE`, linked to the current consultation (`origin_consultation_id`), and pre-filled with the same patient + reason "Contrôle suite consultation". Slot selection uses the same availability engine as Prise de RDV. The booked slot appears immediately in the agenda.
9. **Before closing, M may adjust the invoice total** (line amounts, discount, supplements) — the editable draft reflects the live total. Patient premium discount (if any) pre-applied; mutuelle information surfaced for tiers-payant downstream (post-MVP).
10. M signs → `Signée` (lock)
11. On signature: PDFs generated, invoice draft persisted with the adjusted total, event notifies secretary. M may either issue/pay the invoice himself or leave it to SECRETAIRE / ASSISTANT.

### WF5 — Prescription detail

- Each prescription is typed: `DRUG`, `LAB`, `IMAGING`, `CERT`, `SICK_LEAVE`
- Drugs: structured posology (dose, frequency, duration, route, timing)
- Allergy cross-check at line add → blocking if hit
- Stupéfiant/psychotrope: enforce ordonnance sécurisée format (post-MVP, flag only in MVP)
- Renewal: "refaire dernière ordonnance" copies last drug prescription with today's date

### WF6 — Billing & cash

The invoice can be handled by either **MEDECIN** (himself at consultation close) or **SECRETAIRE / ASSISTANT** (handed off). The médecin's adjusted total from WF4 step 9 is the starting point; S/A may still edit the draft before `Émettre`.

1. S/A/M opens draft invoice (auto-created after consultation signature with médecin-adjusted total)
2. Lines pre-populated with acts from consultation + tariff grid; premium discount (if patient flagged) pre-applied
3. S/A/M adds supplements or applies additional manual adjustments
4. Payment mode chosen (cash / cheque / CB / transfer / tiers payant mutuelle)
5. If mutuelle/AMO: generates feuille de soins PDF (post-MVP — MVP: mutuelle info stored + printed on invoice)
6. Émettre → sequential number atomically assigned → immutable PDF
7. Payment recorded → state transitions (PayéePartielle / PayéeTotale / still Émise)
8. End of day: S closes cash register → rapport Z printable (post-MVP)

Legal (Morocco): mandatory fields on receipt = INPE, CNOM, ICE, RIB, cabinet address. VAT exempt on consultations by default.

### WF7 — Pregnancy follow-up (post-MVP)

Vertical workflow with auto plan generation (7 prenatal visits + 3 ultrasounds + 3 bio panels), pregnancy-specific vitals (fundal height, fetal HR, urine dipstick), pre-eclampsia alerts.

### WF7b — Patient data model (cross-cutting)

Every patient record carries:

- **Identity** (last name, first name, phone, CIN, DOB, sex, address)
- **Tier**: `NORMAL` | `PREMIUM` — premium grants a parameterizable discount (flat % or fixed, defaults in `config_patient_tier`)
- **Mutuelle**: optional insurance selection at registration — `has_mutuelle` (bool) + `insurance_id` (FK to the seeded `insurance` table: AMO CNSS/CNOPS, RMA, Saham, Wafa, AtlantaSanad, mutuelles privées) + `insurance_policy_number` (string, optional)
- **Allergies**: medication / food / other — banner-visible across all workflows
- **Antécédents** (categorized, see taxonomy below) — banner-visible chronic items
- **Patient notes**: free-form remarks the médecin can append at any time to the patient record (distinct from consultation notes — these persist on the patient dossier, not a specific consultation). Each note is timestamped and authored.

#### Antécédents taxonomy (enum `AntecedentCategory`)

| Category | Examples |
|---|---|
| `PERSONNEL_MALADIES_CHRONIQUES` | diabète, HTA, asthme |
| `PERSONNEL_MALADIES_PASSEES` | tuberculose, infection grave |
| `PERSONNEL_CHIRURGIES` | appendicectomie, césarienne |
| `PERSONNEL_HOSPITALISATIONS` | séjours hospitaliers |
| `PERSONNEL_TRAUMATISMES` | fractures, accidents |
| `PERSONNEL_ALLERGIES` | doublon informatif avec l'entité `Allergy` dédiée (source de vérité = `Allergy`) |
| `FAMILIAL` | diabète, cardiopathie, cancer, HTA, maladies génétiques — texte libre + lien de parenté optionnel |
| `MEDICAMENTEUX_EN_COURS` | traitements en cours |
| `MEDICAMENTEUX_PASSES` | médicaments pris dans le passé |
| `MEDICAMENTEUX_AUTOMEDICATION` | OTC / automédication déclarée |
| `SOCIAL_TABAC` | tabac (paquets-année si renseigné) |
| `SOCIAL_ALCOOL` | alcool |
| `SOCIAL_DROGUES` | autres substances |
| `SOCIAL_ACTIVITE_PHYSIQUE` | activité physique |
| `SOCIAL_PROFESSION` | profession / exposition professionnelle |
| `GYNECO_OBSTETRICAL` | grossesses, accouchements, fausses couches, cycle — femme uniquement |
| `PSYCHIATRIQUE` | dépression, anxiété, troubles |

Each `Antecedent` row: `category`, `label` (free text), `details` (free text, optional), `on_set_year` (optional), `active` (bool), `created_by`, `created_at`, `updated_at`.

### WF7c — Tariff parameterization (médecin self-service)

The médecin may at any time configure the tariff grid:

- `Act` catalog: add / rename / deactivate acts (consultation, acupuncture, analyse diabète, piqûre, pansement, ECG, ...)
- `Tariff` per act: base price MAD, applicable to `NORMAL` vs `PREMIUM` tier (separate row), optional effective date range
- Premium discount: either encoded per act via a `PREMIUM` tariff row, or globally via `config_patient_tier.premium_discount_percent` — the per-act row wins when present
- Historical tariffs are kept (not overwritten) so past invoices remain reproducible — new tariff = new row with a new `effective_from`, old row gets `effective_to`

No separate ADMIN step required: the médecin has `MANAGE_TARIFFS` capability. SECRETAIRE / ASSISTANT do not edit tariffs but see them read-only when building invoices.

### WF8 — Parameterization / onboarding

First launch wizard:
1. Cabinet info (name, address, INPE, CNOM, ICE, RIB)
2. Upload logo, stamp, signature images
3. Working hours + holidays (Moroccan pre-loaded)
4. Users + roles
5. Document template choice (defaults: 3 templates)
6. Medication favorites (seed: 20 common, CSV import optional)
7. Acts catalog + tariffs
8. Insurance list (AMO CNSS, AMO CNOPS, RMA, Saham, Wafa, AtlantaSanad)
9. Backup config: master password + S3 bucket (post-MVP)

### WF9 — Backup (post-MVP)

Cron daily 02h → `pg_dump` → AES-256-GCM encryption (key from cabinet master password) → upload to OVH Object Storage Casablanca → integrity check → rotation (30 daily + 12 monthly) → alert on 2 consecutive failures.

## Permission matrix

|  | SECRETAIRE | ASSISTANT | MEDECIN | ADMIN |
|---|:-:|:-:|:-:|:-:|
| Create/edit patient | ✅ | ✅ | ✅ | ✅ |
| View full medical record | ❌ | 🟡 (vitals) | ✅ | ✅ (audit) |
| Archive/anonymize patient | ❌ | ❌ | ✅ | ✅ |
| Create/move/cancel RDV | ✅ | ✅ | ✅ | ✅ |
| Check-in patient | ✅ | ✅ | ✅ | ✅ |
| Reorder queue | ❌ | ✅ | ✅ | ✅ |
| Record vitals | ✅ | ✅ | ✅ | ❌ |
| View vitals history | ✅ | ✅ | ✅ | ✅ |
| Start consultation (draft) | 🟡 (if habilitated) | 🟡 (if habilitated) | ✅ | ❌ |
| Create/sign consultation | ❌ | ❌ | ✅ | ❌ |
| Add patient notes | ❌ | ❌ | ✅ | ❌ |
| View patient notes | ❌ | ❌ | ✅ | ✅ (audit) |
| Edit patient tier (NORMAL/PREMIUM) | ❌ | ❌ | ✅ | ✅ |
| Edit patient mutuelle | ✅ | ✅ | ✅ | ✅ |
| Manage tariffs / acts catalog | ❌ | ❌ | ✅ | ✅ |
| Adjust invoice total before close | ❌ | ❌ | ✅ | ❌ |
| Amend signed consultation | ❌ | ❌ | ✅ (own only) | ❌ |
| Prescribe | ❌ | ❌ | ✅ | ❌ |
| Renew prescription | ❌ | ❌ | ✅ | ❌ |
| Override allergy alert | ❌ | ❌ | ✅ (audited) | ❌ |
| Emit invoice | ✅ | ❌ | ✅ | ✅ |
| Emit credit note | ✅ | ❌ | ✅ | ✅ |
| Close cash register | ✅ | ❌ | ✅ | ✅ |
| View financial reports | ❌ | ❌ | ✅ | ✅ |
| Declare/follow pregnancy | ❌ | ❌ | ✅ | ❌ |
| Parametrage | ❌ | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| Document templates | ❌ | ❌ | ❌ | ✅ |
| Backup/restore | ❌ | ❌ | ❌ | ✅ |
| Audit log | ❌ | ❌ | ❌ | ✅ |

🟡 = partial / conditional:
- Assistant/Secretary may see vitals + allergies (needed for safe intake), not diagnosis.
- Start consultation: S/A allowed only if user flag `canStartConsultation` is true (set by ADMIN in user management). Even when allowed, S/A cannot edit diagnosis / prescribe / sign — they only open the `Brouillon` from vitals; médecin takes over for clinical content.

## MVP vs post-MVP scope

**MVP (< 1 week)** — WF1 lite (no SMS), WF2 (polling not SSE), WF3 (no alerts, no graphs), WF4 (single-version, no amendments), WF5 (no stupéfiant format, allergy check), WF6 (no AMO, no register Z), WF8 (basic config + editable headers).

**Post-MVP** — SSE, SMS, allergy alerts with ranges, amendments, stupéfiant format, AMO feuille de soins, register Z, pregnancy vertical, backup cloud, installer Windows, WYSIWYG template editor, dashboard.
