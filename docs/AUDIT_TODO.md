# careplus — Audit & punch list

> Audit transverse réalisé le 2026-04-29 (4 axes en parallèle : UI non câblée, endpoints orphelins, données statiques, bugs/sécurité).
> Total : ~140 findings — 9 BLOCKERS, 34 HIGH, 65 MEDIUM, 26 LOW.
> Structure : cocher au fur et à mesure. Fichiers/lignes pointent vers le code à fixer.

---

## 🔴 BLOCKERS — à fixer avant tout déploiement

### Sécurité / autorisation (auth wide open)

- [ ] **Auth ressource — patient** : `PatientController` `/patients/{id}` accessible à tout authentifié sans vérification d'appartenance (cabinet ou rôle × patient). → ajouter `assertResourceAccess(authentication, patientId)` dans `PatientService.findById`.
- [ ] **Auth ressource — consultation** : `ClinicalController` `GET /consultations?patientId=…` retourne le SOAP de n'importe quel patient.
- [ ] **Auth ressource — facture** : `BillingController` `GET /invoices/{id}` — pas de check ownership.
- [ ] **Auth ressource — document** : `PatientDocumentController` `GET /documents/{id}/content` (et `/preview`) — exfiltration possible. Vérifier que le doc appartient à un patient accessible à l'utilisateur.
- [ ] **JWT secret default** : `application.yml:50` = `change-me-in-prod`. Faire **fail-fast au démarrage** si la valeur env est absente ou égale au default.

### Données fictives visibles à l'utilisateur

- [ ] **`Sidebar.tsx:67`** — `cabinet = { name: 'careplus', city: 'Cab. El Amrani · Casablanca' }` codé en dur. Tout utilisateur voit "El Amrani · Casablanca". → wirer sur `useClinicSettings()`.
- [ ] **`Sidebar.tsx:67` (et `MScreen.tsx:21`)** — `counts = { salle: 3 }` codé en dur. → wirer sur `/api/queue` count.
- [ ] **`ApercuFacturePage.tsx:67-82`** — En-tête facture imprimée = "Médecin Généraliste" + "Inscrit à l'Ordre National des Médecins" + `ICE 0000000000000 · RC 000000`. **Facture juridiquement non conforme** au Maroc. → tirer ICE/RC/IF/CNSS/spécialité/INPE de `clinic_settings` + `practitioner`.
- [ ] **`PriseConstantesPage.tsx:55-60`** (+ `.mobile.tsx`) — `DEFAULT_VITALS` = TA 132/84, pulse 78, T° 36,9, poids 74, taille 178, "Patient vient pour…". Le médecin part de **valeurs fausses**. → form vide ou pré-rempli avec les dernières vitals connues du patient.

---

## 🟠 HIGH — comportements visibles cassés

### Frontend non câblé

- [ ] `ConsultationPage.tsx:222-291` — boutons `disabled` statiques : **Modèles**, **CIM-10**, **Certificat (en-tête)**, **Certificat médical (action)**, **Prochain RDV**.
- [ ] `useCatalogSearch.ts:57` — pour `LAB` et `IMAGING` le path est `null` → fallback `'/_disabled'`. Les bons d'analyses et d'imagerie ne renvoient **jamais** de résultats. Backend `/lab-tests` et `/imaging-exams` existent.
- [ ] `useInvoiceMutations.ts:113` — `PUT /consultations/${id}/invoice-total` sans préfixe `/api` côté client → 404 silencieux. Vérifier la base URL.
- [ ] `SalleAttentePage.tsx:161` — clic « Ouvrir consultation en cours » → `toast.info('… à câbler (J5 follow-up).')`. → naviguer vers `/consultations/{id}`.
- [ ] `DossierPage.mobile.tsx` — variante mobile utilise toujours fixtures (`TODO J3`).
- [ ] `DossierTabs.tsx:16-24` — badges (Consultations 14, Prescriptions 22, Analyses 9, Imagerie 3, Documents 7, Facturation 14) **statiques**. → counts depuis l'API.
- [ ] `agenda/fixtures.ts` — 25 RDV factices + 3 arrivals injectés dans `AgendaGrid` quand l'API ne renvoie rien.
- [ ] `PreviousVitalsCard.tsx` — fallback affiche `CURRENT_PATIENT = "Youssef Ziani"`. → fallback "—".

### Endpoints backend orphelins (faits, non câblés)

