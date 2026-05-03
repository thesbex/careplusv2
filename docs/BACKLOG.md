# Post-MVP backlog

Anything explicitly out of the MVP goes here. Append-only list of ideas/features/gaps, grouped by theme. Decide priority at MVP exit.

> **Status MVP — `v0.1.0-mvp` taggé sur `467e4f7` (2026-04-26).** Plan en 8 étapes + 5 sous-étapes QA livré intégralement. Voir `docs/MVP_WIRING.md` pour le détail commit-par-commit. Les items ci-dessous sont **post-pilote** : à prioriser après retour terrain.

## QA-driven follow-ups (extensions des features livrées dans le sprint MVP-wiring)

Chaque QA item livré a parfois laissé un **prolongement** non-bloquant. Tracé ici pour ne pas être oublié quand un cabinet pilote demandera l'évolution naturelle.

### Patient (issu de QA P1–P5)
- **Mobile parity du panneau "Nouveau patient"** : actuellement le panneau (incluant Mutuelle + Premium + Allergies + Antécédents) n'existe que sur desktop. Porter en `MNouveauPatient` pour mobile (sheet plein écran).
- **Tier discount mode fixe (MAD) en plus du %** : actuellement `config_patient_tier.discount_percent` uniquement. Ajouter colonne `discount_amount` + UI Tarifs avec radio Pourcentage/Forfait. Demande potentielle de cabinets qui font un rabais fixe (50 MAD) plutôt que %.
- **Tiers personnalisés** : aujourd'hui figés à NORMAL/PREMIUM. Ajouter `GOLD`, `STAGIAIRE`, `FAMILLE`, etc. avec tiering éditable depuis Paramétrage.
- **Antécédents in-place edit** : depuis le dossier (tab Chronologie / SummaryPanel), permettre la modification/suppression sans passer par le panneau "Modifier". Boutons crayon + corbeille à côté de chaque entrée.
- **Mutuelle history** : aujourd'hui un patient a une seule mutuelle courante. Ajouter un historique (changements de couverture) avec date d'effet.

### RDV / nouveau patient inline (issu de 5.5b)
- **Mini-form étendu** : la version actuelle ne demande que prénom/nom/sexe/téléphone. Ajouter optionnel CIN + DDN au mini-form (toujours skippables) pour gagner un aller-retour quand l'info est connue à la réception.
- **Recherche fuzzy par téléphone** : la recherche patient actuelle est ILIKE. Quand un nouveau RDV est pris au téléphone, suggérer le patient existant si le téléphone matche partiellement (anti-doublon).

### Référentiels (issu de 5.5c + R4 du QA)
- **CRUD UI référentiels** dans Paramétrage : médecin doit pouvoir ajouter/désactiver/marquer favori médicaments, lab-tests, imaging-exams. Endpoints à créer : `POST/PUT/DELETE /api/catalog/medications`, idem labs/imaging. Onglet "Référentiels" dans `ParametragePage`.
- **Médicament favori** : la colonne `favorite` existe déjà (`catalog_medication.favorite`). UI : étoile cliquable, médicaments favoris remontent en tête de l'autocomplete.
- **Étendre les seeds** : 146 médicaments c'est déjà bien, mais une vraie base = ~2000+ produits enregistrés au Maroc. Importer depuis le Bulletin Officiel marocain ou une base AMM publique.
- **Synonymes / DCI alternatives** : le médecin tape "Doliprane" → trouve "Paracétamol" et inversement (déjà partiel via DCI search). Renforcer.
- **Codes NABM / CCAM officiels** : aujourd'hui codes maison (`NFS`, `CRP`, etc.). Aligner sur la nomenclature officielle (NABM Maroc, ou CCAM française à défaut).

### Prescription par type (issu de 5.5d)
- **PDF distinct par type** : aujourd'hui `PrescriptionPdfService` génère un seul template `ordonnance.html`. Ajouter `bon-analyses.html` + `bon-imagerie.html` avec leur propre header.
- **Modèles d'ordonnance pré-remplis** : "HTA de base", "Renouvellement diabète", etc. — le drawer prescription doit pouvoir piocher dans des modèles sauvegardés. Table `config_prescription_template` à créer.
- **Renouvellement 1-clic** : depuis l'onglet Prescriptions du dossier, bouton "Renouveler" qui duplique l'ordonnance avec date du jour.
- **Stupéfiants ordonnance sécurisée** : format légal marocain (déjà mentionné en Clinical).

