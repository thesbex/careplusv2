# MVP Wiring Plan

Tracking doc for the 8-step plan to bring careplus from "backend complete + screens partially wired" to **v0.1.0-mvp** (full-stack demoable bout-en-bout).

Read this first when resuming work. It is the source of truth for what is done, what is in flight, what is next. **Update the status table after each step.**

## Status table

| # | Étape | Status | Commit | Notes |
|---|---|---|---|---|
| 1 | Consultation + Salle + Constantes wired | ✅ DONE | `45eedac` | SOAP form RHF + autosave + sign + check-in CTAs + real patient header |
| 1.5 | Consultation list + dossier "Nouvelle consultation" | ✅ DONE | `0dce51d` | New `GET /api/consultations` endpoint; `/consultations` shows list; dossier button wired |
| 2 | Prescription drawer + ordonnance PDF | ✅ DONE | `2bd795d` | `features/prescription/` slice; medication search; allergy override flow; iframe PDF preview |
| 3 | Facturation list + drawer + aperçu | ✅ DONE | _next push_ | Liste filtrable + KPI cards, drawer (édit/issue/pay/credit-note), A4 print preview, "Ajuster total" wired in Consultation |
| 4 | Dossier patient — onglets prescr / factu | ⏳ NEXT | — | Réutilise hooks Étape 2/3 ; onglet "Consults" déjà câblé en `0dce51d` |
| 5 | Agenda interactions (clic RDV → drawer modifier/annuler) | ⏳ | — | + drag-to-move optimistic |
| 6 | Paramétrage + Onboarding | ⏳ | — | **Bloqué backend** : créer `SettingsController` + `GET/PUT /api/settings/clinic` |
| 7 | Queue enrichi (`age`, `reasonLabel`, `practitionerName`) | ⏳ | — | Cosmétique, retire les placeholders `0 ans` / `—` |
| 8 | Playwright E2E + Postman + tag `v0.1.0-mvp` | ⏳ | — | 3 specs : RDV, consultation+sign+PDF, invoice |

## How to resume

When picking up work in a future session:

1. Read this file first.
2. Find the first row with status `⏳ NEXT` or `⏳`.
3. Read the matching detail section below.
4. Run `regression-guard` to confirm baseline is green before starting.
5. Implement, then update the status row's `Status` + `Commit` columns.

## Étape detail

### Étape 1 — DONE
Refactor `ConsultationPage` (desktop + mobile) to be fully dynamic: RHF + zod, autosave debounced 2s on `PUT /consultations/:id`, signature flow wired to `POST /consultations/:id/sign`. Salle d'attente CTAs (`Prendre constantes`, `Envoyer en consult`, `Marquer arrivé`) dispatch real mutations. Prise des constantes header now shows real patient data via `useAppointment` + `usePatient`.

### Étape 1.5 — DONE
Hotfix wave following user feedback: list page at `/consultations`, "Nouvelle consultation" button on patient file, dossier "Consults" tab now shows real data. Backend gained `GET /api/consultations` endpoint with optional filters.

### Étape 2 — DONE
New `frontend/src/features/prescription/` slice. Hooks: `useMedicationSearch` (debounced autocomplete on `/catalog/medications`), `useCreatePrescription` (handles 422 `AllergyConflict` with override flow), `usePrescriptions` / `usePrescription`, `usePrescriptionPdf` (arraybuffer → blob URL). Pages: `PrescriptionDrawer` (Radix Dialog right-anchored) + `OrdonnancePdfPage` (route `/prescriptions/:id`, iframe preview, télécharger + imprimer). Consultation page action buttons (Prescription / Bon analyses / Bon imagerie) and mobile Rx button now open the drawer.

### Étape 3 — NEXT
**Frontend slice** `frontend/src/features/facturation/`:
- Hooks: `useInvoices(status?)`, `useInvoice(id)`, `useInvoiceByConsultation(id)`, `useUpdateInvoice`, `useIssueInvoice`, `useRecordPayment`, `useCreditNote`, `useAdjustInvoiceTotal`.
- `FacturationPage.tsx` (route `/facturation`, replaces `Placeholder`): liste avec filtres BROUILLON / EMISE / PAYEE_PARTIELLE / PAYEE_TOTALE / ANNULEE, tri par date/total, colonnes patient / numéro / date / total / statut.
- `InvoiceDrawer.tsx`: édition draft, boutons Émettre / Encaisser / Avoir.
- `ApercuFacturePage.tsx` (route `/facturation/:id/apercu`): primitive `<A4>` partagée avec ordonnance, mentions légales (ICE / RC / Patente / IF / CNSS), numéro séquentiel.
- Intégration Consultation : bouton "Ajuster total" avant signature → `PUT /consultations/:id/invoice-total`. Lien vers la facture brouillon depuis "Documents générés" après signature.
- Mobile: `MFacturation` (liste compacte) + `MInvoice` (détail plein écran).

**Backend** : aucun changement — `BillingController` existe déjà avec 8 endpoints.

### Étape 4
Onglets dossier patient (Prescriptions, Factures). L'onglet "Consults" est déjà câblé (Étape 1.5). Backend : ajouter le filtre `?patientId=` à `GET /api/invoices` (rapide, 5 lignes).

### Étape 5
Clic RDV dans Agenda → drawer Radix Dialog (détails + actions Modifier / Annuler / Check-in). Drag-to-move optimistic via `PUT /appointments/:id`. Toasts pour 409 (conflit, jour férié, congé).

### Étape 6
**Backend nouveau** : `SettingsController` avec `GET /api/settings/clinic` + `PUT /api/settings/clinic` sur `configuration_clinic_settings` (déjà utilisée par `PrescriptionPdfService`). Champs : nom, adresse, ICE, RC, Patente, IF, CNSS, téléphone, email, logo.

**Frontend** : `ParametragePage` (desktop + mobile), 4 onglets : Cabinet / Utilisateurs (`/api/admin/users` existe) / Documents (read-only MVP) / Congés (existe). Onboarding 7 steps wirés au bootstrap admin + settings clinique + création users.

### Étape 7
Backend : enrichir `/queue` avec `age`, `reasonLabel`, `practitionerName`, `durationMinutes`. Frontend : nettoyer placeholders `0 ans` / `—` dans `QueueRow`, vraie date dans `SalleAttente` sub.

### Étape 8
- Playwright : 3 specs (RDV happy path, consultation+sign+PDF, invoice issue+pay).
- Postman collection exportée depuis OpenAPI.
- Mise à jour `docs/API.md` avec les nouveaux endpoints.
- Mise à jour `docs/PROGRESS.md` final.
- README section "démo full-stack".
- Tag `v0.1.0-mvp` sur le sha qui passe CI.
