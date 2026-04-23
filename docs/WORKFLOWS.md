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

### WF3 — Vitals intake

Vitals can be recorded by **any** of SECRETAIRE / ASSISTANT / MEDECIN — whichever makes sense for the cabinet setup (dedicated assistant, polyvalent secretary, or doctor taking them himself at consultation start).

1. Operator (S/A/M) picks next `Arrivé` → moves to `EnAttenteConstantes`
2. Opens vitals form: TA, température, poids, taille (BMI auto), FC, SpO2, glycémie capillaire
3. Previous vitals visible as graph (post-MVP)
4. Out-of-range flags (post-MVP)
5. Validate → `ConstantesPrises` → visible to Médecin
6. If M takes vitals himself at consultation start, step 1 can be skipped: `Arrivé` → direct `EnConsultation` with vitals captured inline in the consultation screen.

### WF4 — Consultation (core)

1. M picks next `ConstantesPrises` patient → `EnConsultation` (timestamp start)
2. Single rich screen with permanent banner: **allergies + chronic treatments**
3. Timeline of past consultations/prescriptions/labs (left)
4. Today's vitals + history graph (right)
5. M writes: motif, examen clinique, diagnostic, notes
6. M prescribes: médicaments / analyses / radios / certificat / arrêt travail
7. Allergy cross-check: blocking alert requires explicit override (audit-logged)
8. M plans follow-up (optional) → pre-books compatible slot
9. M signs → `Signée` (lock)
10. On signature: PDFs generated, invoice draft created, event notifies secretary

### WF5 — Prescription detail

- Each prescription is typed: `DRUG`, `LAB`, `IMAGING`, `CERT`, `SICK_LEAVE`
- Drugs: structured posology (dose, frequency, duration, route, timing)
- Allergy cross-check at line add → blocking if hit
- Stupéfiant/psychotrope: enforce ordonnance sécurisée format (post-MVP, flag only in MVP)
- Renewal: "refaire dernière ordonnance" copies last drug prescription with today's date

### WF6 — Billing & cash

1. S opens draft invoice (auto-created after consultation signature)
2. Lines pre-populated with acts from consultation
3. S adds supplements if any
4. S picks payment mode (cash / cheque / CB / transfer / tiers payant AMO)
5. If AMO: generates feuille de soins PDF (post-MVP — MVP: skipped)
6. S clicks Émettre → sequential number atomically assigned → immutable PDF
7. Payment recorded → state transitions (PayéePartielle / PayéeTotale / still Émise)
8. End of day: S closes cash register → rapport Z printable (post-MVP)

Legal (Morocco): mandatory fields on receipt = INPE, CNOM, ICE, RIB, cabinet address. VAT exempt on consultations by default.

### WF7 — Pregnancy follow-up (post-MVP)

Vertical workflow with auto plan generation (7 prenatal visits + 3 ultrasounds + 3 bio panels), pregnancy-specific vitals (fundal height, fetal HR, urine dipstick), pre-eclampsia alerts.

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
| Create/sign consultation | ❌ | ❌ | ✅ | ❌ |
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

🟡 = partial read: Assistant sees vitals + allergies (needed for safe intake), not diagnosis.

## MVP vs post-MVP scope

**MVP (< 1 week)** — WF1 lite (no SMS), WF2 (polling not SSE), WF3 (no alerts, no graphs), WF4 (single-version, no amendments), WF5 (no stupéfiant format, allergy check), WF6 (no AMO, no register Z), WF8 (basic config + editable headers).

**Post-MVP** — SSE, SMS, allergy alerts with ranges, amendments, stupéfiant format, AMO feuille de soins, register Z, pregnancy vertical, backup cloud, installer Windows, WYSIWYG template editor, dashboard.