### Agenda mois + congés (issu de 5.5e)
- **Drag-to-move optimistic** : explicitement skippé. Quand on aura besoin (cabinet à fort volume), implémenter avec `dnd-kit` (HTML5 drag natif chez Radix).
- **Vue mois multi-praticien** : aujourd'hui mono. Avec multi-cabinet, switch praticien dans la toolbar.
- **Congés multi-praticien** : aujourd'hui un médecin gère ses propres congés. Pour cabinet multi-praticien, vue agrégée "Qui est en congé cette semaine ?".
- **Congés overlap warning** (déjà listé plus haut dans Scheduling).
- **Saisie RDV durant congé** : aujourd'hui le booking est refusé (409). Permettre un override avec confirmation explicite ("ce médecin est en congé ce jour-là, confirmer ?") pour les urgences.

### Paramétrage (issu d'étape 6)
- **Onboarding 7-step wired** : l'écran 13 du prototype reste statique. Câbler aux endpoints `/api/admin/bootstrap` (step 1) + `PUT /api/settings/clinic` (steps 2-5) + `POST /api/admin/users` (step 6). Sans ça, chaque fresh install nécessite un curl manuel.
- **Document templates editor** : aujourd'hui le letterhead PDF est en dur dans `ordonnance.html`. Permettre au médecin d'éditer son en-tête (logo, signature image, mentions légales) depuis Paramétrage > Documents.
- **Mobile parity Paramétrage** : la page est desktop-only. Porter en `MParametrage` (tabs en bottom-sheet).
- **User edit (pas seulement create + désactiver)** : éditer email, password reset, ajouter/retirer un rôle. Endpoints existent (`PUT /admin/users/:id`, `PUT /admin/users/:id/password`).
- **Audit log UI** (déjà dans Admin & ops) — relevant ici car listé comme prochaine cible naturelle après users.

### Queue + Salle (issu d'étape 7)
- **Mobile parity Salle d'attente** avec champs enrichis (age/reason/practitioner/duration/Premium). La version mobile actuelle utilise une partie des champs.
- **Filtres queue** : aujourd'hui liste plate. Filtres par praticien, motif, statut une fois multi-praticien.
- **SSE real-time** (déjà listé Scheduling) : remplacerait le polling 15s actuel.

---

## QA wave 2 — 2026-04-26 (post-MVP retours terrain)

Format : **[BUG]** = comportement actuel ≠ ce qu'on aurait dû livrer (fix + post-mortem) · **[CHANGE]** = évolution de spec / nouvelle feature.

### QA2-1 — Date de naissance obligatoire à la création patient — **[BUG]**
- **État actuel** : `useCreatePatient` envoie `birthDate: form.birthDate || null` (`hooks/useCreatePatient.ts:58`). Le formulaire n'a pas de validation. Côté backend, `CreatePatientRequest.birthDate` est nullable.
- **Pourquoi le bug existait** : la spec WORKFLOWS.md ne marquait pas DDN comme requis explicitement, j'ai porté le prototype tel quel. Or la DDN est cliniquement essentielle (calcul d'âge → posologies pédiatriques/gériatriques, dépistage par âge). On ne peut **pas** soigner sans.
- **Fix prévu** : (a) zod `birthDate: z.string().min(1)` côté frontend + asterisk visible · (b) `@NotNull` côté backend `CreatePatientRequest.birthDate` + Flyway migration `ALTER TABLE patient ALTER COLUMN birth_date SET NOT NULL` (vérifier qu'aucun existant n'est null avant — `UPDATE` requis sinon).
- **Leçon** : pour chaque champ "optionnel", se demander "est-ce qu'un médecin peut prescrire sans ?". Si non, c'est obligatoire.

