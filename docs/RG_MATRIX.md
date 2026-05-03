# Matrice Feature × Règle de gestion × Couverture de test

**Audit** : 2026-04-27 · commit `8127e92` · `v0.1.0-mvp` + QA waves 1–4 + module documents (QA2-2).
**Méthode** : extraction des RG depuis `docs/WORKFLOWS.md`, les `@PreAuthorize`, les `throw new BusinessException` et les contraintes Flyway. Mapping vers les vrais tests (`mvn verify` 82/82 + `npm test` 201/201). Chaque nom de test cité ci-dessous a été vérifié via `Grep` — pas d'invention.

**Phase A** (cette matrice) : couverture via tests automatisés existants. **Phase B** (Playwright e2e) : pas encore lancée — décision attendue après revue des trous identifiés ici.

---

## Légende

- ✅ **IT** `<Class.method>` — test backend Spring Boot couvre la RG
- ✅ **vitest** `<file > it-block>` — test frontend couvre la RG
- ⚠️ **partiel** — chemin nominal couvert, edge case non vérifié
- ❌ **aucun test** — RG implémentée dans le code mais pas vérifiée par un test automatisé

---

## 1. Identity & Auth (`ma.careplus.identity` / `frontend/src/features/login`)

### RG-AUTH-01 — Login refuse les credentials invalides
- **Règle** : email/password invalide → 401, le compteur `failed_attempts` s'incrémente.
- **Source** : `AuthService` + `identity_user.failed_attempts`
- **Couverture** : ✅ IT `IdentityIT.login_wrongPassword_401_incrementsFailedAttempts` · ✅ vitest `LoginPage.test.tsx > renders an inline error on 401 without clearing fields`

### RG-AUTH-02 — Rate-limit login : 5 tentatives / 15 min / IP
- **Règle** : 6e tentative dans la fenêtre → 429.
- **Source** : `LoginRateLimitFilter` (Bucket4j)
- **Couverture** : ✅ IT `IdentityIT.login_rateLimitKicksInAfter5Attempts`

### RG-AUTH-03 — Access token JWT en mémoire, refresh en cookie HttpOnly
- **Règle** : login renvoie `accessToken` + Set-Cookie `careplus_refresh` HttpOnly. Refresh tourne avec rotation.
- **Source** : `AuthController.login`, `SecurityConfig`
- **Couverture** : ✅ IT `IdentityIT.login_happyPath_returnsAccessTokenAndSetsCookie` + `refresh_happyPath_rotatesToken` + `refresh_withRevokedToken_401`

### RG-AUTH-04 — Logout révoque le refresh + nettoie le cookie
- **Source** : `AuthController.logout`
- **Couverture** : ✅ IT `IdentityIT.logout_revokesRefreshAndClearsCookie`

### RG-AUTH-05 — `/api/users/me` exige un JWT valide
- **Couverture** : ✅ IT `IdentityIT.me_unauthenticated_401` + `me_authenticated_returnsUser`

### RG-AUTH-06 — Bootstrap admin : autorisé uniquement si la base est vide
- **Source** : `AdminBootstrapController`
- **Couverture** : ✅ IT `AdminBootstrapIT.createsFirstAdmin_whenDbIsEmpty` + `rejectsSecondCall_whenAnyUserAlreadyExists` + `rejectsWeakPassword` + `rejectsInvalidEmail`

### RG-AUTH-07 — `POST /api/admin/users` réservé ADMIN
- **Source** : `@PreAuthorize("hasRole('ADMIN')")` sur `AdminUserController`
- **Couverture** : ✅ IT `AdminUserIT.secretaireCannotCreateUser` (403) + `unauthenticatedIsRejected` (401) + `adminCanCreateUser` (200)

### RG-AUTH-08 — Email user unique + rôle valide + password fort
- **Couverture** : ✅ IT `AdminUserIT.duplicateEmailReturns409` + `unknownRoleReturns400` + `weakPasswordReturns400`