- [ ] `POST /consultations/{id}/follow-up` — programmer un RDV de suivi. Aucun caller frontend.
- [ ] `PUT /patients/{id}/tier` — passer un patient en Premium.
- [ ] `PUT /patients/{id}/mutuelle` — changer la mutuelle.
- [ ] `POST /patients/{id}/notes` (MEDECIN only) — créer une note clinique.
- [ ] `GET /patients/{id}/notes` — lister les notes.
- [ ] `GET /availability` — slots de dispo : aucun écran ne l'utilise, l'agenda calcule donc localement avec fixtures.
- [ ] `GET/POST/PUT/DELETE /catalog/acts` + `/tariffs` — CRUD actes & tarifs : **zéro UI**.
- [ ] `PUT /settings/role-permissions/{roleCode}` — éditeur de matrice RBAC : zéro UI.
- [ ] `GET/POST/DELETE /practitioners/{id}/leaves` — congés praticien : la page existe mais tous les hooks ne sont pas câblés.

### Sécurité applicative / robustesse

- [ ] **`ConsultationService.sign()`** — accepte de signer une consultation avec `diagnosis` vide. Le frontend valide côté schéma mais le backend ne fait aucun check. → ajouter une garde dans `sign()` qui rejette en `BusinessException("CONSULT_DIAGNOSIS_REQUIRED", "Appréciation / diagnostic (A du SOAP) requis pour signer.", 422)`. Confirmé QA 2026-05-01.
- [ ] **`POST /api/consultations/{id}/prescriptions` → 500 quand patient = `3f0545ee` (Fatima Zahra)** — **MAIS 201 sur les autres consults** (Mohamedd 1741c1e0 marche en IHM ET en curl). Le 500 cascade depuis le même bug que `GET /api/patients/3f0545ee` (cf. ligne plus bas) : `PrescriptionService.createPrescription` appelle `patientService.getAllergies(patientId)` qui passe par `PatientMapper.toView` ou un chemin similaire qui NPE sur les données de ce patient. → fix le patient mapper, le 500 prescription disparaît automatiquement. **Confirmé QA IHM 2026-05-01.** Endpoint zéro IT côté serveur — manque un `PrescriptionIT`.
- [ ] **`GET /api/prescriptions/{id}/pdf`** — retourne 500 sur prescription existante (LAB, free_text vide, line sans labTestId). Probable NPE dans `PrescriptionPdfService.generateOrdonnancePdf` ou Thymeleaf process. → ajouter try/catch + IT couvrant le cas "ligne sans labTestId/medicationId". **Confirmé QA 2026-05-01.**
- [ ] **`PUT /api/invoices/{id}` (ajout de lignes)** — retourne 500. Empêche la facturation manuelle de prestations / actes. → IT manquante (`BillingIT.updateInvoice_addsLines`). **Confirmé QA 2026-05-01.**
- [ ] **`POST /api/invoices/{id}/issue`** — accepte d'émettre une facture **à 0 MAD** (sans lignes). Aucun garde-fou. → rejeter en `BusinessException("INVOICE_EMPTY", "Une facture émise doit contenir au moins une ligne ou un total > 0.", 422)` si `total = 0`. **Confirmé QA 2026-05-01.**
- [ ] **`POST /api/invoices/{id}/payments` — overpayment accepté** : on enregistre 400 MAD sur une facture de 0 MAD, statut → `PAYEE_TOTALE` avec `total=0, paid_total=400`. → rejeter si `paid_total + amount > total` (sauf cas justifié `allowOverpayment=true` documenté). **Confirmé QA 2026-05-01.**
- [ ] **`GET /api/patients/{id}` → 500 sur certains patients** — repro sur `3f0545ee-5be7-42f9-a772-800196acc7a7` (Fatima Zahra Lahlou) ; OK sur les autres. Le screen `/constantes/{appointmentId}` tape 3 fois la 500 (loading retry). → Probable NPE dans `PatientMapper.toView()` quand allergie / antécédent en DB a une valeur que le mapper ne tolère pas. **Confirmé QA IHM 2026-05-01.**
- [ ] **`TarifsTab` infinite re-render loop** — `Warning: Maximum update depth exceeded` au montage de l'onglet **Tarifs** (`ParametragePage.tsx:362`). useEffect sans deps array ou avec une dep qui change à chaque render. Visible côté console; finit par freezer la tab. → auditer le useEffect du composant et stabiliser la dep. **Confirmé QA IHM 2026-05-01.**
- [ ] **🔴 SAFETY — Constantes affiche le mauvais patient** : quand `GET /api/patients/{id}` échoue (cf. ligne précédente), `PriseConstantesPage` retombe sur le fallback `CURRENT_PATIENT = "Youssef Ziani · 38 ans · ♂"` côté `PreviousVitalsCard` ET reste sur les valeurs `DEFAULT_VITALS` (TA 132/84, T° 36.9, IMC déjà calculé 23.4, motif texte de 80 chars pré-rempli). **Le médecin saisit les constantes en regardant les références d'un autre patient.** Risque clinique majeur. → en cas d'erreur API, bloquer le formulaire derrière un bandeau d'erreur ; ne JAMAIS afficher de fallback fixture. Confirmé QA IHM 2026-05-01.
- [ ] **Charset double-encodé sur les réponses Settings** — la DB stocke `Cabinet (à configurer)` (UTF-8 OK) mais `GET /api/settings/clinic` renvoie `Cabinet (Ã  configurer)` (mojibake `Ã `). → JDBC URL probablement sans `?characterEncoding=UTF-8` + JVM `file.encoding` sur Windows en CP-1252 par défaut. → forcer `-Dfile.encoding=UTF-8` au démarrage Spring + ajouter `?stringtype=unspecified&...` ou définir `client_encoding` dans la connexion. **Confirmé QA 2026-05-01.**
- [ ] `useAuth.ts:75` — `catch {}` avale les erreurs de bootstrap refresh → utilisateur bloqué silencieusement.
- [ ] `PriseRDVDialog.tsx:448` — `.catch(() => null)` silencie un échec de création de RDV → l'utilisateur croit que c'est créé.
- [ ] `BillingService.onConsultationSigned()` — `AFTER_COMMIT + REQUIRES_NEW` : si la création de facture échoue, la consultation est déjà signée et la facture est perdue **sans erreur visible**. → file de retry + alerte admin.
- [ ] `CatalogController` `POST/PUT /medications` — pas de `@Valid` sur le body → noms commerciaux vides acceptés.
- [ ] `LoginPage.tsx:192` — `<button>` sans `type="button"` dans `<form>` → submit par mégarde au clic.

