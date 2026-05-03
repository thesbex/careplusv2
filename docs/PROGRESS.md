# Progress log

Running log of what's shipped. Updated at the end of every session. Read this FIRST when starting a new session.

## Current status

**Phase**: Stock interne — Étape 2 livrée (mouvements + FIFO + lots inactivation)
**Last update**: 2026-05-03
**Build**: Backend — 350/350 mvn verify (12 nouveaux StockMovementIT + 338 existants). Frontend — 410/418 (inchangé).
**Next action**: Stock Étape 3 — `StockAlertService.queryAlerts()` : articles below threshold + lots péremption < J30. Endpoints `/api/stock/alerts` + `/api/stock/alerts/count`. IT `StockAlertIT` (5 scénarios).

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