### QA2-2 — Upload historique patient (anciens docs : prescriptions, analyses, radios) — **[CHANGE / NEW FEATURE]**
- **Demande** : à la création d'un patient, pouvoir uploader des PDFs/images d'anciens documents fournis par d'autres médecins, classés par type (prescription / analyse / imagerie / autre).
- **Hors scope MVP** : aucun module fichier/upload n'existe (pas de S3/MinIO, pas de table `patient_document`).
- **Scope estimé** :
  - Backend : nouveau module `documents` — table `patient_document (id, patient_id, type {PRESCRIPTION_HISTORIQUE, ANALYSE_HISTORIQUE, IMAGERIE_HISTORIQUE, AUTRE}, original_filename, mime_type, size_bytes, storage_key, uploaded_at, uploaded_by, notes)`. Endpoints `POST /api/patients/{id}/documents` (multipart), `GET /api/patients/{id}/documents`, `GET /api/documents/{id}/content` (stream), `DELETE`. Limites : 10MB / fichier, types autorisés PDF/JPEG/PNG/HEIC.
  - Stockage : on-premise → disque local sous `/var/careplus/documents/<patient_id>/<doc_id>`. Backup auto OVH inclut ce dossier.
  - Frontend : zone drag-drop dans le panneau "Nouveau patient" (sous Antécédents) + tab Historique (cf QA2-4).
- **Lié à** : QA2-4 (l'onglet de visualisation est l'autre moitié de cette feature).

### QA2-3 — Clic sur plage horaire vide dans l'agenda → ouvre la dialog RDV pré-remplie — **[BUG]**
- **État actuel** : `AgendaGrid` rend des cellules `.ag-daycol` mais sans `onClick` sur les cellules vides (`components/AgendaGrid.tsx`). Seuls les blocs RDV existants sont cliquables → ouvrent `AppointmentDrawer`. Pour créer un RDV il faut cliquer "Nouveau RDV" en haut.
- **Pourquoi le bug existait** : le prototype avait l'interaction "click slot vide → dialog" implicite mais pas explicitement câblée dans le port JSX → React. Étape 5 a câblé "click sur RDV existant" mais n'a pas couvert le cas inverse.
- **Fix prévu** : ajouter `onSlotClick(day, hour, minute)` au `AgendaGrid` (calcul de la position via `clientY` − topOffset → minutes). Ouvrir `PriseRDVDialog` avec props `prefilledDate` + `prefilledTime`. Idem `MonthGrid` (clic sur jour vide → dialog avec date pré-sélectionnée). `PriseRDVDialog` doit accepter ces props et hydrater le formulaire.
- **Leçon** : "click on appointment block" est différent de "click on empty slot". Tester chaque interaction du prototype, pas juste "tester que ça compile".

### QA2-4 — Onglet "Historique" dans le dossier patient — **[CHANGE / NEW FEATURE]**
- **Demande** : nouvel onglet à côté des autres (Profil / Chronologie / Consultations / Prescriptions / Factures) listant tous les documents historiques uploadés à QA2-2, groupés par type, viewer inline (PDF / image).
- **Dépend de** : QA2-2 (le backend `patient_document` doit exister).
- **Scope estimé** : ajout d'un tab dans `DossierPage.tsx` (déjà 5 tabs). Hook `usePatientDocuments(patientId)`. Composants : groupement par type, thumbnail PDF (via `pdfjs-dist` déjà installé pour ordonnance), modal viewer plein écran, bouton télécharger, bouton supprimer (si l'utilisateur l'a uploadé).
- **À ne pas confondre** avec l'onglet Consultations qui montre les consultations **internes** au cabinet. "Historique" = ce qui vient d'**ailleurs**.

### QA2-5 — Barre de recherche du Topbar non fonctionnelle — **[BUG]**
- **État actuel** : `Topbar.tsx:31-42` rend le button `.cp-search` avec un callback `onSearchOpen` mais aucun `<Screen>` ne le passe. Aujourd'hui le clic ne fait **rien**, et `⌘K` non plus.
- **Pourquoi le bug existait** : J'ai porté Topbar avec la prop `onSearchOpen` en placeholder. La spotlight-search était notée "post-MVP" mais le bouton est resté visible → impression de feature cassée. C'est pire qu'absent.
- **Fix prévu** : (a) immédiat → court-circuiter en redirigeant vers `/patients?q=` (la liste patients sait déjà filtrer). (b) propre → composant `PatientSearchSpotlight` (Radix Dialog modale top-anchored), debounce 200ms sur `GET /api/patients?q=&size=8`, résultats en liste cliquable (clic → `/patients/:id`), raccourci `⌘K` global. Câbler dans `Screen` via `onSearchOpen={() => setSpotlightOpen(true)}`.
- **Leçon** : ne jamais shipper un bouton/CTA visible sans handler. Soit on le câble, soit on le cache derrière un feature flag. "Disabled with tooltip 'bientôt'" reste mieux que "rien ne se passe".

