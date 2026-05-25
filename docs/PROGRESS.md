# Progress log

Running log of what's shipped. Updated at the end of every session. Read this FIRST when starting a new session.

## Current status

**Phase**: Post-pilote — **Hospitalisation Slice A (référentiel lits)** construit (V054 + module backend + onglet Paramétrage). Compile BE + build prod FE verts. Non testé en IHM, non commité.
**Last update**: 2026-05-25 (session hospitalisation — conception + Slice A)
**Build**: backend `mvn -DskipTests compile` ✓ ; frontend `npm run build` ✓ (tsc strict). Pas de `mvn verify` (memory `feedback_no_mvn_verify_for_now`). **Pas encore de QA IHM Playwright ni d'IT.**
**Next action**: (1) QA IHM Playwright Slice A (activer flag → onglet Chambres & lits → créer service/chambre/lit → board → toggle statut) ; (2) IT sibling `HospitalizationReferentialIT` ; (3) commit scopé. Puis Slices B-E (admission/séjour/ADT, suivi clinique, sortie+facture, cloisonnement) — voir `docs/plans/2026-05-25-hospitalisation-design.md`.

### 2026-05-25 — Hospitalisation : conception fonctionnelle + Slice A (référentiel lits)

**Conception** : `docs/plans/2026-05-25-hospitalisation-design.md` — careplus passe-partout (cabinet → centre → clinique avec lits). Recherche ADT/IPD + contexte Maroc (BAF, forfait journalier, grilles ANAM). Principe : **capability `hospitalization_enabled`** gated par `establishment_type` (V034), invisible pour un cabinet GP. Pas de rôle ADMISSION imposé (permission `HOSPITALIZATION_ADMIT` + rôle `INFIRMIER`). 5 slices, 7 décisions D1-D7 (recos appliquées en bloc). Entrée BACKLOG + mémoire `project_hospitalization_design_20260525`.

**Shipped Slice A** (uncommitted working tree) :

- **V054 `hospitalization_referential.sql`** : flag `hospitalization_enabled` sur `configuration_clinic_settings` ; tables `hospitalization_ward` / `_room` (room_class CHECK + `daily_rate`) / `_bed` (status CHECK, unique par chambre) ; rôle `INFIRMIER` (id ...007) ; permission `HOSPITALIZATION_ADMIT` seedée (ADMIN/MEDECIN/SECRETAIRE/INFIRMIER = TRUE, ASSISTANT = FALSE).
- **Backend `ma.careplus.hospitalization`** : entités Ward/Room/Bed (pattern ClinicRoom, soft-delete, optimistic lock), 3 repositories, `BedManagementService` + Impl (CRUD + garde anti-orphelin + board bulk-load anti-N+1 + statut OCCUPE non settable manuellement), `HospitalizationController` 13 endpoints sous `/api/hospitalization/**` (lecture rôles soignants, écriture MEDECIN/ADMIN, toggle statut SECRETAIRE/INFIRMIER/MEDECIN/ADMIN).
- **SettingsController** : `hospitalizationEnabled` ajouté à `ClinicSettingsView` + `UpdateClinicSettingsRequest` + GET/PUT (pattern null = pas de changement).
- **Frontend `features/hospitalisation/`** : `useHospitalization.ts` (types + hooks CRUD ward/room/bed + board) ; `ChambresLitsTab.tsx` (board read-only coloré par statut + sections Services/Chambres/Lits). Câblé dans `ParametragePage` : toggle « hospitalise des patients » dans l'onglet Cabinet + onglet conditionnel « Chambres & lits ». Type settings étendu.

**State** : working tree uncommitted. **Blockers** : aucun. **À ne pas oublier avant commit** : QA IHM (memory `feedback_qa_ihm_playwright_self` + `feedback_qa_mobile_parity`) + IT sibling + `npm run build` déjà vert.

### 2026-05-20 — Chat interne médecin ↔ staff v1 (ADR-035 + V048)

**Shipped** (uncommitted working tree, prêt à committer) :

- **V048 `chat_module.sql`** : 3 tables — `chat_conversation` (canonique `user_a_id < user_b_id` + UNIQUE), `chat_message` (immuable, CHECK length 1..2000), `chat_read_state` (PK composite, UPSERT pour mark-read). `last_message_at` dénormalisé pour tri O(1).
- **Backend `ma.careplus.chat`** : pure JdbcTemplate (pattern dashboard), `ChatService` + Impl, `ChatController` avec **7 endpoints** sous `/api/chat/**` — `GET /conversations`, `POST /conversations` (idempotent), `GET /conversations/{id}/messages?before=&limit=`, `POST /conversations/{id}/messages`, `POST /conversations/{id}/mark-read`, `GET /unread-count`, `GET /colleagues` (picker dédié — `/admin/users` étant ADMIN-only). Tous `isAuthenticated()`, sécurité par membership (404 si non-membre — pas de 403 pour ne pas révéler).
- **`ChatIT`** : 12 scénarios — start idempotent / 422 self / 404 user inconnu / send happy + last_message_at / 422 body vide / 422 body > 2000 / 404 non-membre sur list+send+mark-read / list oldest-first / mark-read drops unread à 0 / unread-count agrégé multi-conversations / read receipt visible côté sender après mark-read / 401 anonymous.
- **Frontend slice `features/chat/`** : 17 fichiers — types, schemas zod, 7 hooks (useConversations 10 s, useMessages 5 s, useStartConversation, useSendMessage, useMarkRead, useChatUnreadCount 30 s, useColleagues 60 s), 5 components (ConversationList, MessageBubble, MessageComposer, MessageThread, NewConversationButton), ChatPage desktop 2-cols + ChatPage.mobile (list OU thread via `?c=`) + ChatRoute responsive.
- **Navigation wirée** : Sidebar item `messages` (déjà présent dans le union `SidebarScreen` + NAV_MAP) — badge unread polling 30 s via `useChatUnreadCount` (réécrit depuis le placeholder mockup). Mobile : section "Communication" ajoutée à `ParametragePage.mobile.tsx` avec entrée Messages + badge. Route `/messages` ajoutée à `routes.tsx` sous `RequireAuth` (tous rôles).
- **Tests FE `chat.test.tsx`** : 10 specs — MessageBubble (mine, Lu, reçu jamais de check), ConversationList (empty, list, badge, click), useChatUnreadCount (fetch + disabled).
- **Design doc** : `docs/plans/2026-05-20-chat-design.md`. **ADR-035** ajouté.

**Décisions clés** (cf. ADR-035) : DM 1-1 only, polling (pas SSE/WS), texte 1..2000 chars only, tous ↔ tous (pas de permission `CHAT_USE` v1), messages immuables, schéma canonique `user_a_id < user_b_id`, endpoint `/chat/colleagues` dédié.

**State** : working tree uncommitted. Pas de `mvn verify`. Risque de régression faible (module isolé, lecture-only sur identity_user).

**Next action** : voir « Current status — Next action ». **Blockers** : aucun.

---

### 2026-05-14 (session étendue) — Onboarding parité polish ~95% + gate (ADR-034)

**Phase précédente**: wizard `/onboarding` poussé à parité ~95% prototype (ADR-033 + ADR-034) avec gate first-login + step resume + 4 chantiers polish iso-maquette (Cabinet type-selector/RC/IF, Médecin team-list, Tarifs nomenclature, Documents éditeur, Récap banner+table+cards, sidebar 360 px par step).
**Build (état précédent)**: Front `vite build` OK, `npx tsc --noEmit` vert ; tests onboarding 3/3 + routes 7/7 PASS.

### 2026-05-14 (session étendue) — Onboarding parité polish ~95% + gate (ADR-034)