---

## 🟡 MEDIUM — à régulariser

- [ ] `clinical_vital_signs` — pas d'index sur `consultation_id` (utilisé par le nouvel endpoint `/consultations/{id}/vitals`). Ajouter une migration.
- [ ] Fixtures encore présentes dans `src/` (test-only mais importables) : `dossier-patient/fixtures.ts`, `consultation/fixtures.ts`, `salle-attente/fixtures.ts`. → renommer en `*.fixture.ts` ou déplacer sous `__fixtures__/`.
- [ ] `prise-rdv/fixtures.ts` — `REASON_OPTIONS` (6 motifs en dur), `DURATION_OPTIONS` (5 durées). Le cabinet ne peut pas en ajouter. → `/api/catalog/appointment-reasons` (existe déjà).
- [ ] `prise-constantes/fixtures.ts` — `REFERENCE_RANGES` "H 30-50 ans" : référence âge/sexe figée. → API ou onboarding.
- [ ] `PriseConstantesPage.mobile.tsx:220-227` — champ IMC `disabled` avec `onChange={() => undefined}` → recompute auto au lieu d'un placeholder.
- [ ] `AppointmentDrawer.tsx:176-251` — date/heure/durée `disabled={!canMutate}` pour tout RDV venant d'une fixture (sans id) → supprimer dès que les fixtures dégagent.
- [ ] `useConsultation.ts` cache key — clé react-query avec `id` qui peut être `undefined`, retournera de la donnée stale. Garde `enabled: !!id`.
- [ ] `client.ts:42-67` — `refreshInFlight` pas blindé contre une seconde 401 simultanée multi-onglets.
- [ ] `ParametragePage.tsx:126-153` & `OnboardingPage.tsx:284-298` — placeholders : "Cabinet Médical El Amrani", "+212 5 22 47 85 20", "24, Rue Tahar Sebti — Quartier Gauthier". → exemples génériques.
- [ ] Pas d'`i18n` global — tout en français en dur (OK pour Maroc v1, mais à structurer pour i18n future).
- [ ] Soft-delete : seul le module patient filtre `deleted_at IS NULL`. Billing/clinical peuvent référencer un patient supprimé. → audit module-par-module.
- [ ] CSRF désactivé globalement (`SecurityConfig.java:47`) — OK pour API Bearer, mais le login cookie a besoin d'une réflexion explicite.
- [ ] CORS = défaut Spring (`SecurityConfig.java:48`) — verrouiller la liste des origins en prod on-prem.
- [ ] `usePatient.ts:89-102` — message d'erreur générique : pas de différenciation 404 / 500.
- [ ] `useConsultation.ts:48-54` — pas d'optimistic update : si save mid-edit échoue, UI inconsistant.
- [ ] `PatientService.create` — patient orphelin si l'appel allergies/antécédents séparé échoue (pas de rollback HTTP cross-call). → endpoint composite ou saga côté frontend.