### QA2-6 — Upload photo patient + scan CIN à la création — **[CHANGE / NEW FEATURE]**
- **Demande** : champs upload photo patient (avatar) + photo CIN (recto + verso) dans le formulaire "Nouveau patient".
- **Lien légal** : copie CIN exigée par certaines mutuelles + assurances. Photo patient utile pour identification visuelle en salle d'attente.
- **Scope estimé** :
  - Backend : étendre table `patient` avec `photo_storage_key` + `cin_recto_storage_key` + `cin_verso_storage_key` (ou réutiliser `patient_document` de QA2-2 avec types `PHOTO`, `CIN_RECTO`, `CIN_VERSO`). Recommandé : réutiliser pour cohérence.
  - Validation : photo carrée 1:1 max 2MB, CIN PDF/JPEG max 5MB.
  - Frontend : 3 zones drag-drop dans le panneau "Nouveau patient", preview thumbnail. Avatar lit la photo au lieu d'initiales si présente.
  - **Sécurité** : la CIN est une donnée d'identité forte ; vérifier que `GET /documents/{id}/content` exige le bon `patient.id` dans l'auth context.

### Priorisation suggérée
1. **QA2-5** (Topbar search) — quick win 4h, impacte tous les écrans.
2. **QA2-3** (clic agenda → dialog) — quick win 4h, gros gain UX.
3. **QA2-1** (DDN obligatoire) — quick win 1h, gain qualité données.
4. **QA2-2 + QA2-4 + QA2-6** (module documents) — bundle ~3 jours, à faire ensemble car ils partagent le backend `patient_document`.

## QA wave 3 — 2026-04-26 (sécurité + ergonomie patient + RBAC granulaire)

### QA3-1 — Secrétaire ne doit pas avoir accès à `/parametres` — **[BUG]**
- **État au moment du report** : la route `/parametres` était wrappée par `RequireAuth` seulement (`lib/router/routes.tsx:158`) → toute session valide pouvait y accéder. Le bouton "Paramètres" du Sidebar était également visible pour tous les rôles. Côté backend, `GET /api/settings/clinic` + `GET /api/settings/tiers` autorisaient `SECRETAIRE` et `ASSISTANT` (héritage défensif "lecture pour tous").
- **Pourquoi le bug existait** : étape 6 du sprint MVP a livré la page Paramétrage **sans** garde de rôle frontend, en supposant que les PUT-seulement protégés au backend (MEDECIN/ADMIN) suffiraient. Mais le QA juge à juste titre que **voir** les tarifs / la liste utilisateurs est déjà une fuite. Pas de privilège minimum sur la lecture.
- **Fix livré** : (a) nouveau composant `RequireRole` (`lib/auth/RequireAuth.tsx`) qui bounce vers `/agenda` si l'utilisateur n'a pas l'un des rôles requis · (b) route `/parametres` wrappée en `RequireRole roles={['ADMIN','MEDECIN']}` · (c) Sidebar filtre l'item Paramètres si aucun rôle ne match · (d) backend `SettingsController` GET clinic + GET tiers durcis à `MEDECIN/ADMIN` seulement (les seuls consommateurs sont déjà la page Paramétrage).
- **Leçon** : "lecture autorisée pour tous" n'est pas un défaut sûr. Pour chaque GET, se poser la question "ce rôle a-t-il un usage légitime de cette donnée ?" — sinon, on durcit. Privilege minimum côté backend, garde de route côté frontend, **les deux**.

### QA3-2 — Formulaire patient : 2 onglets Personnel / Médical — **[CHANGE]**
- **Demande** : dans `PatientsListPage` panneau "Nouveau patient" + dossier patient édition, séparer en 2 onglets :
  - **Personnel** : prénom/nom, sexe, DDN, CIN, téléphone, email, ville, statut marital, profession, nb enfants, mutuelle, tier (Premium/Normal).
  - **Médical** : groupe sanguin, allergies, antécédents, notes médicales générales.
