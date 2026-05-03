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