### A11y / qualité

- [ ] Plusieurs `<button>` dans `<form>` sans `type="button"` → submit par mégarde. Audit complet à faire.
- [ ] `dangerouslySetInnerHTML` — aucun usage suspect détecté ✅ (rien à faire, juste tracker).

---

## 🟢 LOW — bruit cosmétique (à grouper)

- [ ] `ROLE_LABELS` dupliqué `Sidebar.tsx` ↔ `PreviousVitalsCard.tsx`.
- [ ] `MONTHS_FR`, `WEEKDAYS_SHORT`, `DAY_KEYS` dupliqués dans 4-5 fichiers — extraire dans `lib/locale/fr-MA.ts`.
- [ ] `NAV_MAP` dupliqué dans 14 fichiers — refactor en hook `useNavMap()`.
- [ ] `routes.tsx:137` — route morte `/_unused_placeholder_consult` à supprimer.
- [ ] `ConsultationPage.tsx:3` — commentaire "Fully wired" mensonger vs lignes 229-291.
- [ ] Logs `JwtAuthenticationFilter` — niveau debug seulement, OK pas d'action.

---

## 📊 Récap par axe

| Axe                       | Total | BLOCKER | HIGH | MEDIUM | LOW |
|---------------------------|-------|---------|------|--------|-----|
| UI non câblée             | 30    | 3       | 12   | 13     | 2   |
| Endpoints orphelins / 404 | 39    | 2       | 6    | 20     | 11  |
| Données statiques         | 41    | 5       | 9    | 17     | 10  |
| Bugs / sécurité           | 30    | 5       | 7    | 15     | 3   |
| **TOTAL**                 | ~140  | **9**   | 34   | 65     | 26  |

---

## 🎯 Plan de bataille recommandé

### Sprint sécurité (1-2 j) — non négociable avant prod

1. Helper `assertResourceOwnership(authentication, patientId)` partagé, appelé dans `PatientService.get`, `ConsultationService.get`, `BillingService.get`, `DocumentService.getActive`. **(4 BLOCKERS d'un coup)**
2. Forcer `CAREPLUS_JWT_SECRET` au démarrage (fail-fast si default).
3. `@Valid` sur tous les `@RequestBody` (medication, settings.tier, …).

### Sprint données dynamiques (1 j)

4. `Sidebar.tsx` : enlever les défauts → `useClinicSettings()` + `useQueueCount()`.
5. `ApercuFacturePage.tsx` : header dynamique (`clinic_settings` + `practitioner`). **Bloque toute facture conforme.**
6. `PriseConstantesPage` : supprimer `DEFAULT_VITALS` — form vide ou pré-rempli aux dernières vitals.
7. `PreviousVitalsCard` : retirer `CURRENT_PATIENT`, fallback "—".

### Sprint câblage (2 j)

8. `useCatalogSearch` : enlever le `/_disabled` LAB/IMAGING — endpoints existent.
9. Câbler boutons consultation : Modèles, Certificat médical, Prochain RDV (`POST /consultations/{id}/follow-up`).
10. Badges `DossierTabs` dynamiques.
11. UI catalogue actes + tarifs (endpoints prêts).
12. UI matrice RBAC (`PUT /settings/role-permissions`).

### Sprint nettoyage (0,5 j)

13. Déplacer fixtures non-test sous `__fixtures__/` ou suffixe `.fixture.ts`.
14. Hook `useNavMap()` partagé pour tuer les 14 duplicatas.
15. i18n minimal (extraire les chaînes — sans traduction encore).