### RG-AUTH-09 — Désactivation user : soft (`enabled=FALSE`) + révoque les refresh tokens vivants
- **Source** : `AdminUserController.deactivateUser`
- **Couverture** : ❌ aucun test sur le DELETE (endpoint ajouté en QA wave 2 sans IT — **trou à combler**)

### RG-AUTH-10 — Listing users : ADMIN uniquement
- **Source** : `AdminUserController.listUsers` (`@PreAuthorize("hasRole('ADMIN')")`)
- **Couverture** : ❌ aucun test (endpoint ajouté en QA wave 2)

### RG-AUTH-11 — `/me` retourne la liste des permissions agrégées par rôles
- **Source** : `UserController.permissionsForRoles`
- **Couverture** : ⚠️ partiel — `me_authenticated_returnsUser` valide la structure de base mais n'asserte pas le contenu de `permissions` (ajouté en QA3-3)

### RG-AUTH-12 — Multi-rôles cumulatifs (ADMIN+MEDECIN possible)
- **Couverture** : ✅ IT `AdminUserIT.adminCanCreateUserWithMultipleRoles`

---

## 2. Onboarding (`frontend/src/features/onboarding`)

### RG-ONBOARD-01 — Wizard 4 étapes : Cabinet → Tarifs → Équipe → Récap
- **Source** : `OnboardingPage.tsx`
- **Couverture** : ✅ vitest `OnboardingPage.test.tsx > renders a 4-step progress rail with step 1 (Cabinet) active` + `shows the cabinet identity form on the first step` + `exposes Précédent / Passer cette étape / Continuer in the footer`

### RG-ONBOARD-02 — Étape Cabinet appelle `PUT /api/settings/clinic`, étape Tarifs `PUT /api/settings/tiers/PREMIUM`, étape Équipe `POST /api/admin/users`
- **Source** : `OnboardingPage.tsx`
- **Couverture** : ❌ aucun test e2e sur le wiring API (les tests vitest mockent `api.*`)