**Shipped** (6 commits sur `feat/desktop-refresh-and-brand-refresh`, encore non pushés à l'écriture) :

- **`0cb0eca` feat(onboarding) BE** : V040 practitioner credentials (`inpe/cnom/cnops` sur `identity_user`) + `WorkingHoursController` (GET/PUT replace-all) + `DocumentTemplateController` (GET metadata-only) + `AdminUserController.PUT /{id}` étendu pour les credentials.
- **`549974d` feat(onboarding) FE** : wizard réécrit en 7 steps (Cabinet/Médecin/Horaires/Équipe/Tarifs/Documents/Prêt), footer `Continuer — <next>`, hooks `useWorkingHours/useDocumentTemplates/useMeProfile/etc.`, tests adaptés. ADR-033 + BACKLOG section parité différée.
- **`ec2a30d` chore(repo)** : `.gitignore` patterns pour QA screenshots (`audit-*`, `verify-*`, `mob-*`, `post-parity-*`, `onboarding-step*`, `onboarding-mobile`).
- **`d44b15e` feat(onboarding)** : sidebar 360 px par step (Why-cards Cabinet, tips Médecin, mini-agenda live Horaires, forfait Équipe, facture live Tarifs, A4 preview Documents, prochaines-étapes Récap), médecin team list multi-praticiens avec modal `AddDoctorModal`, Tarifs nomenclature 6 cols (Code/Acte/Prix/CNOPS/CNSS/RAMED). V041 ajoute flags assurance à `catalog_act` avec seed-adjust.
- **`13fd00b` feat(onboarding)** : gate first-login `<RequireOnboardingComplete>` qui wrappe `<AppLayout>` (ADMIN/MEDECIN seulement) + step resume (chaque `advanceTo` PUT `current_step`) + `OnboardingStateController` (GET state, PUT step, POST complete). V042 ajoute `onboarding_completed_at/current_step` + `rc/if_no/legal_form`. Iso-maquette Cabinet (type-selector + RC/IF + Forme juridique), Récap (banner+table+cards), Documents (tabs + logo upload + en-tête readonly + signature + pied + 3 options visuelles).
- **`13fd00b`** également ajoute ADR-034 (cette ADR) qui capture les 3 décisions imbriquées (V041, V042 cabinet-level gate, iso polish 4 chantiers parallèles).

**State** : 6 commits sur la branche, working tree clean côté fichiers que j'ai touché. Tests verts. Build green. Pas de push (sera fait dans la foulée).

**Next action** : voir « Current status — Next action ».

**Blockers** : aucun.



### 2026-05-14 — Onboarding wizard 7 étapes (ADR-033)

**Shipped** (non commité encore — uncommitted working tree) :

- **V040 `practitioner_credentials.sql`** : 3 colonnes nullable `inpe`, `cnom`, `cnops` sur `identity_user`. Backfill non requis (DEFAULT NULL). Idempotent via `IF NOT EXISTS`.
- **`WorkingHoursController`** (`ma.careplus.scheduling.infrastructure.web`) : GET/PUT `/api/settings/working-hours` en replace-all. Valide `start < end` + pas de chevauchement intra-jour. RBAC : tous rôles auth en lecture, ADMIN-only en écriture. Pas de service application/ ni d'entité JPA (JdbcTemplate direct comme `SettingsController`).
- **`DocumentTemplateController`** (`ma.careplus.configuration.infrastructure.web`) : GET `/api/settings/document-templates` retourne `id, type, page_format, templateBytes, updatedAt` (pas le HTML body — ~3 Ko économisés). Pas de PUT (éditeur déferré à Paramétrage → Documents, BACKLOG).
- **`AdminUserController` étendu** : `UpdateUserRequest` ajoute `Optional<String> inpe/cnom/cnops` avec la sémantique tri-état déjà en place (absent = ne pas toucher, présent = écraser, blank = NULL). `GET /{id}` + UPDATE SQL mis à jour. `UserView` étendu avec 4 champs (specialty + 3 nouveaux). `/api/users/me` étendu pour les exposer en lecture.
- **`User` entity (JPA)** étendu avec `inpe`, `cnom`, `cnops` + getters/setters → MapStruct auto-map vers `UserView`.
- **Frontend `OnboardingPage.tsx`** réécrit pour 7 étapes : Cabinet → Médecin → Horaires → Équipe → Tarifs → Documents → Prêt. Footer dynamique `Continuer — <next-label>`. Récap dynamique (compte jours ouverts, templates, signature, spécialité, équipe). Bouton Déconnexion red destructive + wordmark splittée `care/plus`.
- **Hooks `useOnboardingApi.ts`** centralise : `useWorkingHours`, `useUpdateWorkingHours`, `useDocumentTemplates`, `useMeProfile`, `useUpdatePractitionerCredentials`, `useUserSignature`, `useUploadUserSignature`.
- **Test `OnboardingPage.test.tsx`** mis à jour pour 7 step labels (3/3 verts).
- **ADR-033** ajouté à `docs/DECISIONS.md` (décision sur replace-all, JdbcTemplate single-row, pas de table `practitioner_profile` séparée).

**State** : working tree uncommitted ; build front green ; 3 tests onboarding verts ; design-parity-auditor a remonté des écarts substantiels avec le prototype (sidebar 360 px absente, Step Médecin = solo vs prototype = team list, Step Tarifs = remise simple vs nomenclature complète, Step Documents = read-only table vs éditeur, Step Récap = bullets vs banner+table+cards). Quick fixes appliqués (Déconnexion, wordmark splittée, rail connectors, Dr. prefix, 3 options Horaires, copy alignment titres+intros, max-widths CSS, CTA "Ouvrir mon cabinet"). Le reste ajouté à BACKLOG.md sous section dédiée.

**Next action** : commits scopés (BE module + FE wizard + tests + docs) sans push, puis prioriser parité design différée vs autre item BACKLOG selon retour pilote.

**Blockers** : aucun.



### 2026-05-09 — Cloisonnement Grossesse + dette QA salle d'attente

**Shipped** (commits `24770fe`, `599f5d3`, `f42dc87`) :

- **`24770fe` test(salle-attente)** : IT sœur `ConsultationByAppointmentIT` (6 scénarios) couvre `GET /api/consultations/by-appointment/{appointmentId}` ajouté en `8f2c80d` mais sans IT. Happy path + 404 (pas de consult / appointment inexistant) + 403 cloisonnement Dr A → Dr B + bypass ADMIN + 401 sans token. Bottle la walk Playwright manuelle desktop + mobile 390 px du bouton « Ouvrir ».
- **`599f5d3` feat(grossesse) cloisonnement** : V039 + `PregnancyQueueServiceImpl` refactor (`AccessScopeService` + `JdbcTemplate`, requête bulk UNION ALL `pregnancy_id → set practitioners` sur les 4 sources de rattachement, filtre orphan/scope avant calcul SA + alertes). `PregnancyQueueIsolationIT` 8 scénarios calque V036. ADR-031 inchangé (vaccination découplée v1) — la décision étendue est en ADR-032.
- **`f42dc87` feat(parametres) panneau orphelins** : refactor `VaccinationOrphanRolesPanel` → `OrphanRolesPanel<{module: 'vaccination'|'pregnancy'}>` paramétrable. Backend `SettingsController` étendu pour porter `pregnancyOrphanVisibleRoles`. `PregnancyOrphanRolesSettingsIT` 6 scénarios (default tous rôles, PUT réduit, PUT sans champ préserve, rôle invalide → 400, MEDECIN PUT → 403, indépendance V036/V039). ADR-032 ajouté à `docs/DECISIONS.md` capturant les 3 décisions du brainstorming.

**State** : 4 commits sur `main`, build front green, IT compilent. Régression côté QA non-jouée (`mvn verify` skip per memory).

**Next action** : voir « Current status — Next action ».

**Blockers** : aucun.



### 2026-05-06 (soirée) — F3 + F9 + F10 quick-wins parallèles

**Shipped** (commits `fdc8643` + `159eb4f`) :
- **F3 Icônes constantes** : 8 nouvelles icônes maison (Activity, Wind, Droplet, Scale, Ruler, Calculator, Circle, Baby) — pas d'import lucide-react externe (DESIGN_SYSTEM §8). Composant `<VitalIcon vital />` avec mapping centralisé. Wiré sur PatientContextCard, QuickVitalsDialog, ConsultationPage.mobile vitals grid, dossier patient SummaryPanel. CSS `.vital-icon` 14×14 / 11×11 mobile.
- **F9 Loader PDF** : `<PdfGenerationOverlay open type />` non bloquant bottom-right + spinner SVG inline + role=status. Wiré sur PrescriptionDrawer (DRUG/LAB/IMAGING) et CertificatDialog (CERT). Bouton disabled + label "Génération…" / "Enregistrement…" pendant mutation. Anti double-clic.
- **F10 Modale certificat repos** : champs structurés conditionnels (jours requis 1-30, date début default aujourd'hui, sortie autorisée checkbox) avec preview date fin auto-calculée. Approche FE-only : body enrichi côté client, pas de modif DTO/service backend, pas de Flyway. Helpers locaux (todayLocalIso/addDaysIso/formatFr) pour respecter feedback memory local-date-iso.

Cohabitation F9+F10 sur CertificatDialog : F10 = formulaire structure ; F9 = bouton submit + overlay. Merge propre.

**Tests** : 4 VitalIcon + 5 CertificatDialog + 4 PdfGenerationOverlay + régression scope 41-57/41-57 verts.

### 2026-05-06 (après-midi) — F1 Dashboard + F16 Signature PDF (5 agents parallèles)

**Shipped** (commits `14e2eec` + `3bc78b6`) :
- **F1 Dashboard** : 3 endpoints `/api/dashboard/{clinical|agenda|financial}` (package `ma.careplus.dashboard`, 100 % JdbcTemplate). MEDECIN/ADMIN voient les 3 ; SECRETAIRE/ASSISTANT voient agenda+clinical (financial gated 403). Page `/dashboard` desktop+mobile (4 sections : Aujourd'hui / Activité / Agenda semaine / Performance financière). 3 hooks React Query désactivés selon rôle (évite 403). Sidebar desktop + menu Plus mobile : entrée Dashboard ajoutée. Pas de lib chart en v1 (bars CSS minimales — F1.bis pour Recharts). Migration : aucune. **26 IT verts** (Clinical 7 + Agenda 8 + Financial 11) + 6 Vitest + 513/513 régression FE.
- **F16 Signature médecin** : V031 ajoute `signature_blob BYTEA` + `signature_mime VARCHAR` + `signature_uploaded_at TIMESTAMPTZ` à `configuration_clinic_settings`. 4 endpoints `/api/settings/signature*` (PUT/DELETE ADMIN-only ; GET /meta + GET tous rôles auth). Validation MIME (png/jpeg/webp) + taille ≤ 500 Ko. Section `SignatureSettingsSection` dans Paramétrage → Cabinet (gated ADMIN). Injection conditionnelle `<img th:src="data:...;base64,...">` au pied des 3 templates Thymeleaf (ordonnance, certificat, vaccination-booklet). Walk QA validé : upload PNG 212 octets → certificat passe de 2493 à 3229 octets (+736), tracé visible dans le PDF. **11 IT verts** + 6 Vitest.

### 2026-05-06 (matinée) — Bugs B1-B6 QA wave 8 + bugs collègue + IT compagnons grossesse

**Shipped** (commits `0d748c6`, `20fa24b`, `4f48f3f`, `becbc76`, `3e89792`, `9d0d2de`, `ce16c39`) :
- **B1+B5 Constantes** : DTOs backend RecordVitalsRequest/VitalSignsView étendus avec respiratoryRateBpm/abdominalPerimeterCm/headCircumferenceCm. V030 ajoute les 3 colonnes nullable. SummaryPanel passe à `usePatientVitalsHistory` (au lieu de patient.lastVitals hardcoded vide). PatientContextCard étendu pour rendre les 11 constantes conditionnellement.
- **B2+B3+B4 Documents PDF** : `<DocumentPdfViewer />` factorisé. `metaForPrescription(p)` calcule label/préfixe/filename type-aware. JWT in-memory transmis via axios → blob → URL.createObjectURL → iframe (résout B3). Boutons Télécharger/Imprimer wirés sur le blob (résout B4). **Cause apparente du PDF cassé en prod** : extension IDM Internet Download Manager qui interceptait silencieusement les responses PDF côté browser (504 No Content). User a désinstallé.
- **B6 Compteurs onglets dossier** : endpoint `/api/patients/{id}/tab-counts` (8 compteurs en 1 query SQL avec sous-COUNT). V029 ajoute index `idx_prescription_patient`. Hook `useTabCounts` (staleTime 30 s) + invalidation câblée sur 7 mutations (consultation, prescription, document upload/remove, vaccination dose, grossesse declare, invoice).
- **Bugs trouvés collègue/QA** : (1) bouton Certificat top-right consultation desktop ne réagissait plus → `window.open(blobUrl)` bloqué par Chrome popup-blocker → fix : `navigate('/prescriptions/:id')`. (2) onglet Prescriptions du dossier patient affichait "CERT"/"Document" au lieu de "Certificat" → utilisation de `metaForPrescription(p).label` desktop+mobile. (3) Worklist `/grossesses` plantait → `PregnancyQueueEntry` retournait `alertCount:int` au lieu de `alerts:List<PregnancyAlertView>` que le frontend attendait → refactor + ajout `saDays` (qui s'affichait "20+undefinedj"). (4) Zod SA min(4) vs backend min(6) sur écho → aligné min(6).
- **IT compagnons grossesse** : `PregnancyDossierStep4IT` (18 scénarios) + `PregnancyWorklistStep5IT` (17 scénarios). Couvre la dette QA des commits `1fe5d58` + `9c15c55`.

### Reste à faire (backlog QA wave 8)

**Quick-wins** : F2 Filtre type RDV agenda (~2-3h selon état enum DB).
**Moyens** (1-3j chacun) : F4 nom+photo cliquables + garde-fou, F5 bouton Enregistrer + autosave, F6 suppression brouillons, F7 facturation conditionnelle CONTROLE, F8 traçabilité documents + Certificat post-clôture, F11 modif facture émise, F12 stock par catégorie.
**Gros chantiers** : F13 annuaire spécialistes, F14 dépistage préventif âge+facteurs, F15 module suivi diabète + carnet numérique.
**Tech debt** : TD-1 Jackson `FAIL_ON_UNKNOWN_PROPERTIES = true` (risque cascade IT, à activer en dev d'abord).

### 2026-05-03 — Grossesse Étape 5 (frontend worklist /grossesses + sidebar badge + bio panel preview)

**Shipped** (commit `cb805cc`, 30 fichiers, 1861 ins) :
- Hooks : `usePregnancyQueue` (PageView paginé), `useGrossesseAlertsCount` (polling 30 s).
- Pages : `PregnancesQueuePage.tsx` desktop + `.mobile.tsx` (cards + sheet filtres) + `PregnancesQueueRoute.tsx` (responsive split). Route `/grossesses` guard `RequireRole={SECRETAIRE,ASSISTANT,MEDECIN,ADMIN}`. Filtres : 3 chips trimestre + withAlerts + recherche q debounced 200 ms. Tri SA décroissante. Empty state.
- Sidebar : item Grossesses (icône Heart — Baby/HeartPulse absent du set maison). Badge polling 30 s. SidebarScreen + NAV_MAP étendus dans 19 pages (effet typage strict).
- BioPanel — Option D : `BioPanelPreviewDialog` read-only + clipboard copy. Backend PrescriptionController consultation-scoped uniquement ; Option C (endpoint standalone) tracée BACKLOG. `BioPanelButton` : callback path Étape 4 préservé, sinon ouvre preview.
- Tests : 10 vitest étape 5 → 23/23 grossesse + 100/100 régression vaccination/shell.

### 2026-05-03 — Grossesse Étape 4 (frontend onglet dossier + drawers)

**Shipped** (commit `3d781f6`, 32 fichiers, 3710 ins) :
- Slice `features/grossesse/` complet : 14 hooks TanStack Query + 9 components + schemas zod + grossesse.css.
- Onglet `Grossesse` conditionnel `patient.sex === 'F'` dans `DossierPage` desktop + mobile (DossierTabs.showGrossesse prop).
- `PregnancyVisitDrawer` form contextuel selon SA (BCF ≥ 12, HU ≥ 20, MAF ≥ 24, présentation ≥ 32). `PregnancyUltrasoundDrawer` avec correctsDueDate visible si T1.
- Dialogs : Declare / Close / CreateChild. AlertsBanner avec severity. BioPanelButton (callback path).
- RBAC inline pattern Vaccination (useAuthStore + useRoles). 13 tests vitest + 116/116 régression FE + tsc clean.

### 2026-05-03 — Grossesse Étape 3 (alertes + worklist + bio-panel template)

**Shipped (no new migration — Étape 3 is pure query)**:
- Application : `PregnancyAlertService` (interface + `PregnancyAlertServiceImpl`) — 7 règles hardcodées : HTA_GRAVIDIQUE (TA ≥ 140/90), GAJ_GLUCOSE_URINAIRE (glycosurie BU), TERME_DEPASSE (today > dueDate + 7 j), NO_VISIT_T3 (pas de visite depuis > 6 sem à SA ≥ 28), BCF_ABSENT (BCF null/0 à SA ≥ 12), BU_POSITIVE (protéines/leuco/nitrites). HGPO_POSITIVE = TODO v2. `countActiveAlerts()` + `countByPregnancy(ids)` batch pour worklist.

### 2026-05-03 — Grossesse Étape 3 (alertes + worklist + bio-panel template)

**Shipped (no new migration — Étape 3 is pure query)**:
- Application : `PregnancyAlertService` (interface + `PregnancyAlertServiceImpl`) — 7 règles hardcodées : HTA_GRAVIDIQUE (TA ≥ 140/90), GAJ_GLUCOSE_URINAIRE (glycosurie BU), TERME_DEPASSE (today > dueDate + 7 j), NO_VISIT_T3 (pas de visite depuis > 6 sem à SA ≥ 28), BCF_ABSENT (BCF null/0 à SA ≥ 12), BU_POSITIVE (protéines/leuco/nitrites). HGPO_POSITIVE = TODO v2. `countActiveAlerts()` + `countByPregnancy(ids)` batch pour worklist.
- Application : `PregnancyQueueService` (interface + `PregnancyQueueServiceImpl`) — worklist paginée EN_COURS, SA décroissant, filtres trimestre/withAlerts/q. Réutilise `PageView<T>` de Vaccination. Cross-module `PatientRepository` (même exception acceptée que VaccinationQueueServiceImpl).
- Application : `PregnancyBioPanelService` (interface + `PregnancyBioPanelServiceImpl`) — templates T1/T2/T3 per PSGA. Lookup `catalog_lab_test` via `JdbcTemplate` (cross-module sans entité JPA). Fallback free-text si code absent du catalogue (ex : STREPTO_B). 422 `INVALID_TRIMESTER` si trimestre invalide.
- Persistence : `PregnancyVisitRepository` étendu — `countByPregnancyIdAndRecordedAtAfter()` (JPQL) pour règle NO_VISIT_T3. `PregnancyRepository` étendu — `findByStatus()` pour `countActiveAlerts()`.
- Web : `PregnancyAlertController` (2 endpoints), `PregnancyQueueController` (1 endpoint), `PregnancyBioPanelController` (1 endpoint) — 3 sous-contrôleurs cohérents avec le split Vaccination/Stock.
- IT : `PregnancyAlertIT` 5/5 + `PregnancyQueueIT` 4/4 + `PregnancyBioPanelIT` 5/5.

**Décisions prises** :
- Contrôleurs séparés (AlertController + QueueController + BioPanelController) par analogie avec `StockAlertController` + `VaccinationQueueController`.
- Stratégie alertes : boucle par grossesse (N=10-50 grossesses actives au cabinet, acceptable MVP). Post-MVP : native SQL aggregate si dégradation.
- Bio-panel : inline `Map<String, String>` + `JdbcTemplate` vers `catalog_lab_test` (pas d'entité catalog dans le module pregnancy). Fallback free-text si code absent.
- `countActiveAlerts()` = grossesses EN_COURS avec ≥ 1 alerte (pas somme des alertes), cohérent avec le badge sidebar "N gestantes à surveiller".

**State**: `mvn test -Dtest='Pregnancy*IT'` → 45/45 green, ~79 s total.
**Next action**: Étape 4 — Frontend grossesse.
**Blockers**: none.

### 2026-05-03 — Grossesse Étape 2 (visites obstétricales + échographies)

**Shipped (1 commit feature, no new migration — V026 already had the tables)**:
- Domain : `PregnancyVisit` + `PregnancyUltrasound` (entités JPA, fields-only, `@Version`, `@PrePersist`/`@PreUpdate`). JSONB pour `urineDipJson` et `biometryJson` via `@JdbcTypeCode(SqlTypes.JSON)`.
- Persistence : `PregnancyVisitRepository` (`findByPregnancyIdOrderByRecordedAtDesc(Pageable)` + `findFirstByPregnancyIdOrderByRecordedAtDesc`) + `PregnancyUltrasoundRepository` (`findByPregnancyIdOrderByPerformedAt`).
- Cross-module : `ConsultationStatusReader` (component dans `clinical.application`) — query narrow de status de consultation pour guard anti-modification après signature. Évite d'importer `ConsultationRepository` dans le module pregnancy.
- `PregnancyService` interface étendue avec `recomputePlanVisites(pregnancyId, actorUserId)` (méthode publique exposant la logique interne de `generateVisitPlan`). `PregnancyServiceImpl` implémente.
- Application : `PregnancyVisitService` (interface) + `PregnancyVisitServiceImpl` — record (calcul saWeeks/saDays depuis lmpDate, validation ranges OMS, liaison plan via appointmentId + fenêtre de tolérance), update (guard CONSULTATION_SIGNED via ConsultationStatusReader), listByPregnancy.
- Application : `PregnancyUltrasoundService` (interface) + `PregnancyUltrasoundServiceImpl` — record (guard SA_TOO_EARLY, correction DPA T1 via extraction `eg` du JSONB biométrie + recomputePlanVisites), listByPregnancy.
- Web : `PregnancyVisitController` (3 endpoints) + `PregnancyUltrasoundController` (2 endpoints). DTOs records : `RecordVisitRequest`, `UpdateVisitRequest`, `PregnancyVisitView`, `RecordUltrasoundRequest`, `UltrasoundView`. `PregnancyMapper` étendu avec `toVisitView` + `toUltrasoundView`.
- IT : `PregnancyVisitIT` 10/10 + `PregnancyUltrasoundIT` 6/6. Tests sc3/sc4 ont des TODO commentés pour les assertions alertes (scope Étape 3). sc7 utilise un vrai `scheduling_appointment` inséré en JdbcTemplate pour satisfaire la FK.

**Interprétations notables** :
- Split en sous-contrôleurs : `PregnancyVisitController` + `PregnancyUltrasoundController` (séparation des sous-ressources, cohérent avec Vaccination qui split `PatientVaccinationController` + `VaccinationQueueController`).
- Correction DPA T1 : `newDueDate = performedAt + (280 - eg)`. Si `biometryJson.eg` absent → fallback `eg = saWeeksAtExam * 7 + saDaysAtExam`. Le `lmpDate` n'est PAS modifié — c'est la `dueDate` qui est ajustée directement, et le plan de visites recompute depuis `lmpDate` (les `target_date = lmpDate + sa_weeks * 7` restent inchangés — seule la DPA est recalculée).
- `ConsultationStatusReader` : pattern interface publique dans `clinical.application` plutôt qu'import direct de `ConsultationRepository` (respect du contrat inter-module ARCHITECTURE.md).

### 2026-05-03 — Grossesse Étape 1 (schéma + déclaration + plan visites OMS)

**Shipped (1 commit feature)**:
- `V026__pregnancy_module.sql` — 4 tables (`pregnancy`, `pregnancy_visit_plan`, `pregnancy_visit`, `pregnancy_ultrasound`) + 4 triggers `touch_updated_at` + indexes + CHECK constraints + extension COMMENT `scheduling_appointment.type` avec `SUIVI_GROSSESSE`.
- Domain : `Pregnancy`, `PregnancyVisitPlan` (entités JPA fields-only), 5 enums (`PregnancyStatus`, `PregnancyOutcome`, `DueDateSource`, `VisitPlanStatus`, `UltrasoundKind`, `Presentation`). JSONB via `@JdbcTypeCode(SqlTypes.JSON)` (pattern `clinical_prescription_template`).
- `AppointmentType` Java enum étendu avec `SUIVI_GROSSESSE` (col VARCHAR — additif).
- Persistence : `PregnancyRepository` (3 finders + existsBy) + `PregnancyVisitPlanRepository` (findByPregnancyIdOrderByTargetSaWeeks + deleteByPregnancyId).
- Application : `PregnancyService` (interface) + `PregnancyServiceImpl` — declare (guard PATIENT_NOT_FEMALE + PREGNANCY_ALREADY_ACTIVE, auto-génération 8 visites OMS, MANQUEE si target_date < today), update (recalcul plan si lmpDate change, flush avant réinsertion pour éviter UNIQUE violation), close (TERMINEE vs INTERROMPUE selon outcome), createChild (cross-module PatientService.create + retourne childId), getVisitPlan, updateVisitPlanEntry, listByPatient, findCurrent.
- Web : `PregnancyController` (8 endpoints), DTOs records (`DeclarePregnancyRequest`, `UpdatePregnancyRequest`, `ClosePregnancyRequest`, `CreateChildRequest`, `PregnancyVisitPlanUpdateRequest`, `PregnancyView`, `PregnancyVisitPlanView`), `PregnancyMapper` (MapStruct).
- IT : `PregnancyDeclareIT` 15/15 scenarios (includes bonus sc7b INTERROMPUE + sc11 GET current).

**Design doc** : `docs/plans/2026-05-03-grossesse-design.md`.

### 2026-05-03 — Stock interne Étapes 1-5 (module complet, ~4 j compressés en 1 session)

**Shipped (5 commits)** :
- `1931556 feat(stock): backend Étape 1 — schéma + référentiel articles + fournisseurs` — V024 (4 tables, GENERATED column tracks_lots), entités/enums (Category, LotStatus, MovementType), repos, `StockCatalogService` (CRUD articles + suppliers, garde 409 CODE_DUPLICATE + 422 CATEGORY_LOCKED), 17 endpoints, `StockCatalogIT` 10/10.
- `5f58c88 feat(stock): backend Étape 2 — mouvements + FIFO + lots inactivate` — V025 (drop CHECK quantity > 0), `StockMovementService` (recordIn/Out/Adjustment, FIFO automatique sur péremption), `StockLotService.inactivate`, controllers movements + lots, RBAC nuancé (SECRETAIRE peut IN+ADJ pas OUT), `StockMovementIT` 12/12.
- `551317b feat(stock): backend Étape 3 — alertes stock faible + péremption + count badge` — `StockAlertService` (lowStock < min_threshold + lots ACTIVE expiring < 30 j), endpoints `/alerts` + `/alerts/count`, native queries pour count, `StockAlertIT` 5/5.
- `3d699eb feat(stock): frontend Étape 4 — liste + fiche article + drawer mouvement (desktop + mobile)` — slice `features/stock/` complet : 11 hooks, types + schemas zod, `/stock` page liste (URL-synced filters), `/stock/articles/:id` fiche (header + 3 quick-actions + lots + historique), `MovementDrawer` (IN/OUT/ADJUSTMENT modes), `StockArticleFormDrawer`, `LotInactivateDialog`, sidebar item + badge polling 30 s, navMap mis à jour 17 écrans, 68 tests vitest, build prod vert.
- _Étape 5 commit en cours par agent en parallèle (onglet Paramétrage fournisseurs)._

**ADR** : ADR-030 « Module stock — calcul de quantité à la volée + FIFO automatique » à ajouter.
**API** : 17 endpoints stock documentés.
**BACKLOG** : retrait QA7-1 (« Module gestion de stock interne ») — scope MVP livré.

**Design doc** : `docs/plans/2026-05-03-stock-interne-design.md` (5 étapes, plan figé via brainstorming Q1-Q8).

### 2026-05-03 — Vaccination Étapes 5 + 6 (worklist + Paramétrage + QA + docs)

**Shipped (2 commits Étape 5/6)** :
- `0761ad8 feat(vaccination): frontend Étape 5 — worklist /vaccinations + Paramétrage` — page transversale (3 onglets OVERDUE/DUE_SOON/UPCOMING + filtres + tableau paginé + drawer pré-rempli, desktop + mobile 390 px), sidebar item + badge polling 30 s, onglet Paramétrage desktop (CRUD vaccins + CRUD calendrier, drawers form + zod, PNI lock 422 PNI_PROTECTED). 18 fichiers, 3010 insertions, 37 tests vitest verts.
- `0539ca8 fix(vaccination): contrat DTO worklist — firstName/lastName, vaccineId, scheduleDoseId, totalPages` — QA wave 7 a révélé 2 bugs critiques (DTO `patientFullName` au lieu de firstName/lastName + manque vaccineId/scheduleDoseId ; PageView sans totalPages/number). Fix backend + IT régression `VaccinationQueueDtoContractIT` (5 scénarios).

**ADR ajoutée** : ADR-022 « Module vaccination — calendrier matérialisé à la volée ».
**API** : 17 endpoints documentés (catalog 4 + schedule 4 + patient doses 6 + worklist 1 + booklet 1 + 1 défer).
**BACKLOG** : retrait de `Vaccination schedule + reminders` (ligne 300, scope du MVP désormais livré).

**Design doc** : `docs/plans/2026-05-02-vaccination-enfant-design.md` (6 étapes, plan figé via brainstorming Q1-Q8).

### 2026-05-03 — Billing : filtres avancés + export

**Shipped (3 commits)** :
- `8d3e663 feat(billing): filtres avancés + export CSV/xlsx des factures` — backend (V023 indexes, JPA Specifications, EXISTS subqueries pour dateField=PAID + paymentMode multi, fastexcel exporter, 10000-row guard 422), frontend (popover Radix avec presets, ExportButton split CSV/xlsx, URL-sync, RBAC MEDECIN+ADMIN, mobile sans export).
- `ac5686c test(billing): IT + spec sibling pour filtres + export factures` — 22 IT (BillingSearchIT 11 + BillingExportIT 6 + InvoiceFilterCombinationIT 5) + 12 specs frontend (FacturationPage.filters 9 + useInvoiceSearch.params 3).
- `fd0fa4d fix(clinical): saveAndFlush sur update de PrescriptionTemplate` — bug surfacé par manual-qa du 2026-05-02 (parallel agent), avec PrescriptionTemplateExtendedIT (14 scénarios).

**Bugs corrigés en QA IHM avant commit (Playwright sur localhost:5173)** :
- axios sérialisait `status[]=` (Spring `@RequestParam List<>` attend `status=v1&status=v2`) → `paramsSerializer: { indexes: null }` sur les deux hooks. Sibling test : `useInvoiceSearch.params.test.ts`.
- `toIso(d)` utilisait `Date.toISOString()` (UTC) → en Africa/Casablanca (UTC+1), le 1er du mois local devenait le 30 du mois précédent. Fix : composantes locales. Sibling test : assertion locale (l'ancienne version reproduisait le bug et passait).

**ADR ajoutée** (déjà commit en `e8f389c`) : ADR-025 fastexcel vs Apache POI (~70× plus léger, 200 Ko vs 15 Mo, suffisant pour table plate + SUM footer).

**Design doc** : `docs/plans/2026-05-02-invoice-filter-export-design.md`.

> ⚠️ **Flow deviation (session 2026-04-24)** — Several UX fixes and patient module enhancements were shipped outside the planned J-day sequence in response to live product feedback. All changes are logged below. Backend tests remain green. Resume planned frontend porting next.

## Session log

### 2026-05-03 — Stock interne Étape 3 (alertes stock faible + péremption + count badge)

**Shipped:**
- `StockAlertService` interface + `StockAlertServiceImpl` — `getAlertCount()` (native aggregate COUNT queries, avoids N+1) + `listAlerts()` (articles below threshold + lots expiring ≤30 days). Enrich pattern réutilisé de Étape 1/2 pour `StockArticleView`. N+1 modéré accepté sur `listAlerts()` (≤80 articles en cabinet GP).
- `StockAlertCountView(int lowStock, int expiringSoon)` DTO record.
- `StockLotWithArticleView(lotId, lotNumber, expiresOn, quantity, daysUntilExpiry, articleId, articleCode, articleLabel, articleCategory)` DTO record.
- `StockAlertsView(List<StockArticleView> lowStock, List<StockLotWithArticleView> expiringSoon)` DTO record.
- `StockAlertController` — `GET /api/stock/alerts/count` + `GET /api/stock/alerts` — `@PreAuthorize` tous rôles authentifiés.
- `StockArticleRepository` étendu — `countLowStockArticles()` + `findLowStockArticles()` native queries (CASE WHEN tracks_lots pour sélection de la bonne méthode de calcul de quantité).
- `StockLotRepository` étendu — `countExpiringSoonLots(horizonDays)` + `findExpiringSoonLots(horizonDays)` native queries (JOIN stock_article pour filtrer par article.active=TRUE).
- `StockAlertIT` — 5 scénarios : S1 article qty<threshold présent dans lowStock+count, S2 lot expire dans 20j présent dans expiringSoon+count, S3 lot expire dans 60j absent, S4 lot INACTIVE exclu, S5 mix 2 low-stock + 3 lots expiring → agrégation correcte.

**State**: `mvn verify` → BUILD SUCCESS, 355/355 (350 existants + 5 nouveaux).
**Next action**: Stock Étape 4 — Frontend slice `features/stock/`.
**Blockers**: none.

### 2026-05-03 — Stock interne Étape 2 (mouvements + FIFO + lots inactivation)

**Shipped:**
- V025__stock_movement_adjustment_signed.sql — suppression contrainte `CHECK (quantity > 0)` sur `stock_movement` pour autoriser les deltas négatifs des ajustements non-lots.
- `StockMovementService` interface + `StockMovementServiceImpl` — `recordIn` (LOT_REQUIRED pour médicaments), `recordOut` (FIFO ACTIVE lots triés expires_on/created_at, INSUFFICIENT_STOCK 422), `recordAdjustment` (REASON_REQUIRED, delta signé pour non-lots), `getCurrentQuantity`, `listMovements`, `countMovements`.
- `StockLotService` interface + `StockLotServiceImpl` — `inactivateLot` (LOT_EXHAUSTED 409, idempotent), `listLotsForArticle` (filtre optionnel status).
- `StockCatalogServiceImpl` mis à jour — `getCurrentQuantity` et `getNearestExpiry` délèguent aux nouveaux services.
- `StockArticleView` étendu — `nearestExpiry: LocalDate` calculé.
- `StockMovementRepository` mis à jour — `computeQuantityFromMovements` inclut ADJUSTMENT signé ; `findByArticleIdFiltered` / `countByArticleIdFiltered` en native SQL (contournement Postgres type-inference sur enum nullable).
- `StockLotRepository` mis à jour — `findByArticleIdWithOptionalStatus` + `findNearestExpiry`.
- Nouveaux DTOs records : `StockMovementWriteRequest`, `StockMovementView`, `StockLotView` (daysUntilExpiry calculé), `PerformedByView`.
- `StockMovementController` — POST /movements (RBAC IN/OUT/ADJUSTMENT), GET /movements paginé filtré.
- `StockLotController` — GET /lots, PUT /lots/{id}/inactivate.
- `StockArticleController` refactoré — currentQuantity + nearestExpiry enrichis via StockCatalogService.
- `StockMovementIT` — 12 scénarios : IN consommable, IN médicament+lot, LOT_REQUIRED 400, OUT consommable, FIFO single-lot, FIFO multi-lots exhaustion, INSUFFICIENT_STOCK 422, ADJUSTMENT+reason, REASON_REQUIRED 400, RBAC OUT SEC403/ASST201, lot inactivate FIFO ignoré, historique paginé+filtré.

**Convention exception**: delta négatif stocké dans `stock_movement.quantity` pour les ajustements sur articles sans tracking lots (convention "toujours positif" relaxée via V025). Affiché en valeur absolue dans `StockMovementView.quantity`.

**State**: `mvn verify` → BUILD SUCCESS, 350/350 (338 existants + 12 nouveaux).
**Next action**: Stock Étape 3 — `StockAlertService`, endpoints `/api/stock/alerts` + `/api/stock/alerts/count`, `StockAlertIT` (5 scénarios).
**Blockers**: none.

### 2026-05-03 — Stock interne Étape 1 (schéma + référentiel articles + fournisseurs)

**Shipped:**
- `V024__stock_module.sql` — 4 tables (stock_supplier, stock_article avec GENERATED column tracks_lots, stock_lot, stock_movement) + indexes + triggers touch_updated_at.
- Domain: `StockSupplier`, `StockArticle`, `StockLot`, `StockMovement` entities; `StockArticleCategory`, `StockLotStatus`, `StockMovementType` enums.
- Persistence: `StockSupplierRepository`, `StockArticleRepository` (native query avec filtres category/supplierId/q/includeInactive), `StockLotRepository`, `StockMovementRepository`.
- Application: `StockCatalogService` interface + `StockCatalogServiceImpl` — CRUD articles + suppliers, garde 409 CODE_DUPLICATE, garde 422 CATEGORY_LOCKED, soft-delete via active=false, EntityManager refresh après saveAndFlush pour lire la colonne GENERATED (tracks_lots).
- Web: `StockSupplierController` + `StockArticleController` (PageView<StockArticleView> paginé, currentQuantity placeholder 0), `StockMapper` (MapStruct), DTOs records.
- `StockCatalogIT` — 10 scénarios : migration tables, CONSOMMABLE tracks_lots=false, MEDICAMENT_INTERNE tracks_lots=true, CRUD suppliers, RBAC mutations, CODE_DUPLICATE 409, CATEGORY_LOCKED 422, soft-delete filtré, filtre category, supplier deactivate includeInactive.

**Convention exception**: `StockArticleController` injecte directement `StockSupplierRepository` pour résoudre `supplierName` dans `enrich()`. Acceptable en Étape 1 (même module stock) — à refactorer en Étape 2 via une méthode dédiée dans `StockCatalogService`.

**State**: `mvn verify` → BUILD SUCCESS, 338/338 (328 existants + 10 nouveaux).
**Next action**: Stock Étape 2 — `StockMovementService` + FIFO + endpoints movements/lots + `StockMovementIT` (12 scénarios).
**Blockers**: none.

### 2026-05-02 — Vaccination Étape 4 (frontend dossier patient)

**Shipped:**
- `features/vaccination/types.ts` — `DoseStatus`, `RouteAdmin`, `VaccinationCalendarEntry`, `VaccineCatalogEntry`, `RecordDoseRequest`, `DeferDoseRequest`, `UpdateDoseRequest`, `AgeGroup`, `DrawerMode`, `SITE_SUGGESTIONS`
- `features/vaccination/schemas.ts` — `RecordDoseSchema`, `DeferDoseSchema`, `UpdateDoseSchema` (zod)
- `features/vaccination/hooks/` — 8 hooks: `useVaccinationCalendar`, `useVaccinationCatalog`, `useRecordDose`, `useDeferDose`, `useSkipDose`, `useUpdateDose`, `useDeleteDose`, `useDownloadBooklet` (arraybuffer → Blob → `URL.createObjectURL` → `window.open`)
- `features/vaccination/components/DoseCard.tsx` — status-coloured card, RBAC-gated buttons (canRecord / canAdmin)
- `features/vaccination/components/VaccinationCalendarTab.tsx` — desktop, vertical age-group timeline (PNI), `classifyAgeGroup` by `doseLabel` parsing, inline `DeferModal`, loading/error/empty states
- `features/vaccination/components/RecordDoseDrawer.tsx` — desktop panel (record/view/edit), `react-hook-form` + zodResolver, site suggestions dropdown, optimistic locking 409 toast
- `features/vaccination/components/VaccinationCalendarTab.mobile.tsx` — mobile, Vaul bottom-sheet for record/defer, fixed "Imprimer carnet" footer at bottom: 76px
- `features/vaccination/components/RecordDoseDrawer.mobile.tsx` — Vaul drawer, grab handle, safe-area-inset-bottom
- `features/vaccination/index.ts` — barrel re-export
- `features/dossier-patient/types.ts` — `'vaccination'` added to `DossierTab` + `MobileDossierTab` unions
- `features/dossier-patient/components/DossierTabs.tsx` — "Vaccination" tab between prescr and analyses
- `features/dossier-patient/DossierPage.tsx` — `<VaccinationCalendarTab>` panel wired
- `features/dossier-patient/DossierPage.mobile.tsx` — `<VaccinationCalendarTabMobile>` panel wired
- `__tests__/vaccination.test.tsx` — 28 component tests (DoseCard, VaccinationCalendarTab desktop, empty state, RecordDoseDrawer, VaccinationCalendarTabMobile), jest-axe on every component
- `__tests__/hooks.test.tsx` — 5 pure hook tests isolated from component mocks (`useVaccinationCalendar` ×3, `useRecordDose`, `useDownloadBooklet`)

**Tests**: 33/33 green. All form controls carry `htmlFor`/`id` pairs → 0 axe violations.
**Commit**: `3f5a249` — `feat(vaccination): frontend Étape 4 — onglet dossier patient + drawer + mobile`

**Key technical decisions:**
- Age-group classification parses `doseLabel` string (not patient birthdate), avoids needing the patient birth date in the calendar hook
- Hooks split into two test files (`hooks.test.tsx` with its own `vi.mock('@/lib/api/client')`, `vaccination.test.tsx` mocking the hooks themselves) to avoid `vi.mock` / dynamic import collision
- `hooks.test.ts` renamed to `hooks.test.tsx` (file contained JSX `<QueryClientProvider>`)

### 2026-05-01 — QA wave 5 (camera capture + patient photo + import skeleton)

**Shipped:**
- **QA5-2 — Capture caméra à l'upload** : composant partagé `frontend/src/components/ui/DocumentUploadButton.tsx` exposant deux CTAs côte à côte (« Téléverser » + « Photographier »). Le second utilise `<input type=file accept="image/*" capture="environment">` (caméra arrière par défaut sur mobile, fallback OS sur desktop). Branché dans `DocumentsPanel` (toutes catégories de documents historiques) et dans le panneau « Nouveau patient » > Onglet Médical > zone documents historiques. Icônes `Camera` + `Upload` ajoutées au lot d'icônes.
- **QA5-3 — Photo patient** : nouveau champ photo à la création (panneau « Nouveau patient » > Onglet Personnel — preview circulaire + DocumentUploadButton + bouton retirer). Téléversement différé jusqu'après la création du dossier (le patient n'a pas encore d'id sinon). Backend : V014 ajoute `patient_patient.photo_document_id` (FK denormalisée vers `patient_document` type=PHOTO), enum `DocumentType.PHOTO`, controller dédié `PatientPhotoController` exposant `PUT /api/patients/{id}/photo` (whitelist images-only, plafond 2 Mo) + `DELETE /api/patients/{id}/photo`. Frontend : composant partagé `PatientAvatar` qui charge le binaire via `/api/documents/{id}/preview` avec cache TanStack Query (déduplication par documentId, staleTime 5 min) ; fallback initiales si pas de photo / 410 / erreur de chargement. Intégré dans la **liste patients** (cellule avatar des cartes), le **header du dossier** (`PatientHeader`), et le panneau « Modifier » (upload immédiat via `usePatientPhoto`). `PatientView`/`PatientSummary`/`PatientMapper` exposent `photoDocumentId`.
- **QA5-1 (squelette) — Import auto + permission** : V014 crée les tables `document_import_source` et `document_import_inbox` (PENDING_REVIEW / MATCHED / REJECTED). Nouvelle permission `DOCUMENT_IMPORT_ADMIN` seedée TRUE pour ADMIN/MEDECIN et FALSE pour SECRETAIRE/ASSISTANT. La permission apparaît automatiquement dans l'écran Paramétrage > Droits d'accès (catégorie « Documents ») grâce à l'union dynamique côté `UserController.permissionsForRoles`. Le **poller IMAP / connecteur webhook lui-même n'est pas livré** — c'est la partie ~10 jours de QA5-1, schéma prêt pour le brancher sans deuxième round de migration.

**Files touched (résumé) :**
- Backend : `src/main/resources/db/migration/V014__patient_photo_and_imports.sql` (NEW), `documents/domain/DocumentType.java`, `documents/application/DocumentService.java` (replacePhoto + removePhoto), `documents/infrastructure/persistence/PatientDocumentRepository.java` (findCurrentPhotos + filtre PHOTO sur findActiveByPatient), `documents/infrastructure/web/PatientPhotoController.java` (NEW), `patient/domain/Patient.java` (champ + accesseurs), `patient/infrastructure/web/dto/PatientView.java` + `PatientSummary.java` (champ photoDocumentId), `patient/infrastructure/web/mapper/PatientMapper.java`.
- Frontend : `components/ui/DocumentUploadButton.tsx` (NEW), `components/ui/PatientAvatar.tsx` (NEW), `components/icons/index.tsx` (+ Camera, Upload), `features/dossier-patient/hooks/usePatientPhoto.ts` (NEW), `features/dossier-patient/components/DocumentsPanel.tsx`, `features/dossier-patient/components/PatientHeader.tsx`, `features/dossier-patient/PatientsListPage.tsx` (avatar + photo picker création), `features/dossier-patient/DossierPage.tsx` (photo dans EditPatientPanel), `features/dossier-patient/hooks/usePatient.ts` + `usePatientList.ts` + `types.ts` (photoDocumentId), `features/parametres/ParametragePage.tsx` (ligne DOCUMENT_IMPORT_ADMIN).

**State** : Backend `mvn clean compile` → BUILD SUCCESS (173 fichiers compilés). Frontend `tsc --noEmit` → clean.
**Tests** : Docker n'était pas lancé pendant cette session → Testcontainers ne peut pas spinner Postgres, donc les tests d'intégration n'ont pas pu être exécutés (`mvn verify` bloqué). À relancer dès Docker disponible. Compile-only validation OK.
**Next action** : (1) `docker compose up -d && mvn verify` pour valider la migration V014 et la non-régression de PatientIT/PatientDocumentIT/ApplicationSmokeIT. (2) Ajouter un IT couvrant `PatientPhotoController` (PUT happy-path, replace soft-deletes precedent, GET via `/documents/{id}/content`, 415 sur PDF, 413 sur >2 Mo). (3) Pour QA5-1, ajouter le module backend `documents.imports` (entités + repos + service + admin endpoints CRUD sur `document_import_source` et `document_import_inbox`) + le connecteur IMAP — multi-jours, planifier post-pilote.

**Blockers** : Docker arrêté → tests d'intégration en attente.

### 2026-04-23 — Project initialization

**Shipped:**
- Project directory `careplus-v2/` created alongside legacy `carePlus/`
- `.claude/settings.json` — permission allowlist for mvn/docker/git/curl-localhost
- `.claude/agents/regression-guard.md` — subagent running `mvn verify` before commits
- `.claude/agents/backend-module-scaffolder.md` — subagent scaffolding Spring modules with full layers + integration tests
- `CLAUDE.md` — session entry point
- `docs/WORKFLOWS.md` — business spec (9 workflows, state machines, permission matrix)
- `docs/ARCHITECTURE.md` — technical spec (modular monolith, stack, conventions, data model)
- `docs/SPRINT_MVP.md` — 7-day plan with scope boundary and exit criteria
- `docs/DECISIONS.md` — ADR index (initial entries for stack + deployment)
- `docs/REGRESSION_CHECKLIST.md` — checklist enforced at every iteration boundary
- `docs/API.md` — endpoint inventory (empty skeleton, filled module by module)
- `docs/BACKLOG.md` — out-of-MVP items parked for post-MVP

**State**: zero code. Setup only. Git repo initialized at the project root.

**Next action**: start J1 — requires user GO after confirming nothing was missed.

**Blockers**: none.

### 2026-04-23 — Vitals permission broadened

**Shipped:**
- ADR-013 added: vitals recordable by SECRETAIRE/ASSISTANT/MEDECIN (not just ASSISTANT). Reflects real Moroccan cabinet staffing diversity.
- `docs/WORKFLOWS.md` permission matrix updated (Record vitals + View vitals history now include SECRETAIRE).
- `docs/WORKFLOWS.md` WF3 reworded: "operator" instead of "A", + inline-vitals shortcut when médecin takes them himself.
- `docs/API.md` updated: `/vitals` and `/queue` endpoints role list broadened.

**State**: setup still complete, zero code. Permission model now reflects flexibility.

**Next action**: unchanged — awaiting user GO for J1 + decisions on the 4 critical items (GitHub remote, CI from J1, slash commands, pilot cabinet).

### 2026-04-23 — J1 foundation shipped

**Shipped:**
- `pom.xml` — Spring Boot 3.3.5, Java 21, all MVP deps (JPA, Security, Flyway, MapStruct, Lombok, springdoc, nimbus-jose-jwt, openhtmltopdf, bucket4j, testcontainers, archunit, logstash-encoder).
- `docker-compose.yml` — Postgres 16-alpine with Africa/Casablanca TZ, healthcheck, init script auto-creating extensions (uuid-ossp, pgcrypto, pg_trgm).
- `application.yml` + 4 profile overlays (dev/test/prod-onprem/prod-cloud). `careplus.*` config namespace (deployment-mode, JWT secret, login rate limit, module toggles).
- `logback-spring.xml` — plain console for dev/test, JSON (logstash-encoder) for prod.
- `V001__baseline.sql` — 25 tables covering all MVP modules (identity, patient, scheduling, presence-via-appointment-timestamps, clinical, billing, catalog, configuration). UUID ids, TIMESTAMPTZ, audit columns, soft delete on patient tables, version on mutable aggregates, btree + trigram indexes for search. Trigger function `touch_updated_at()` applied to every table.
- `V002__reference_data.sql` — 4 roles, 16 Moroccan holidays 2026, 10 insurances (AMO CNSS/CNOPS + mutuelles), 9 acts, 6 appointment reasons, 11 working-hour rows (Mon-Fri 9-13/15-19, Sat 9-13), 5 default document templates (ORDONNANCE/CERTIFICAT/BON_ANALYSE/BON_RADIO/FACTURE), billing invoice sequence initialized for current year.
- `R__seed_dev.sql` — 5 Moroccan demo patients, 2 allergies (Pénicilline, Iode), 20 common meds (Doliprane, Amoxicilline, Amlor, Glucophage, Xanax, …), 10 lab tests, 8 imaging exams. Fully idempotent (NOT EXISTS guards).
- Java layer: `Application` (forces Africa/Casablanca TZ), `ClockConfig`, `OpenApiConfig` (JWT bearer scheme), `SecurityConfig` (J1 baseline — public: /actuator/health, /v3/api-docs, /swagger-ui/**; rest authenticated), `CorrelationIdFilter` (X-Correlation-Id header → MDC), `GlobalExceptionHandler` (RFC 7807 problem+json), `BusinessException` / `NotFoundException`, `DomainEvent` interface, `DevUserSeeder` (creates 3 dev users with BCrypt on dev profile: youssef.elamrani@, fatima.zahra@, khadija.bennis@, password `ChangeMe123!`).
- `.github/workflows/ci.yml` — build + verify on push/PR, Java 21 Temurin, Maven cache, Surefire/Failsafe report upload on failure.
- `.mvn/settings.xml` + `.mvn/maven.config` — forces Maven Central (bypasses the corporate Karavel Nexus that's unreachable).
- `ApplicationSmokeIT` — 8 tests: context loads, DataSource wired, /actuator/health UP, /v3/api-docs reachable with careplus title, Flyway baseline + reference migrations applied, 4 roles seeded, ≥10 Moroccan 2026 holidays, ≥5 document templates, invoice sequence initialized.
- `.claude/commands/` — 5 custom slash commands: `/regress`, `/newmodule`, `/progress`, `/commit`, `/ship-day`.

**Issues encountered & resolved:**
- Corporate `~/.m2/settings.xml` pointing to unreachable `nexus02.in.karavel.com` → bypassed with project-local `.mvn/settings.xml` + `.mvn/maven.config`.
- `openhtmltopdf` wrong groupId (`io.github.openhtmltopdf` → `com.openhtmltopdf`).
- Flyway V002 contained Thymeleaf `${cabinet.name}` placeholders interpreted by Flyway as SQL placeholders → disabled via `spring.flyway.placeholder-replacement: false`.

**State**: `mvn clean verify` → `BUILD SUCCESS`, 8 tests / 0 failures / 0 errors, ~12s. Flyway applies 2 migrations cleanly. Postgres 16 Testcontainers provisioned properly. OpenAPI docs live at `/v3/api-docs`.

**Next action**: start J2 — identity module. Scaffold entities (User, Role, RefreshToken, AuditLogEntry), implement login (rate-limit via Bucket4j), JWT access+refresh tokens via nimbus-jose-jwt, `/api/auth/*` endpoints, replace DevUserSeeder's raw JDBC with the proper identity module API, integration tests covering login → access protected → refresh → access → logout → access blocked.

**Blockers**: none.

### 2026-04-24 — J5 clinical module completed and hardened

**Shipped:**
- `V003__clinical_and_presence.sql` — adds `can_start_consultation BOOLEAN` to `identity_user`; adds `type VARCHAR(20)` + `origin_consultation_id UUID` (FK → `clinical_consultation`) to `scheduling_appointment`.
- `AppointmentType` enum (CONSULTATION, CONTROLE, URGENCE) added to scheduling domain.
- `Appointment` entity: added `type`, `originConsultationId`, `arrivedAt` setter.
- `User` entity: added `canStartConsultation` field.
- `ConsultationService.scheduleFollowUp()` — creates CONTROLE appointment linked to a signed consultation. TODO(post-MVP:events): replace direct repository write with event.
- `ClinicalController`: added `POST /api/consultations/{id}/follow-up` endpoint (MEDECIN/ADMIN).
- `FollowUpRequest` / `FollowUpResponse` DTOs.
- Fixed `PresenceService.checkIn()`: was using JDBC to update `arrived_at` while Hibernate flushed entity with `arrivedAt=null`, overwriting it. Now uses entity setter directly.
- Fixed `GlobalExceptionHandler`: added `AccessDeniedException` handler returning 403. Without it, `@PreAuthorize` failures were caught by the generic `Exception.class` handler returning 500.
- Fixed `PatientIT.search_findsByFirstNameLastNameCinPhone`: test called `bearer(email)` 7 times, exhausting the 5-login rate limit. Added per-test token cache so same email reuses existing JWT.
- `AppointmentView` record updated with `type` and `originConsultationId` fields. `SchedulingController.toView()` updated accordingly.

**State**: `mvn clean verify` → `BUILD SUCCESS`, 51 tests / 0 failures / 0 errors.

**Next action**: J6 — prescriptions (clinical_prescription + PDF); catalog search endpoints.

**Blockers**: none.

### 2026-04-24 — J6 catalog + prescriptions module shipped

**Shipped:**
- `V004__catalog_prescription.sql` — adds `type` column to `catalog_act`; creates `catalog_tariff` table with tier-based temporal history (UNIQUE(act_id, tier, effective_from)); adds `patient_id`, `allergy_override`, `allergy_override_reason` to `clinical_prescription`; adds `medication_id`, `lab_test_id`, `imaging_exam_id`, `dosage`, `quantity`, `instructions`, `sort_order`, `updated_at` columns to `clinical_prescription_line`.
- `ma.careplus.catalog.domain` — `Act`, `Tariff`, `Medication`, `Prescription`, `PrescriptionLine` JPA entities, `PrescriptionType` enum.
- `ma.careplus.catalog.infrastructure.persistence` — `ActRepository`, `TariffRepository` (findEffectiveTariff JPQL, findOpenTariffs), `MedicationRepository` (searchByNameOrDci native), `PrescriptionRepository`, `PrescriptionLineRepository`.
- `ma.careplus.catalog.application.CatalogService` — CRUD acts, tariff lifecycle (close previous open tariff on new insert), medication search (ILIKE on commercial_name/dci).
- `ma.careplus.catalog.application.PrescriptionService` — createPrescription (status=BROUILLON guard, allergy check for DRUG type via PatientService public API, AllergyConflictException if conflict + override=false), getPrescription, getPrescriptionsByConsultation, getLinesForPrescription.
- `ma.careplus.catalog.application.AllergyConflictException` — 422 mapped in GlobalExceptionHandler with RFC 7807-style body `{type,title,medication,allergy,status}`.
- `ma.careplus.catalog.application.PrescriptionPdfService` — Thymeleaf + openhtmltopdf + jsoup (HTML5 → W3C DOM → PDF) for ordonnance generation; cabinet settings from `configuration_clinic_settings` with dev fallback.
- `src/main/resources/templates/ordonnance.html` — Thymeleaf ordonnance template (cabinet header, patient box, prescription lines, allergy warning, signature area).
- `ma.careplus.catalog.infrastructure.web.CatalogController` — acts CRUD + tariff endpoints + medication search.
- `ma.careplus.catalog.infrastructure.web.PrescriptionController` — prescriptions CRUD + PDF endpoint.
- `CatalogIT` — 9 tests: createAct, deactivateAct, addTariff, addNewTariff closes old one, medication search, DRUG prescription creation, allergy conflict 422, allergy override saved, PDF bytes non-empty with %PDF magic.
- Fixed pre-existing `PatientIT` failures: `phone` field was `@NotBlank` in `CreatePatientRequest` but tests didn't send phone → removed `@NotBlank` (phone is optional for medical workflow; patient may only have an emergency contact).
- Added jsoup 1.17.2 to pom.xml (HTML5 parsing for PDF generation; existing transitive version promoted to explicit dep).

**State**: `mvn clean verify` → `BUILD SUCCESS`, 60 tests / 0 failures / 0 errors. All prior modules green.

**Next action**: J7 — billing module. `ConsultationSigneeEvent` listener creates draft invoice. Invoice CRUD, issue (sequential number), payment, credit note, PDF.

**Blockers**: none.

### 2026-04-24 — J7 billing module shipped

**Shipped:**
- `V005__billing.sql` — adds `tier`, `mutuelle_insurance_id`, `mutuelle_policy_number` to `patient_patient`; adds `discount_amount`, `net_amount`, `mutuelle_insurance_id`, `mutuelle_policy_number`, `adjusted_by`, `adjusted_at`, `version` to `billing_invoice`; creates `config_patient_tier` table seeded with NORMAL=0% and PREMIUM=10%.
- `Patient` entity extended with `tier`, `mutuelleInsuranceId`, `mutuellePoliceNumber` fields (V005 columns).
- `ma.careplus.billing.domain` — `Invoice`, `InvoiceLine`, `Payment`, `CreditNote`, `ConfigPatientTier` JPA entities; `InvoiceStatus` and `PaymentMode` enums.
- `ma.careplus.billing.infrastructure.persistence` — `InvoiceRepository`, `InvoiceLineRepository`, `PaymentRepository`, `CreditNoteRepository`, `ConfigPatientTierRepository`, `InvoiceSequenceRepository` (SELECT FOR UPDATE, ADR-011 compliant).
- `ma.careplus.billing.application.BillingService` — `@TransactionalEventListener(AFTER_COMMIT)` listener creates draft invoice on `ConsultationSigneeEvent`; tier discount applied from `config_patient_tier`; `updateInvoice`, `adjustTotal`, `issueInvoice` (sequential number via `InvoiceSequenceRepository`), `recordPayment` (auto-status PAYEE_PARTIELLE/TOTALE), `issueCreditNote` (AYYYY-NNNNNN number, original ANNULEE).
- `ma.careplus.billing.infrastructure.web.BillingController` — 8 REST endpoints (GET list, GET by id, GET by consultation, PUT update draft, PUT adjust total, POST issue, POST payment, POST credit note).
- `BillingIT` — 9 integration tests: sign → draft, PREMIUM discount, médecin adjusts total, issue (sequential number), second invoice (incremented), full payment → PAYEE_TOTALE, partial → PAYEE_PARTIELLE, credit note (negative amount + ANNULEE), re-issue 409. All pass.

**State**: `mvn clean verify` → `BUILD SUCCESS`, 69 tests / 0 failures / 0 errors. All prior modules green.

**Next action**: J8 — frontend screens (Vite bundle wired into Spring Boot, React/TypeScript port of design prototype screens 01–13 per SPRINT_MVP.md J8-J10 plan).

**Blockers**: none.

### 2026-04-24 — J8 backend wrap-up shipped

**Shipped:**
- `WorkflowIT.java` — end-to-end integration test covering WF1→WF6 as a single chained test using `@SpringBootTest(RANDOM_PORT)` + `TestRestTemplate` (real HTTP, no MockMvc). Covers: login SECRETAIRE → patient search → availability → book appointment → check-in → queue → record vitals (MEDECIN) → start/update/sign consultation → create drug prescription → PDF → draft invoice wait → issue invoice (YYYY-NNNNNN) → full payment → PAYEE_TOTALE.
- `docs/API.md` — fully populated for all J2–J7 modules (identity + bootstrap + admin users, patient, scheduling, presence+clinical, catalog+prescriptions, billing). Every endpoint listed with method, path, role, request/response summary.
- `docs/PROGRESS.md` — updated to reflect J8 backend complete.

**State**: `mvn clean verify` → `BUILD SUCCESS`, 70 tests / 0 failures / 0 errors.

**Next action**: J8 frontend — wire dossier patient (screen 03) and prise de RDV (screen 02) to live API. Start with patient search/display (hooks call `/api/patients`), then appointment booking form (availability → POST /api/appointments).

**Blockers**: none.

### 2026-04-24 — ADR-023 patient module patch

**Shipped:**
- `V006__patient_notes_antecedent_category.sql` — `ALTER TABLE patient_antecedent ADD COLUMN IF NOT EXISTS category VARCHAR(60)` + `CREATE TABLE patient_note (id, patient_id, content, created_by, created_at, updated_at)` with index and `touch_updated_at` trigger.
- `AntecedentCategory` enum — 17 fine-grained taxonomy values (PERSONNEL_MALADIES_CHRONIQUES, PERSONNEL_CHIRURGIES, FAMILIAL, MEDICAMENTEUX_*, SOCIAL_*, GYNECO_OBSTETRICAL, PSYCHIATRIQUE).
- `Antecedent` entity updated with `@Enumerated(EnumType.STRING) AntecedentCategory category` field.
- `PatientNote` JPA entity (patient_note table).
- `PatientNoteRepository` — `findByPatientIdOrderByCreatedAtDesc`.
- New DTOs: `CreatePatientNoteRequest` (`@NotBlank content`), `PatientNoteResponse` (id, patientId, content, createdByName, createdAt), `UpdateTierRequest` (`@Pattern NORMAL|PREMIUM`), `UpdateMutuelleRequest` (insuranceId, policyNumber).
- `CreateAntecedentRequest` updated with optional `category` field.
- `AntecedentView` updated with `category` field.
- `PatientView` extended with `tier`, `mutuelleInsuranceId`, `mutuellePoliceNumber`.
- `PatientMapper.toView()` and `toAntecedentView()` updated accordingly.
- `PatientService` extended: `addAntecedent` sets category; `deleteAllergy`/`deleteAntecedent`; `createNote`/`getNotes` (user name lookup via UserRepository); `updateTier`/`updateMutuelle`.
- `PatientController` extended: `DELETE /{id}/allergies/{allergyId}`, `DELETE /{id}/antecedents/{antecedentId}`, `POST /{id}/notes` (MEDECIN), `GET /{id}/notes` (MEDECIN/ADMIN), `PUT /{id}/tier` (MEDECIN/ADMIN), `PUT /{id}/mutuelle` (all roles).
- `PatientIT` extended from 9 to 15 tests: antecedent with category, create note as MEDECIN, non-medecin note 403, tier update, mutuelle update.
- Fixed regression: `CreatePatientRequest.phone` had `@NotBlank` re-added by linter; removed (phone is optional, per J6 fix).

**State**: `mvn clean verify` → `BUILD SUCCESS`, 75 tests / 0 failures / 0 errors.

**Next action**: J8 frontend — unchanged. Wire dossier patient (screen 03) and prise de RDV (screen 02) to live API.

**Blockers**: none.

**Convention exceptions**: `PatientService` imports `UserRepository` from identity module (cross-module) to resolve `createdByName` for note responses. Consistent with existing precedent in `BillingService` (imports `PatientRepository`) and `CatalogService` (imports `PatientService`). Logged here as an exception; post-MVP refactor target is a shared read-model or event-sourced user name cache.

### 2026-04-24 — Patient UX hardening (out-of-flow fixes, live feedback)

> These changes were driven by product feedback during live demo/testing, outside the J-day sequence. They patch the patient creation and modification flows that shipped in J3/J8.

**Shipped (frontend):**

- **Création patient — allergies par sévérité** : le panneau "Nouveau patient" dans `PatientsListPage` inclut maintenant une section Allergies (substance + pills Légère/Modérée/Sévère, ajouter/supprimer) et une section Antécédents (catégorie dropdown + description, ajouter/supprimer). `useCreatePatient` fait maintenant 3 appels séquentiels : POST /patients → POST /patients/{id}/allergies (× n) → POST /patients/{id}/antecedents (× n).
- **Téléphone obligatoire à la création** : champ Téléphone * avec strip des non-chiffres à la frappe + regex `[\\d\\s+\\-().]{6,20}` à la soumission.
- **Validation nom/prénom** : `sanitizeName()` retire les chiffres et caractères spéciaux à la frappe (lettres Latin/accentuées/arabe, espaces, tirets, apostrophes autorisés). `isValidName()` bloque à la soumission si < 2 chars ou contient un chiffre. Appliqué aux deux formulaires (création + modification).
- **Modification patient — panneau complet** : le bouton "Modifier" dans `PatientHeader` ouvre un panneau slide-in (`EditPatientPanel` dans `DossierPage`) pré-rempli avec les données actuelles du patient. Toutes les sections :
  - Identité (prénom, nom, sexe, DDN, CIN, téléphone, email, ville, groupe sanguin)
  - Allergies existantes (affichées avec sévérité colorée + × pour supprimer) + ajout de nouvelles
  - Antécédents existants (catégorie label + description + × pour supprimer) + ajout de nouveaux
  - Notes libres
- **`useUpdatePatient`** : mutation en 5 étapes — PUT info + DELETE allergies supprimées + POST nouvelles allergies + DELETE antécédents supprimés + POST nouveaux antécédents (toutes les DELETE/POST en `Promise.all`).
- **`usePatient`** : expose maintenant `raw: PatientViewApi | null` en plus du `patient` adapté, pour pré-remplir le formulaire d'édition sans perte de données brutes.

**Shipped (backend):**

- `DELETE /patients/{id}/allergies/{allergyId}` — SECRETAIRE/MEDECIN/ADMIN. Vérifie l'ownership (patientId) avant suppression.
- `DELETE /patients/{id}/antecedents/{antecedentId}` — SECRETAIRE/MEDECIN/ADMIN. Même guard.
- `PatientService.deleteAllergy()` / `deleteAntecedent()` — vérification patient actif + ownership.
- `CreatePatientRequest` : `@Pattern(regexp = "[\\p{L}\\s'\\-]+")` + `@Size(min = 2)` sur `firstName`/`lastName` ; `@Pattern([\\d\\s+\\-().]{6,32})` sur `phone`.
- `UpdatePatientRequest` : mêmes contraintes sur `firstName`/`lastName`.

**Backlog mis à jour:**
- Ancien dossier patient (upload fichiers : prescriptions, radios) — spécifié dans `docs/BACKLOG.md` section "Documents & files" avec schéma DB, endpoints et comportement frontend.

**State**: tsc clean, 75 backend tests green, pas de régression.

**Next action**: reprendre le portage frontend prévu — Prise des constantes, Consultation SOAP, Prescription, Ordonnance, Facturation, Paramétrage.

**Blockers**: none.

### 2026-05-02 — Vaccination module Étape 1 shipped

**Shipped:**
- `V022__vaccination_module.sql` — 3 new tables (`vaccine_catalog`, `vaccine_schedule_dose`, `vaccination_dose`) + `patient_patient.vaccination_started_at TIMESTAMPTZ NULL`. Optimistic locking on `vaccine_catalog` and `vaccination_dose`. Soft-delete on `vaccination_dose`. Triggers + indexes per convention.
- `R__seed_vaccine_catalog.sql` — Idempotent PNI seed: 12 vaccines (`is_pni=TRUE`), 2 non-PNI (HepA, Varicelle), 25 schedule dose rows covering the Moroccan PNI calendar (birth → 11 years).
- Domain: `VaccineCatalog`, `VaccineScheduleDose`, `VaccinationDose` entities; `VaccinationStatus`, `VaccinationRoute` enums.
- Persistence: `VaccineCatalogRepository`, `VaccineScheduleDoseRepository`, `VaccinationDoseRepository`.
- Application: `VaccinationCatalogService` interface + `VaccinationCatalogServiceImpl` — CRUD for catalog + schedule; PNI_PROTECTED guard on deactivateCatalog; VAC_SCHEDULE_DUPLICATE 409 on duplicate (vaccine_id, dose_number).
- Web: `VaccinationCatalogController` — GET/POST/PUT/DELETE `/api/vaccinations/catalog` and `/api/vaccinations/schedule`; `@PreAuthorize` per design Q8 (MEDECIN/ADMIN mutate, all roles read).
- `VaccinationMapper` (MapStruct) — entity → DTO.
- DTOs: `VaccineCatalogView`, `VaccineCatalogWriteRequest`, `VaccineScheduleDoseView`, `VaccineScheduleDoseWriteRequest`.
- `VaccinationCatalogIT` — 9 tests covering: migration tables, seed counts, patient column, CRUD catalog, PNI guard, CRUD schedule, UNIQUE constraint, RBAC SECRETAIRE, RBAC ASSISTANT.

**State**: `mvn verify` → BUILD SUCCESS, 258 tests (was 247 + 9 new + 2 from SalleAttente module in between = 258), 0 failures.
**Next action**: Vaccination Étape 2 — `VaccinationService.materializeCalendar(patientId)`, `recordDose`, `deferDose`, `skipDose`, `PatientVaccinationController`, `VaccinationDueEvent`.

**Blockers**: none.

### 2026-05-03 — Vaccination module Étape 3 shipped

**Shipped:**
- `VaccinationQueueService` interface + `VaccinationQueueServiceImpl` — cross-patient worklist computed on the fly; bulk repository load (schedule + catalog loaded once, not N×per-patient); filters: status (OVERDUE/DUE_SOON/UPCOMING), vaccineCode, ageGroupMinMonths, ageGroupMaxMonths, upcomingHorizonDays; pagination via `PageView<T>` (ADR-028); sort: urgency DESC (OVERDUE daysOverdue↓ → DUE_SOON targetDate↑ → UPCOMING targetDate↑); practitionerId filter accepted but deferred TODO (ADR-027).
- `VaccinationQueueController` — `GET /api/vaccinations/queue` (all authenticated roles per Q5+Q8).
- DTOs: `QueueFilters`, `VaccinationQueueEntry`, `PageView<T>`.
- `VaccinationBookletPdfService` — Thymeleaf + openhtmltopdf + jsoup pattern strictly aligned on `PrescriptionPdfService`; generates vaccination carnet PDF (patient identity + ADMINISTERED doses table sorted by administeredAt ASC); empty carnet on 0 doses (never 404).
- `vaccination-booklet.html` Thymeleaf template — header cabinet, identity block (name/DOB/age/gender), doses table (Vaccin|Dose|Date|Lot|Voie-Site|Administré par|Signature), footer "Récapitulatif vaccinal — agrafer au carnet officiel".
- `PatientVaccinationController` extended — `GET /api/patients/{patientId}/vaccinations/booklet` (all roles); `Content-Disposition: inline; filename=carnet-vaccination-<lastName>-<firstName>.pdf`; PatientRepository injected for filename resolution (accepted cross-module exception).
- Bug fix in ADMINISTERED exclusion: `VaccinationQueueServiceImpl` now excludes off-schedule administered doses (scheduleDoseId == null) from queue — was only excluding schedule-linked ones.
- `VaccinationQueueIT` — 10 integration tests (all scenarios from design doc).
- `VaccinationBookletPdfIT` — 7 integration tests (non-vide, contenu via PDFBox text extraction, carnet vide, adulte, 404, RBAC, Content-Disposition).
- ADR-026, ADR-027, ADR-028 added to `docs/DECISIONS.md`.
- `docs/API.md` updated with new endpoints.

**State**: `mvn verify` → BUILD SUCCESS, 318 tests (was 287 + 17 new), 0 failures.
**Next action**: Vaccination Étape 4 — frontend slice `features/vaccination/`. Use `frontend-module-scaffolder` subagent for: `useVaccinationCalendar`, `useRecordDose`, `useDeferDose`, `useSkipDose`, hooks; `RecordDoseDrawer`; onglet "Vaccination" in `DossierPage` (desktop + mobile); design-parity-auditor after port.

**Blockers**: none.

### 2026-05-02 — Vaccination module Étape 2 shipped

**Shipped:**
- `VaccinationCalendarStatus` enum — extended status set for calendar entries: UPCOMING, DUE_SOON, OVERDUE (computed), ADMINISTERED, DEFERRED, SKIPPED (persisted).
- `VaccinationDueEvent` record — `(eventId, occurredAt, patientId, doseId, dueAt)`, implements `DomainEvent`; not published yet (Étape 3 cron job).
- `VaccinationService` interface + `VaccinationServiceImpl` — `materializeCalendar`, `recordDose`, `deferDose`, `skipDose`, `updateDose`, `softDelete`. Adult edge-case cutoff: entries excluded when `today > targetDate + tolerance + 5 years`. Dual path for defer/skip: accepts persisted doseId OR scheduleDoseId (materialises row on demand). Cross-module: PatientRepository (accepted exception, same precedent as BillingService/CatalogService).
- DTOs: `VaccinationCalendarEntry`, `RecordDoseRequest`, `DeferDoseRequest`, `UpdateDoseRequest` (all records, bean validation).
- `PatientVaccinationController` — 6 endpoints at `/api/patients/{patientId}/vaccinations` with `@PreAuthorize` per design Q8.
- `Patient` entity updated: mapped `vaccination_started_at TIMESTAMPTZ` column (V022 already added it to DB).
- `PatientVaccinationIT` — 12 integration tests covering scenarios 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15.

**State**: `mvn clean verify` → BUILD SUCCESS, 287 tests (was 258 + 12 new + ~17 from other modules counted fresh), 0 failures, 0 errors.
**Next action**: Vaccination Étape 3 — `VaccinationQueryService.queue(filters)` + `/api/vaccinations/queue` worklist + `vaccination-booklet.html` PDF + cron `VaccinationDueEvent` publisher.

**Blockers**: none.

## How to update this file

At end of every session:
1. Move the *Current status* block to reflect the new state.
2. Append a new dated entry under *Session log* with: shipped / state / next action / blockers.
3. Never rewrite history — only append.