- **Pourquoi c'est un CHANGE et pas un BUG** : le formulaire actuel mélange tout dans un panneau scrollable de ~440px. C'est fonctionnel mais long. La séparation est une amélioration ergo, pas un défaut bloquant.
- **Scope estimé** : Radix Tabs sur le panneau ; reuse Field/Input/Textarea ; les sections existantes deviennent des `Tabs.Content`. Aucun changement backend ni schéma. ~3h.
- **Note implémentation** : profiter du refactor pour aligner avec `DossierPage` (lecture) qui a déjà des sections logiques équivalentes. Faire les 2 d'un coup.

### QA3-3 — RBAC granulaire (matrice rôle × fonctionnalité éditable) — **[CHANGE / BIG FEATURE]**
- **Demande** : l'admin/médecin doit pouvoir cocher/décocher pour chaque rôle (`SECRETAIRE`/`ASSISTANT`/etc.) l'accès à chaque fonctionnalité :
  - Création/modification patient
  - Consultation du planning (lecture agenda)
  - Création de rendez-vous
  - Démarrer une consultation (prise de constantes)
  - Déclarer arrivée patient
  - Consulter détails patient (lecture dossier)
  - Accéder au module facturation
  - … et toute autre fonctionnalité futurement ajoutée.
- **État actuel** : RBAC **codé en dur** au niveau Spring `@PreAuthorize("hasRole(...)")` × ~50 endpoints. Toute customisation = recompilation.
- **Pourquoi c'est un CHANGE majeur** : transforme careplus d'un système à 4 rôles fixes vers un système à **permissions atomiques** (~30+ permissions) + **rôles = ensembles de permissions modifiables**. C'est une refonte du modèle d'autorisation, pas un fix.
- **Scope estimé (≥1 sprint complet)** :
  - **Backend** :
    - Nouvelle table `identity_permission` (`code`, `label_fr`, `category`) seedée avec ~30 codes (`PATIENT_CREATE`, `PATIENT_READ`, `APPOINTMENT_CREATE`, `VITALS_RECORD`, `INVOICE_READ`, `INVOICE_ISSUE`, `SETTINGS_READ`, etc.).
    - Nouvelle table `identity_role_permission` (n-n) — initialement seedée avec les défauts qui reproduisent l'autorisation actuelle.
    - Nouvel endpoint `GET/PUT /api/admin/roles/:code/permissions` (ADMIN-only).
    - Réécriture du `@PreAuthorize` : remplacer `hasRole('MEDECIN')` par `hasAuthority('PERM_INVOICE_READ')`, et alimenter `Authentication.getAuthorities()` depuis la table de jointure au login (au lieu des codes de rôle).
    - Migration : à chaque endpoint, mapper `hasRole(X)` → `hasAuthority(PERM_Y)`. Audit checklist sur les ~50 endpoints.
  - **Frontend** :
    - Nouvelle table de matrice dans `ParametragePage` (5e onglet "Droits d'accès") : lignes = permissions groupées par catégorie, colonnes = rôles, cases à cocher.
    - `useAuthStore` étend `AuthUser` avec `permissions: string[]` (vient du `/users/me`).
    - Composant `RequirePermission` (en plus de `RequireRole`) pour cacher des CTAs ("Nouveau RDV", "Encaisser facture", etc.) si la permission manque.