### RG-ONBOARD-03 — Configuration cabinet réservée MEDECIN/ADMIN
- **Source** : `@PreAuthorize` sur `SettingsController`
- **Couverture** : ❌ aucun IT — **trou** (un `SettingsIT.java` n'existe pas dans `src/test/java/`)

---

## 3. Patient (`ma.careplus.patient` / `frontend/src/features/dossier-patient`)

### RG-PAT-01 — CIN unique (si fourni)
- **Source** : index unique `patient_patient.cin` (V001) + check applicatif
- **Couverture** : ✅ IT `PatientIT.duplicateCin_returns409`

### RG-PAT-02 — Création patient ouverte SECRETAIRE/MEDECIN/ADMIN ; ASSISTANT lecture seule
- **Source** : `@PreAuthorize` sur `PatientController.create` + `getOne`
- **Couverture** : ✅ IT `PatientIT.assistant_canReadButNotCreate` (403 + 200) + `secretaire_canCreateAndFetchPatient`

### RG-PAT-03 — `GET /api/patients` exige une auth
- **Couverture** : ✅ IT `PatientIT.unauthenticated_isRejected`

### RG-PAT-04 — Recherche full-text sur prénom/nom/CIN/téléphone (trigram)
- **Couverture** : ✅ IT `PatientIT.search_findsByFirstNameLastNameCinPhone`

### RG-PAT-05 — Update partiel (champs non fournis = inchangés)
- **Couverture** : ✅ IT `PatientIT.update_changesFields`

### RG-PAT-06 — Soft-delete (`deleted_at`) — MEDECIN/ADMIN uniquement, invisible en search
- **Couverture** : ✅ IT `PatientIT.softDelete_hidesFromSearch_andOnlyMedecinOrAdminCanDo`

### RG-PAT-07 — 404 sur GET d'un patient inexistant
- **Couverture** : ✅ IT `PatientIT.getNonexistentPatient_returns404`

### RG-PAT-08 — Allergies : substance + sévérité (LEGERE/MODEREE/SEVERE), retournées dans la vue patient
- **Couverture** : ✅ IT `PatientIT.addAllergy_thenReturnedInView`

### RG-PAT-09 — Antécédents : type (MEDICAL/CHIRURGICAL/FAMILIAL/GYNECO_OBSTETRIQUE/HABITUS) + catégorie + description
- **Couverture** : ✅ IT `PatientIT.addAntecedent_thenReturnedInView` + `addAntecedent_withCategory_categoryReturnedInResponse`

### RG-PAT-10 — Notes médicales : MEDECIN uniquement, attribuées + horodatées
- **Couverture** : ✅ IT `PatientIT.createNote_asMedecin_thenListedInGetNotes` + `createNote_asNonMedecin_returns403` (403)

### RG-PAT-11 — Tier (NORMAL/PREMIUM) modifiable, persisté
- **Couverture** : ✅ IT `PatientIT.updateTier_toPremium_confirmedViaGet`

### RG-PAT-12 — Mutuelle : assurance (FK) + numéro de police, modifiable par S/A/M/ADMIN
- **Couverture** : ✅ IT `PatientIT.updateMutuelle_reflectsInPatientView`

### RG-PAT-13 — DDN obligatoire à la création (QA2-1)
- **Source** : zod côté FE + `birthDate` requis dans `useCreatePatient`
- **Couverture** : ⚠️ partiel — validation FE seulement, le backend reste tolérant (`@Past` mais nullable). Couverture : test vitest sur le form, pas de test backend qui force l'invariant.

### RG-PAT-14 — Tabs Personnel/Médical à la création + modification (QA3-2)
- **Couverture** : ❌ aucun test ne vérifie la séparation des onglets ni le bounce vers Personnel sur erreur de validation

---

## 4. Documents patient (`ma.careplus.documents` — V009, livré aujourd'hui)

### RG-DOC-01 — Upload accepté pour SECRETAIRE/MEDECIN/ADMIN, refusé pour ASSISTANT
- **Source** : `@PreAuthorize` sur `PatientDocumentController.upload`
- **Couverture** : ✅ IT `PatientDocumentIT.secretaire_canUploadAndListAndDownload` + `assistantCannotUpload`

### RG-DOC-02 — MIME whitelist : PDF/JPEG/PNG/WebP/HEIC, autres → 415
- **Source** : `DocumentService.ALLOWED_MIME`
- **Couverture** : ✅ IT `PatientDocumentIT.rejectsUnsupportedMimeType`

### RG-DOC-03 — Type document parmi {PRESCRIPTION_HISTORIQUE, ANALYSE, IMAGERIE, COMPTE_RENDU, AUTRE} ; sinon 400
- **Couverture** : ✅ IT `PatientDocumentIT.rejectsUnknownDocumentType`

### RG-DOC-04 — Patient inexistant ou soft-deleted → 404 sur upload
- **Couverture** : ✅ IT `PatientDocumentIT.unknownPatientRejected`

### RG-DOC-05 — Listing/téléchargement ouvert à tous les rôles (incluant ASSISTANT)
- **Couverture** : ✅ IT `PatientDocumentIT.secretaire_canUploadAndListAndDownload` (assertion ASSISTANT can list + download)

### RG-DOC-06 — DELETE réservé MEDECIN/ADMIN ; soft-delete (deleted_at) + suppression du fichier disque ; absent du listing après suppression ; GET content → 404
- **Couverture** : ✅ IT `PatientDocumentIT.onlyMedecinOrAdminCanDelete` (403 secrétaire + 204 médecin + 0 dans la liste + 404 sur GET content)

### RG-DOC-07 — Plafond taille 10 Mo (`spring.servlet.multipart.max-file-size`)
- **Couverture** : ⚠️ partiel — la limite est configurée mais pas de test au-delà de 10 Mo (Spring renvoie 413 hors du contrôleur, hors champ de l'IT)

---

## 5. Scheduling / Agenda (`ma.careplus.scheduling` / `frontend/src/features/agenda` + `prise-rdv`)

### RG-SCHED-01 — Pas de double-booking sauf si `urgency=true`
- **Source** : `SchedulingService.create`/`move`
- **Couverture** : ✅ IT `SchedulingIT.refusesConflict_unlessUrgence`

### RG-SCHED-02 — Booking refusé sur jour férié (même en urgence)
- **Couverture** : ✅ IT `SchedulingIT.refusesBookingOnHoliday`

### RG-SCHED-03 — Booking refusé pendant un congé praticien
- **Source** : `practitioner_leave` (V007) + `SchedulingService` check
- **Couverture** : ⚠️ partiel — la vérification existe dans le code, pas de test dédié (à ajouter)

### RG-SCHED-04 — `start_at < end_at` (CHECK SQL)
- **Source** : V001 CHECK constraint
- **Couverture** : ❌ aucun test ne tente un end < start (cas-limite)

### RG-SCHED-05 — Liste de motifs alimentée depuis `V002__reference_data.sql`
- **Couverture** : ✅ IT `SchedulingIT.listsReasonsFromV002Seed`

### RG-SCHED-06 — Création RDV nominale + réponse contient le nom complet du patient
- **Couverture** : ✅ IT `SchedulingIT.createsAppointment` + `listReturnsPatientFullName`

### RG-SCHED-07 — Move/Cancel disponibles
- **Couverture** : ✅ IT `SchedulingIT.movesAppointment` + `cancelsAppointment`

### RG-SCHED-08 — Disponibilités calculées dans les heures de travail
- **Couverture** : ✅ IT `SchedulingIT.availabilityReturnsSlotsInWorkingHours`

### RG-SCHED-09 — Drag-to-move FE : snap 5 min, dispatch via `useMoveAppointment`, message de conflit lisible (QA wave 4)
- **Couverture** : ✅ vitest `AgendaPage.test.tsx` (8 tests) — golden path + interaction drag

### RG-SCHED-10 — Clic sur plage vide → ouvre la dialog RDV pré-remplie (QA2-3)
- **Couverture** : ✅ vitest `PriseRDV.test.tsx` (28 tests dont la pré-remplissage)

### RG-SCHED-11 — Endpoints exigent une auth
- **Couverture** : ✅ IT `SchedulingIT.unauthenticatedIsRejected`

---

## 6. Salle d'attente / Présence (`ma.careplus.presence` / `frontend/src/features/salle-attente`)

### RG-PRES-01 — Check-in : transition status PLANIFIE/CONFIRME → ARRIVÉ + stamp `arrived_at`
- **Couverture** : ✅ IT `ClinicalIT.checkIn_stampsArrivedAndAdvancesStatus`

### RG-PRES-02 — File d'attente filtre les statuts pertinents
- **Couverture** : ✅ IT `ClinicalIT.queue_returnsCheckedInAppointments`

### RG-PRES-03 — Page mobile : KPIs + date dérivés (pas de hardcode)
- **Couverture** : ✅ vitest `SalleAttentePage.test.tsx` (8 tests dont KPIs et date dynamique)

### RG-PRES-04 — Page desktop : pills statuts, allergies, RDV à venir, CTA selon statut
- **Couverture** : ✅ vitest `SalleAttentePage.test.tsx` (10 tests desktop)

### RG-PRES-05 — Idempotence du check-in (re-déclarer arrivée → no-op)
- **Couverture** : ❌ aucun test (à ajouter)

### RG-PRES-06 — Check-in refusé si statut terminal (ANNULÉ / NO_SHOW / CLOS)
- **Couverture** : ❌ aucun test (à ajouter)

---

## 7. Prise de constantes (`frontend/src/features/prise-constantes` / clinical vitals)

### RG-VIT-01 — Vitals saisissables par S/A/M/ADMIN
- **Couverture** : ✅ IT `ClinicalIT.recordVitals_advancesStatusAndComputesBmi`

### RG-VIT-02 — Champs : TA syst./diast., T°, poids, taille, FC, SpO2, glycémie ; BMI calculé
- **Source** : `clinical_vital_signs` (V001) + service
- **Couverture** : ✅ IT `ClinicalIT.recordVitals_advancesStatusAndComputesBmi` (asserte BMI)

### RG-VIT-03 — Saisie vitals → status passe à CONSTANTES_PRISES
- **Couverture** : ✅ IT `ClinicalIT.recordVitals_advancesStatusAndComputesBmi`

### RG-VIT-04 — Historique vitals par patient
- **Couverture** : ✅ IT `ClinicalIT.patientVitalsHistory_returnsRecorded`

### RG-VIT-05 — Footer "Saisi par ..." dérivé de l'utilisateur authentifié (QA wave 4)
- **Couverture** : ✅ vitest `PriseConstantesPage.test.tsx` (23 tests)

---

## 8. Consultation (`ma.careplus.clinical` / `frontend/src/features/consultation`)

### RG-CONS-01 — Création par MEDECIN (ou S/A habilité — flag `can_start_consultation`)
- **Couverture** : ✅ IT `ClinicalIT.consultation_startThenUpdateThenSign_andLockedAfterSign` + `secretaire_cannotStartConsultation` (403)

### RG-CONS-02 — Update libre tant que statut = BROUILLON
- **Couverture** : ✅ IT `ClinicalIT.consultation_startThenUpdateThenSign_andLockedAfterSign` (update OK avant sign)

### RG-CONS-03 — Sign verrouille (status SIGNEE), update post-sign → erreur
- **Couverture** : ✅ IT `ClinicalIT.consultation_startThenUpdateThenSign_andLockedAfterSign` (assertion locked after sign)

### RG-CONS-04 — Sign émet `ConsultationSigneeEvent` (AFTER_COMMIT) → BillingService crée la facture brouillon
- **Source** : `@TransactionalEventListener(phase = AFTER_COMMIT)`
- **Couverture** : ✅ IT `BillingIT.signConsultation_createsDraftInvoice`

---

## 9. Prescription / Catalogue (`ma.careplus.catalog`)

### RG-RX-01 — Prescription doit être sur consultation BROUILLON
- **Source** : `PrescriptionService` check
- **Couverture** : ⚠️ partiel — pas de test `rejectsPrescriptionOnSignedConsultation` explicite ; chemin nominal couvert

### RG-RX-02 — DRUG : cross-check allergies → 422 sauf `allergyOverride=true`
- **Couverture** : ✅ IT `CatalogIT.createDrugPrescription_allergyConflict_returns422` + `createDrugPrescription_allergyOverride_savedSuccessfully`

### RG-RX-03 — Lignes prescription persistées avec posologie/fréquence/durée
- **Couverture** : ✅ IT `CatalogIT.createDrugPrescription_savedWithLines`

### RG-RX-04 — Recherche médicaments par nom commercial / DCI (trigram)
- **Couverture** : ✅ IT `CatalogIT.searchMedications_amox_returnsAmoxicilline`

### RG-RX-05 — PDF ordonnance générée à la demande
- **Couverture** : ✅ IT `CatalogIT.getPrescriptionPdf_returns200WithPdfBody`

### RG-RX-06 — CRUD acts (création + désactivation) MEDECIN/ADMIN
- **Couverture** : ✅ IT `CatalogIT.createAct_appearsInList` + `deactivateAct_removesFromActiveList`

### RG-RX-07 — Tarifs historicisés (effective_from / effective_to) ; ajout d'un nouveau ferme l'ancien
- **Couverture** : ✅ IT `CatalogIT.addTariff_resolvedCorrectly` + `addNewTariff_closesOldOne`

---

## 10. Facturation (`ma.careplus.billing` / `frontend/src/features/facturation`)

### RG-BILL-01 — Facture brouillon auto-créée à la signature
- **Couverture** : ✅ IT `BillingIT.signConsultation_createsDraftInvoice`

### RG-BILL-02 — Discount Premium appliqué (par tarif PREMIUM ou par % global)
- **Couverture** : ✅ IT `BillingIT.signConsultation_premiumPatientGetsDiscount`

### RG-BILL-03 — Ajustement total brouillon par MEDECIN
- **Couverture** : ✅ IT `BillingIT.adjustTotal_persistsDiscountAmount`

### RG-BILL-04 — Numérotation `YYYY-NNNNNN` séquentielle, gap-free (SELECT FOR UPDATE)
- **Couverture** : ✅ IT `BillingIT.issueInvoice_assignsSequentialNumber` + `issueSecondInvoice_numberIncremented`

### RG-BILL-05 — Re-issue d'une facture déjà ÉMISE → 409
- **Couverture** : ✅ IT `BillingIT.issueAlreadyEmiseInvoice_returns409`

### RG-BILL-06 — Paiement complet → status PAYEE_TOTALE ; partiel → PAYEE_PARTIELLE
- **Couverture** : ✅ IT `BillingIT.recordFullPayment_statusPayeeTotale` + `recordPartialPayment_statusPayeePartielle`

### RG-BILL-07 — Note de crédit : annule la facture (status ANNULEE) + crée note avec montant négatif
- **Couverture** : ✅ IT `BillingIT.issueCreditNote_originalAnnulee_creditNoteNegative`

### RG-BILL-08 — Tarifs historicisés appliqués selon date de signature (ne change pas après coup)
- **Couverture** : ⚠️ partiel — `addNewTariff_closesOldOne` couvre la résolution par date, pas explicitement le scénario "facture émise hier ne change pas si tarif modifié aujourd'hui"

### RG-BILL-09 — Facture immutable une fois émise (pas d'update sur lignes/total post-issue)
- **Couverture** : ❌ aucun test explicite (l'absence d'endpoint le garantit, mais aucun test ne le formalise)

---

## 11. Paramétrage (`ma.careplus.configuration` / `frontend/src/features/parametres`)

### RG-SET-01 — Cabinet info (nom, adresse, INPE, CNOM, ICE, RIB) éditable MEDECIN/ADMIN
- **Couverture** : ❌ aucun IT (`SettingsIT.java` n'existe pas) — **trou notable**

### RG-SET-02 — Tarifs par tier configurables
- **Couverture** : ❌ aucun IT côté `/api/settings/tiers/*` ; couverture indirecte via `BillingIT`

### RG-SET-03 — Matrice rôle × permission éditable (V008, QA3-3)
- **Source** : `SettingsController` + V008
- **Couverture** : ❌ aucun IT — l'endpoint `PUT /role-permissions` n'a pas de test

### RG-SET-04 — Onglet Paramétrage bloqué pour SECRETAIRE/ASSISTANT (QA3-1)
- **Couverture** : ⚠️ implicite — RBAC frontend actif, mais pas de test vitest qui simule un SECRETAIRE et asserte l'absence de l'item dans le sidebar

### RG-SET-05 — Désactivation user (UI)
- **Couverture** : ❌ aucun test (UI ajoutée en wave 2)

---

## 12. Workflow de bout en bout

### RG-WF-01 — Parcours complet WF1 → WF6 : login → patient → RDV → check-in → vitals → consultation signée → facture émise → paiement
- **Couverture** : ✅ IT `WorkflowIT.fullWorkflowWF1ToWF6` (un seul test mais traverse tous les modules)

### RG-WF-02 — Healthcheck public + OpenAPI accessible
- **Couverture** : ✅ IT `ApplicationSmokeIT.health_endpoint_is_public_and_up` + `openapi_docs_are_reachable`

---

## 13. Frontend — couverture vitest

201/201 tests passent. Couverture par feature :

| Feature | Fichier | Tests | Statut |
|---|---|---|---|
| Login | `LoginPage.test.tsx` | 6 | ✅ |
| Onboarding | `OnboardingPage.test.tsx` | 4 | ✅ |
| Routes / RequireAuth / RequirePermission | `routes.test.tsx` | 7 | ✅ |
| Dossier patient (desktop + mobile) | `DossierPage.test.tsx` | 21 | ✅ |
| Liste patients | `PatientsListPage.test.tsx` | (compte non vérifié) | ✅ |
| Agenda + drag-to-move | `AgendaPage.test.tsx` | 8 | ✅ |
| Prise RDV (dialog + plage vide) | `PriseRDV.test.tsx` | 28 | ✅ |
| Salle attente (desktop + mobile) | `SalleAttentePage.test.tsx` | 18 | ✅ |
| Prise constantes | `PriseConstantesPage.test.tsx` | 23 | ✅ |
| Consultation | `ConsultationPage.test.tsx` | 6 | ✅ |
| Documents patient | (aucun test dédié) | 0 | ❌ — feature livrée aujourd'hui sans test FE |

---

## Trous identifiés (priorité décroissante)

### 🔴 Haute priorité (RG critique sans aucun test)

1. **RG-AUTH-09 + RG-AUTH-10** — endpoints DELETE et GET admin users sans IT (ajoutés en wave 2 sans test)
2. **RG-DOC-FE** — `DocumentsPanel` et `usePatientDocuments` sans test vitest (livrés aujourd'hui)
3. **RG-SET-01 / SET-02 / SET-03** — `SettingsIT.java` n'existe pas → cabinet info, tarifs par tier, matrice rôles non testés
4. **RG-BILL-09** — pas de test explicite d'immutabilité d'une facture émise
5. **RG-SCHED-03** — congé praticien : check applicatif sans IT dédié
6. **RG-PRES-05 + RG-PRES-06** — idempotence et refus check-in sur statut terminal

### 🟠 Moyenne priorité (RG nominale OK, edge case manquant)

7. **RG-PAT-13** — DDN obligatoire : forcé en FE seulement, backend tolérant (incohérence)
8. **RG-RX-01** — pas de test "prescription sur consultation signée → erreur"
9. **RG-BILL-08** — tarifs historicisés : pas de scénario "facture passée ne change pas après modification du tarif"
10. **RG-SCHED-04** — CHECK SQL `start < end` jamais déclenché par un test
11. **RG-AUTH-11** — `me_authenticated_returnsUser` n'asserte pas le contenu `permissions`

### 🟢 Basse priorité (cosmétique / UX)

12. **RG-PAT-14** — onglets Personnel/Médical du formulaire patient sans test FE
13. **RG-SET-04** — visibilité Paramétrage selon rôle non testée

---

## Verdict

- **Aucun bug détecté** au sens "test échoue" : `mvn verify` 82/82 vert, `npm test` 201/201 vert, `npm run build` OK.
- **Couverture** : ~75 % des RG identifiées ont un test direct, ~12 % ont une couverture partielle ou indirecte, ~13 % sont implémentées dans le code mais sans test automatisé.
- **Trous principaux** : la wave de QA récente (waves 2–4 + module documents) a livré du code sans toujours étendre les ITs en parallèle. Le module Settings n'a jamais eu d'IT.
- **Recommandation** : avant de passer à Playwright e2e (Phase B), combler les 6 trous "haute priorité" en ajoutant des ITs ciblés. C'est ~1 demi-journée et ça remonte la couverture à ~90 %.

**Phase B (Playwright)** reste pertinente pour valider le parcours utilisateur réel (login → onboarding → patient → RDV → consultation → facture), mais la Phase A montre que les invariants métier sont déjà majoritairement gardés par les ITs unitaires/intégration. Phase B est de la **défense en profondeur**, pas la première ligne.