- **Risques** :
  - Régression sécurité au moment de la migration "rôles → permissions" (il suffit qu'un mapping soit oublié et un endpoint devient ouvert).
  - **Tester chaque endpoint** avec une matrice complète SECRETAIRE/ASSISTANT/MEDECIN/ADMIN avant et après — comparer les 200/403 expected.
  - Chargement perf : penser au cache des permissions par rôle (Redis ou cache local Spring).
- **Compromis MVP-bis possible** : avant la refonte complète, un **switch global "ASSISTANT lit dossier ?"** + 3-4 toggles fréquemment demandés peuvent faire patience. Mais la demande QA est explicite "ensemble des fonctionnalités" → refonte complète à terme.
- **Estimation** : 6-8 jours dev + 2 jours tests régression de sécurité.

### Priorisation QA3
1. **QA3-1** — déjà livré ce sprint (ligne au-dessus).
2. **QA3-2** — quick-win 3h, à inclure dans le bundle "documents patient" (QA2-2/4/6) car ce panneau sera de toute façon refactoré pour ajouter les zones d'upload photo + CIN.
3. **QA3-3** — sprint dédié post-pilote. Pas de raison de retarder le pilote pour une refonte RBAC ; les 4 rôles actuels couvrent 95% des cas. Marquer pour v0.3.0.

## Clinical

- Consultation amendment (v2, v3… chain) with full audit trace
- Out-of-range vitals alerts (configurable thresholds per cabinet)
- Graphs of vitals over time (weight, blood pressure, glycemia)
- Stupéfiants / psychotropes: enforced ordonnance sécurisée legal format (Moroccan requirements)
- Ordonnance renewal in 1 click for chronic patients
- Chronic condition follow-up module (diabetes HbA1c trend, HTA, asthma peak-flow)
- Vaccination schedule + reminders
- Lab results inbound: mark analysis as "result received", attach PDF, flag doctor
- ICD-10 diagnosis coding (optional autocomplete)
- Templates per consultation type (first visit, follow-up, certificate, vaccination)
- Clinical exam templates by appareil (cardio, pulm, abdo, neuro, ORL)
- Generated courrier de liaison to specialist

## Scheduling & presence

- **Email reminder batch** : cron J-1 (et J-7 pour les contrôles) qui envoie un email au patient pour lui rappeler son rendez-vous (nouvelle consultation ou visite de contrôle planifiée). Provider email abstrait (SMTP cabinet ou SaaS comme Brevo/Mailjet). Template bilingue FR/AR. Opt-out patient gérable depuis le dossier. Lié à `AppointmentType` (CONSULTATION | CONTROLE | URGENCE) — le type `CONTROLE` est créé lors de la planification du contrôle en fin de consultation (voir WORKFLOWS.md WF4).
- SMS reminder cron J-1 with opt-in patient response parsing
- Waiting-list with auto-notify on cancellation
- Recurring appointments (chronic patient every 3 months)
- Holiday calendar auto-imported yearly from Moroccan official list
- SSE real-time queue (replace polling)
- Waiting-room display screen (tablet view with "next patient")
- No-show counter per patient, flag after 3 consecutive
- **Mobile congé screen** : port `/parametres` leave management to mobile (CongesPage.mobile.tsx). Low-priority since secretaries manage this on desktop.
- **Congé overlap warning** : when creating a new leave that overlaps an existing confirmed appointment, show a warning listing the affected appointments (don't auto-cancel, just inform). Requires a query joining `scheduling_appointment` with the new leave date range.

## Multi-practitioner cabinet

- **Practitioner selector in PriseRDVDialog** : when a cabinet has more than one doctor, the secretary needs to pick which doctor the RDV is for. Currently `practitionerId` is always the logged-in user. Add a `<Select>` in step 2 of the dialog populated from `GET /api/practitioners` (new endpoint listing active identity_user with MEDECIN role).
- **Multi-practitioner agenda view** : allow switching between practitioners in the agenda toolbar (or a side-by-side day view). A secretary should be able to see all doctors' agendas at once.
- **Practitioner management screen** : ADMIN screen to create/deactivate practitioners, set working hours per practitioner (currently working hours are cabinet-global), and assign roles.
- **Per-practitioner revenue split** : moved here from Billing — relevant only once multi-practitioner is wired.

## Billing

- Feuille de soins AMO (CNSS, CNOPS, private mutuelles) PDF generation
- Cash register daily close (rapport Z) with per-mode totals
- Insurance claim tracking (generated, submitted, reimbursed, rejected)
- Devis (quote for non-reimbursed acts)
- Relance impayés workflow
- VAT paramétrable per act
- Per-practitioner revenue split (when cabinet → clinic with multiple doctors)

## Pregnancy vertical

- Full pregnancy module (declaration, plan, visits, biometrics, alerts, closure)
- Ultrasound result capture
- Bio panel tracking per trimester
- Auto-create child record on delivery

## Documents & files

- **Ancien dossier patient** : lors de la création d'un patient, permettre de joindre des documents existants (anciennes prescriptions, comptes-rendus radio, bilans biologiques). Nécessite : table `patient_document` (id, patient_id, category enum PRESCRIPTION/RADIO/BIOLOGIE/AUTRE, filename, content_type, stored_path, uploaded_at, uploaded_by), endpoint `POST /patients/{id}/documents` (multipart), `GET /patients/{id}/documents`, stockage local configurable (répertoire `data/documents/` sur l'on-prem, path relatif stocké en base). Côté frontend : section "Documents apportés" dans le panneau Nouveau patient (upload via `<input type=file multiple>`, preview liste nom+type), plus tab "Documents" dans le dossier patient.
- Patient document uploads (scans, photos, PDFs)
- Drag-drop from device camera (mobile PWA)
- WYSIWYG template editor with variable picker
- Multiple templates per document type + selection at print time
- Watermark "copie" on reprinted invoices

## Notifications

- Email + SMS integration (provider abstraction, Moroccan SMS provider)
- In-app notifications center per user
- WhatsApp share link for PDFs (deep link with pre-filled message)

## Admin & ops

- Audit log UI with filters (user, action, entity, date range)
- Backup cloud: daily dump, encryption, upload, rotation, alerts
- Restore from cloud button in admin UI
- Auto-update mechanism (check → download → backup → migrate → restart)
- License module (activation key, feature flags, expiration)
- Multi-language UI (Arabic RTL v2, other Maghreb countries v3)
- Full-text search patient cross-field (tsvector-powered)
- Dashboard: activity KPIs, medical KPIs, financial KPIs, waiting time

## Public landing page — separate deliverable (planned 2026-04-24)

User plans a public marketing landing page (`/` on the apex domain) that introduces careplus to prospective cabinets. Should NOT live inside `frontend/` — different audience, different SEO/perf needs, different deploy cadence.

**Recommended architecture:**
- Separate Vite + React (or Astro, which is better for marketing sites because it ships zero JS by default — worth a 15-min spike when we start).
- Deployed to **Vercel** or **Netlify** free tier — both keep the landing page always-on (no cold starts, critical for first impressions) and are independent from the app's Render deploy.
- DNS split: `careplus.ma` (apex) → landing page, `app.careplus.ma` → the SICM on Render.
- Reuse tokens: copy `frontend/src/styles/tokens.css` verbatim so the landing page visually matches the product (same Clinical Blue, same type scale). Consider extracting tokens to a tiny `@careplus/tokens` npm package if we ever have a third surface.
- Content: Moroccan market positioning, loi 09-08 compliance, cabinet testimonials post-pilot, pricing (eventually), contact/demo request form (wired to a Google Sheet via Formspree free tier, or to a `/api/public/contact` endpoint added then).

**NOT recommended:**
- Stuffing marketing pages into the existing `frontend/` app — unnecessary bundle bloat, mixes audiences, ties SEO to the auth-gated SPA.
- Hosting the landing page on Render free — cold starts would ruin first impressions.

## Frontend — moved into MVP scope 2026-04-24

Was "Angular 17 + PrimeNG after backend MVP". Superseded by the hi-fi React prototype delivered from Claude Design (see `design/prototype/` + `design/HANDOFF.md`). Frontend stack changed to **React 18 + Vite + TypeScript** to port the prototype pixel-perfectly. Scope added to `SPRINT_MVP.md` as J8–J10. Remaining post-MVP FE items:

- Generated TypeScript client from OpenAPI spec (nice-to-have; MVP ports screens against hand-rolled fetch hooks first)
- NgRx Signals / Zustand state management audit (after pilot feedback)
- PWA offline-light mode (read-only historical data if backend unreachable)
- i18n layer (Arabic RTL)
- Storybook + Chromatic visual regression (after primitive library stabilises)

## Packaging & distribution

- jpackage Windows installer (.exe, signed MSI)
- Embedded JRE + embedded Postgres installer
- Windows services auto-start
- Uninstaller
- Docker image for cloud deployment
- Helm chart (if any cabinet chain ever needs k8s)

## Compliance

- CNDP declaration template
- Patient consent capture at creation
- Right-of-access export (ZIP of dossier)
- Right-to-be-forgotten: anonymization job
- 10-year retention policy enforcement

## Not in our plan but worth considering

- Teleconsultation (WebRTC) — only if market demand clear, high maintenance cost
- E-prescription national (does not exist in Morocco 2026 — watch)
- Pharmacovigilance reporting to CAPM (adverse effects declaration)
- Integration with Moroccan health insurance electronic claims (none live in 2026)

## How to add an entry

Append under the right theme. No dates, no owners — this is a holding pen until prioritized. When an item is pulled into a sprint, move it to `SPRINT_<NAME>.md` and delete from this file.
