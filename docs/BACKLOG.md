# Post-MVP backlog

Anything explicitly out of the MVP goes here. Append-only list of ideas/features/gaps, grouped by theme. Decide priority at MVP exit.

> **Status MVP — `v0.1.0-mvp` taggé sur `467e4f7` (2026-04-26).** Plan en 8 étapes + 5 sous-étapes QA livré intégralement. Voir `docs/MVP_WIRING.md` pour le détail commit-par-commit. Les items ci-dessous sont **post-pilote** : à prioriser après retour terrain.

## QA-driven follow-ups (extensions des features livrées dans le sprint MVP-wiring)

Chaque QA item livré a parfois laissé un **prolongement** non-bloquant. Tracé ici pour ne pas être oublié quand un cabinet pilote demandera l'évolution naturelle.

### Patient (issu de QA P1–P5)
- ~~**Mobile parity du panneau "Nouveau patient"**~~ — **livré 2026-04-26** (commits `8f78428` + `a92648f` — création + édition patient sur mobile, regression auto Playwright).
- **Tier discount mode fixe (MAD) en plus du %** : actuellement `config_patient_tier.discount_percent` uniquement. Ajouter colonne `discount_amount` + UI Tarifs avec radio Pourcentage/Forfait. Demande potentielle de cabinets qui font un rabais fixe (50 MAD) plutôt que %.
- **Tiers personnalisés** : aujourd'hui figés à NORMAL/PREMIUM. Ajouter `GOLD`, `STAGIAIRE`, `FAMILLE`, etc. avec tiering éditable depuis Paramétrage.
- **Antécédents in-place edit** : depuis le dossier (tab Chronologie / SummaryPanel), permettre la modification/suppression sans passer par le panneau "Modifier". Boutons crayon + corbeille à côté de chaque entrée.
- **Mutuelle history** : aujourd'hui un patient a une seule mutuelle courante. Ajouter un historique (changements de couverture) avec date d'effet.

### RDV / nouveau patient inline (issu de 5.5b)
- **Mini-form étendu** : la version actuelle ne demande que prénom/nom/sexe/téléphone. Ajouter optionnel CIN + DDN au mini-form (toujours skippables) pour gagner un aller-retour quand l'info est connue à la réception.
- **Recherche fuzzy par téléphone** : la recherche patient actuelle est ILIKE. Quand un nouveau RDV est pris au téléphone, suggérer le patient existant si le téléphone matche partiellement (anti-doublon).

### Référentiels (issu de 5.5c + R4 du QA)
- ~~**CRUD UI référentiels**~~ — **livré** : médicaments via commit `a2207f5` (2026-04-29) + `f011aff`/`6431cb4` lab-tests + imaging-exams (QA6-4, 2026-05-02) + `2a9113a` recyclage code après soft-delete. Page `/catalogue` 4 onglets opérationnelle. Pas dans `ParametragePage` (choix : page dédiée plus large), reste à câbler le marquage « favori » dans l'autocomplete (le champ `favorite` existe et est éditable, mais l'autocomplete ne re-priorise pas encore).
- **Médicament favori — autocomplete priorité** 🟡 PARTIEL : édition du flag `favorite` câblée dans `/catalogue` (`CataloguePage.tsx`). Reste à faire : étoile cliquable inline (UX 1-clic) + tri `favorite DESC` dans l'autocomplete `/medications` du `PrescriptionDrawer`.
- **Étendre les seeds** 🟡 PARTIEL — V011 (commit `a2207f5`, 2026-04-29) seede ~180 médicaments commercialisés au Maroc avec tags pharmacologiques alignés sur `patient_allergy`. Le seed se déplace de `db/seed` (dev only) vers `db/migration` (prod). Reste à atteindre les ~2000+ produits AMM (import Bulletin Officiel ou base publique). L'ADMIN peut maintenir le référentiel via `POST/PUT/DELETE /api/catalog/medications` + écran `/catalogue`.
- **Synonymes / DCI alternatives** : le médecin tape "Doliprane" → trouve "Paracétamol" et inversement (déjà partiel via DCI search). Renforcer.
- **Codes NABM / CCAM officiels** : aujourd'hui codes maison (`NFS`, `CRP`, etc.). Aligner sur la nomenclature officielle (NABM Maroc, ou CCAM française à défaut).

### Prescription par type (issu de 5.5d)
- **PDF distinct par type** : aujourd'hui `PrescriptionPdfService` génère un seul template `ordonnance.html`. Ajouter `bon-analyses.html` + `bon-imagerie.html` avec leur propre header.
- **Modèles d'ordonnance pré-remplis** : "HTA de base", "Renouvellement diabète", etc. — le drawer prescription doit pouvoir piocher dans des modèles sauvegardés. Table `config_prescription_template` à créer.
- **Renouvellement 1-clic** : depuis l'onglet Prescriptions du dossier, bouton "Renouveler" qui duplique l'ordonnance avec date du jour.
- **Stupéfiants ordonnance sécurisée** : format légal marocain (déjà mentionné en Clinical).

### Agenda mois + congés (issu de 5.5e)
- ~~**Drag-to-move optimistic**~~ — **livré 2026-04-26** (commit `dcb0f86`). Drag natif HTML5 sur les `.ag-block`, snap 5 min, optimistic move + rollback sur 4xx.
- **Vue mois multi-praticien** : aujourd'hui mono. Avec multi-cabinet, switch praticien dans la toolbar.
- **Congés multi-praticien** : aujourd'hui un médecin gère ses propres congés. Pour cabinet multi-praticien, vue agrégée "Qui est en congé cette semaine ?".
- **Congés overlap warning** (déjà listé plus haut dans Scheduling).
- **Saisie RDV durant congé** : aujourd'hui le booking est refusé (409). Permettre un override avec confirmation explicite ("ce médecin est en congé ce jour-là, confirmer ?") pour les urgences.

### Paramétrage (issu d'étape 6)
- **Onboarding 7-step wired** 🟡 PARTIEL — livré 2026-04-26 (commit `dcb0f86`) en wizard 4 étapes câblées : Cabinet (`PUT /api/settings/clinic`) → Tarifs (`PUT /api/settings/tiers/PREMIUM`) → Équipe (`POST /api/admin/users` en boucle) → Récap → `/agenda`. Steps « Horaires » + « Documents » du prototype intentionnellement skippés (pas de backend `config_working_hours` ni `document_template` — voir items dédiés ci-après).
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

### QA2-1 — Date de naissance obligatoire à la création patient — **[BUG]** ✅ LIVRÉ 2026-04-26 (commit `a75c7d1`)
- **Livré** : validation frontend DDN required + `max=today` sur les 2 paths (panneau "Nouveau patient" + mini-form `PriseRDVDialog`). Backend ajoute `@Past` sur `birthDate` (reste nullable côté API pour ne pas casser les ITs qui seedent par firstName/lastName seuls). `useCreatePatient` n'envoie plus de fallback null.
- **Leçon** : pour chaque champ "optionnel", se demander "est-ce qu'un médecin peut prescrire sans ?". Si non, c'est obligatoire.

### QA2-2 — Upload historique patient (anciens docs : prescriptions, analyses, radios) — **[CHANGE / NEW FEATURE]** ✅ LIVRÉ 2026-04-27
- **Demande initiale** : à la création/modification d'un patient, pouvoir uploader des PDFs/images d'anciens documents fournis par d'autres médecins, classés par type (prescription / analyse / imagerie / autre).
- **Re-confirmé en QA wave 4 (2026-04-27)** : "Dans la partie informations medicale je ne retrouve pas la possibilité de telecharger sur le serveur les document relatifs aux anciennes prescriptions, resultat d'analyses, de radio, compte rendu …"
- **Livré** :
  - Backend : module `ma.careplus.documents` — V009 + entité `PatientDocument` + service + 4 endpoints (`POST /api/patients/{id}/documents`, `GET /api/patients/{id}/documents`, `GET /api/documents/{id}/content`, `DELETE /api/documents/{id}`). Whitelist MIME stricte (PDF/JPEG/PNG/WebP/HEIC). Plafond 10 Mo via `spring.servlet.multipart.max-file-size`. Soft-delete via `deleted_at`. IT couvre upload + list + download + 415 (mime rejeté) + 400 (type inconnu) + 403 (assistant) + 204 (delete medecin) + 404 (patient inconnu).
  - Stockage : `DocumentStorage` — filesystem local sous `careplus.documents.root` (défaut `./data/documents`, fallback `${java.io.tmpdir}/careplus-documents` pour les ITs). Clé : `<patient_id>/<doc_id>.<ext>`. Garde-fou contre path traversal (vérifie que la clé reste sous root après normalisation).
  - Frontend : `usePatientDocuments` hook (TanStack Query, multipart) + `DocumentsPanel` réutilisable. Branché dans (a) onglet "Documents" du dossier (toutes catégories + chips de filtre), (b) onglets "Analyses" + "Imagerie" pré-filtrés, (c) onglet "Informations médicales" du panneau Modifier (variante `compact`). Téléchargement via blob (le JWT est en mémoire, pas en cookie HttpOnly → `window.open` ne suffit pas).
- **Choix de design notés** :
  - Pas de S3/MinIO pour le MVP : déploiement on-premise (ADR-020), un disque local + backup OVH (déjà prévu post-MVP) suffit. Migrer vers S3 plus tard ne casse que `DocumentStorage`.
  - Permissions alignées sur la matrice RBAC v1 : upload via `PATIENT_CREATE` (assistant lecture-seule), delete réservé MEDECIN/ADMIN.
  - Pas d'antivirus inline (ClamAV) : ajouterait une dépendance native, hors scope. Tracé dans `Risques sécurité` ci-dessous.
- **Limites connues à itérer plus tard** :
  - Pas de drag-drop visuel (juste `<input type=file>`) — esthétique seulement.
  - Pas de prévisualisation in-app (le clic télécharge, le navigateur prend le relais pour l'ouverture).
  - Impossible d'uploader pendant la création d'un patient (le panneau "Nouveau patient" doit d'abord créer le record). À ajouter en post-create flow ("voulez-vous ajouter des documents ?") quand un cabinet pilote en ressentira le besoin.
- **Pourquoi le manque existait initialement** : le périmètre MVP (`SPRINT_MVP.md`) ne listait pas la gestion documentaire. Les onglets Analyses/Imagerie/Documents étaient des placeholders compilés dans le port du prototype. Le vrai signal terrain est arrivé via QA wave 2 — feature livrée immédiatement après confirmation en wave 4.

### QA2-3 — Clic sur plage horaire vide dans l'agenda → ouvre la dialog RDV pré-remplie — **[BUG]** ✅ LIVRÉ 2026-04-26 (commit `a75c7d1`)
- **Livré** : `AgendaGrid` reçoit `onSlotClick(dayKey, "HH:mm")`, snap 5 min depuis `clientY`, ignore les clicks bubblés depuis un `.ag-block` existant. `AgendaPage.isoOfDayKey()` reconstruit la date ISO à partir du `dayKey + weekOffset` et alimente `rdvPrefill`. `PriseRDVDialog` accepte `prefilledDate` (ISO) + `prefilledTime`, convertit en dd/MM/yyyy et positionne le calendrier.
- **Leçon** : "click on appointment block" est différent de "click on empty slot". Tester chaque interaction du prototype, pas juste "tester que ça compile".

### QA2-4 — Onglet "Historique" dans le dossier patient — **[CHANGE / NEW FEATURE]**
- **Demande** : nouvel onglet à côté des autres (Profil / Chronologie / Consultations / Prescriptions / Factures) listant tous les documents historiques uploadés à QA2-2, groupés par type, viewer inline (PDF / image).
- **Dépend de** : QA2-2 (le backend `patient_document` doit exister).
- **Scope estimé** : ajout d'un tab dans `DossierPage.tsx` (déjà 5 tabs). Hook `usePatientDocuments(patientId)`. Composants : groupement par type, thumbnail PDF (via `pdfjs-dist` déjà installé pour ordonnance), modal viewer plein écran, bouton télécharger, bouton supprimer (si l'utilisateur l'a uploadé).
- **À ne pas confondre** avec l'onglet Consultations qui montre les consultations **internes** au cabinet. "Historique" = ce qui vient d'**ailleurs**.

### QA2-5 — Barre de recherche du Topbar non fonctionnelle — **[BUG]** ✅ LIVRÉ 2026-04-26 (commit `a75c7d1`)
- **Livré** : composant `PatientSearchSpotlight` (Radix Dialog top-anchored), debounce 200 ms sur `GET /api/patients?q=`, navigation clavier ↑↓↵, raccourci `⌘K` / `Ctrl+K` global, navigation full-reload vers `/patients/:id` (évite la dépendance à Router/QueryClient au niveau du shell). `Screen` monte le spotlight et passe `onSearchOpen` au `Topbar` — le bouton `.cp-search` a maintenant un handler.
- **Leçon** : ne jamais shipper un bouton/CTA visible sans handler. Soit on le câble, soit on le cache derrière un feature flag. "Disabled with tooltip 'bientôt'" reste mieux que "rien ne se passe".

### QA2-6 — Upload photo patient + scan CIN à la création — **[CHANGE / NEW FEATURE]** 🟡 PARTIEL — photo livrée via QA5-3 (2026-05-01), CIN recto/verso encore à faire
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

### QA3-2 — Formulaire patient : 2 onglets Personnel / Médical — **[CHANGE]** ✅ LIVRÉ 2026-04-26 (commits `6d867bb` + `9f89596`)
- **Livré** : `NewPatientPanel` et `EditPatientPanel` ont 2 onglets — Personnel (identité, DDN, CIN, contact, ville, tier, mutuelle) et Médical (groupe sanguin, allergies, antécédents, notes libres). Validation auto-bascule vers l'onglet de l'erreur. Aucun changement de payload backend ni de schéma — pure refonte UX.

### QA3-3 — RBAC granulaire (matrice rôle × fonctionnalité éditable) — **[CHANGE / BIG FEATURE]** 🟡 v1 LIVRÉE 2026-04-26 (commits `6d867bb` + `9f89596`)
- **Livré v1** : V008 crée `identity_role_permission` seedée avec **8 permissions** × 4 rôles (`PATIENT_CREATE`, `PATIENT_READ`, `APPOINTMENT_CREATE`, `APPOINTMENT_READ`, `ARRIVAL_DECLARE`, `VITALS_RECORD`, `INVOICE_READ`, `INVOICE_ISSUE`). Endpoints `GET/PUT /api/settings/role-permissions[/{roleCode}]` (MEDECIN/ADMIN). `/users/me` retourne `permissions` (union des perms granted des rôles). UI : matrice dans Paramétrage > Droits, composant `RequirePermission` qui cache/garde les CTAs (Nouveau patient, Modifier dossier, Marquer arrivé, Prendre constantes, etc.) selon les permissions de la session. V014 ajoute `DOCUMENT_IMPORT_ADMIN` (squelette QA5-1).
- **Reste à faire pour v2 complète** : étendre la couverture aux ~50 endpoints (aujourd'hui seules les 8 perms ci-dessus + `DOCUMENT_IMPORT_ADMIN` sont câblées en `@PreAuthorize`), remplacer les `hasRole(X)` restants par `hasAuthority(PERM_Y)`, ajouter perms manquantes (`INVOICE_PAYMENT`, `PRESCRIPTION_SIGN`, `CONSULTATION_AMEND`, `CATALOG_MANAGE`, `STOCK_*`, `PRESCRIPTION_TEMPLATE_MANAGE`, `TELECONSULTATION_*`…). Sprint dédié post-pilote.

**Demande initiale (conservée pour référence)** :
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

## QA wave 5 — 2026-05-01 (import auto + capture caméra)

### QA5-1 — Import automatique de documents médicaux (prescriptions / analyses / imagerie) + permission "Administration de l'import" — **[CHANGE / BIG FEATURE]**
- **Demande (Youssef Boutaleb, 2026-05-01)** : étendre QA2-2 (upload manuel) avec un canal d'**import automatique** : prescriptions, comptes-rendus radio, résultats d'analyses arrivent dans le dossier patient sans intervention manuelle. Ajouter aussi le **droit d'administration de l'import** dans la page des droits (matrice RBAC).
- **État actuel** : seul l'upload manuel multipart (QA2-2) existe. Aucun connecteur entrant. La matrice de droits (`SettingsPage > Droits` + endpoint `PUT /settings/role-permissions/{roleCode}`) liste les permissions atomiques (`PATIENT_CREATE`, `INVOICE_READ`…) mais aucune ne couvre la couche import.
- **Pourquoi c'est un CHANGE majeur** : transforme careplus d'un système à entrée 100% manuelle vers un hub d'agrégation documentaire. Implique :
  - Un **modèle d'extension de connecteurs** (laboratoire X, RIS Y, futur PMI national) : interface Java `DocumentImportSource` + registration Spring + paramétrage par cabinet.
  - Premier connecteur réaliste pour le marché marocain 2026 : **boîte mail dédiée** (`docs+cabinetX@careplus.ma`) que des labos partenaires mettent en CC sur leurs envois PDF. Un job poll IMAP → parse pièce jointe → match patient (CIN > nom+DDN > nom+téléphone) → création `patient_document` typé. Pas de standard HL7/FHIR national à adresser au Maroc en 2026.
  - **File d'imports en attente de validation** : si le matching est ambigu, le document atterrit dans une corbeille "Imports à classer" — **jamais** attaché automatiquement au mauvais patient.
- **Permission RBAC associée** : nouvelle permission `DOCUMENT_IMPORT_ADMIN` (configurer les sources entrantes, valider/rejeter les imports en attente, consulter les logs de routage). Distincte de `DOCUMENT_UPLOAD` (upload manuel, déjà accordé à la secrétaire). Défaut MEDECIN + ADMIN, éditable depuis la matrice de droits (cocher/décocher par rôle, comme le reste).
- **Scope estimé** :
  - Backend : entités `document_import_source` (type ENUM `EMAIL_INBOX` | `FOLDER_WATCH` | `HTTP_WEBHOOK`, config JSON, enabled, last_run_at) et `document_import_inbox` (raw_file_key, parsed_metadata JSON, matched_patient_id NULL, status `PENDING_REVIEW` | `MATCHED` | `REJECTED`, created_at, reviewed_by, reviewed_at). Service `DocumentImportService` (poll + match). Endpoints `GET /api/imports/inbox?status=`, `PUT /api/imports/inbox/{id}/assign?patientId=`, `DELETE /api/imports/inbox/{id}`, `GET/POST/PUT/DELETE /api/imports/sources` (admin-only). Permission `DOCUMENT_IMPORT_ADMIN` ajoutée à la table `identity_permission` + seedée dans `identity_role_permission` pour MEDECIN/ADMIN.
  - Frontend : nouvel onglet "Sources d'import" dans Paramétrage (gérer les boîtes mail / dossiers surveillés), écran dédié `/imports` listant la corbeille à classer (matching ambigu → bouton "Assigner à patient X"), badge nombre d'imports en attente dans Topbar (refresh polling 30s ou SSE quand on l'aura). Case `DOCUMENT_IMPORT_ADMIN` dans la matrice de droits.
  - Intégration : le 1er connecteur (mail IMAP) doit être **désactivable** ; pas obligatoire au déploiement d'un cabinet sans labo partenaire.
- **Risques** :
  - Qualité du matching : un mauvais routage attache un résultat d'analyses au mauvais patient → grave médicalement. **Toujours préférer la queue manuelle au matching auto incertain.** Seuil par défaut : matching auto seulement si CIN exact + (nom OU DDN) match.
  - Volume : un laboratoire actif peut envoyer 50+ docs/jour. Pagination + cleanup `PENDING_REVIEW > 30j`.
  - Sécurité : un mail entrant non authentifié peut être un phishing. Whitelister les expéditeurs par cabinet (champ `allowed_senders` sur `document_import_source`).
- **Estimation** : 5-7 jours backend (sans connecteur HTTP webhook standardisé), 3-4 jours frontend, 1 jour permission + tests RBAC. Total ≈ 10 jours.
- **Lien** : étend QA2-2 (réutilise `patient_document`), s'aligne sur QA3-3 (matrice RBAC granulaire) — si QA3-3 n'est pas encore livré, hardcoder la permission MEDECIN/ADMIN au 1er ship et la rendre éditable plus tard.

### QA5-2 — Capture caméra à l'upload de tout document — **[CHANGE]** ✅ LIVRÉ 2026-05-01 (commits `ebb5342` + `3b8350a` + `e986fe9` + `81552b9`)
- **Livré** : composant `DocumentUploadButton` partagé avec deux CTAs « Téléverser un fichier » et « Photographier » (`<input type=file accept="image/*" capture="environment">`), branché dans `DocumentsPanel` (toutes catégories) et le panneau « Nouveau patient ». Plusieurs fixes caméra ont suivi : webcam PC détectée correctement (`3b8350a`, `e986fe9`), diagnostic clair quand l'OS bloque toutes les caméras (`81552b9`). Pas encore de recadrage live ni de compression client agressive — listés en post-MVP.
- **Demande (Youssef Boutaleb, 2026-05-01)** : sur tous les écrans qui acceptent un upload de document (panneau Modifier patient > Informations médicales, onglets Documents / Analyses / Imagerie du dossier, écran Imports à classer si livré, futur upload pièce jointe consultation, photo CIN de QA2-6), l'utilisateur doit avoir le choix entre :
  1. **Téléchargement classique** (déjà en place : `<input type=file>`).
  2. **Photographier le document** : ouvrir directement la caméra de l'appareil et envoyer la photo comme pièce jointe (PNG/JPEG).
- **État actuel** : `usePatientDocuments` accepte n'importe quel fichier matchant le whitelist MIME (`PDF/JPEG/PNG/WebP/HEIC` — voir QA2-2). Le composant d'upload utilise `<input type=file>` simple, sans attribut `capture`. Sur mobile l'OS ouvre le sélecteur de fichier mais ne propose pas explicitement la caméra en option visible côté UI.
- **Pourquoi c'est un CHANGE et pas un BUG** : techniquement on peut déjà uploader une photo (le mobile OS fournit la caméra dans son picker natif). Le manque est ergonomique : un bouton **explicite** "Photographier" rassure l'utilisateur — surtout les non-techies (assistant médical, secrétaire) qui ne creusent pas le picker système.
- **Scope estimé** :
  - Composant `DocumentUploadButton` central (réutilisé partout) avec deux CTAs côte à côte :
    - "Téléverser un fichier" → `<input type=file accept="image/*,application/pdf">` (comportement actuel).
    - "Photographier" → `<input type=file accept="image/*" capture="environment">` (caméra arrière par défaut, fallback front si indispo). Sur desktop sans caméra, masquer le bouton ou le désactiver avec tooltip "disponible sur mobile / tablette".
  - Compression automatique côté client (HEIC → JPEG, JPEG > 5 Mo → quality 0.8) pour rester sous le plafond `multipart.max-file-size = 10 Mo` du backend.
  - Optionnel post-MVP : aperçu live + recadrage (lib `react-easy-crop` à benchmarker) avant envoi pour des photos de doc plus propres. Pas obligatoire au 1er ship.
- **Lien** : QA2-2 (module documents existant), QA2-6 (photo patient + CIN — bénéficie directement du même composant), futurs écrans d'upload consultation. Concrétise et élargit la ligne `Documents & files > Drag-drop from device camera (mobile PWA)` listée plus bas.
- **Estimation** : 1 jour si on se limite aux 2 boutons + `capture` natif ; 2-3 jours additionnels avec recadrage live + compression client.

### QA5-3 — Photo patient à la création + affichage dans liste & dossier — **[CHANGE]** ✅ LIVRÉ 2026-05-01 (commits `ebb5342` + `c1349f7`)
- **Livré** : V014 ajoute `patient_patient.photo_document_id` + `DocumentType.PHOTO`. `PatientPhotoController` expose `PUT /api/patients/{id}/photo` (whitelist images, max 2 Mo) + `DELETE /api/patients/{id}/photo`. Composant `PatientAvatar` charge le binaire via `/preview`, cache React Query, fallback initiales en cas de 404. Propagé sur la liste patients, le header du dossier et le panneau Modifier. IT 12-scenario (`c1349f7` corrige un bug `flush JPA` avant le raw UPDATE).
- **Demande (Youssef Boutaleb, 2026-05-01)** : au moment de la création d'un patient, l'utilisateur doit pouvoir soit **photographier** le patient (caméra) soit **téléverser une photo**. Cette photo doit ensuite apparaître :
  1. Dans le **tableau de la liste patients** (`PatientsListPage`) — cellule avatar.
  2. Dans le **détail du patient** (`DossierPage`) — header / panneau Profil.
- **État actuel** : aucune photo patient n'est stockée. Les "avatars" affichés en liste et dans le dossier sont générés en CSS à partir des initiales (prénom + nom). Aucune colonne `photo_storage_key` sur `patient`. Le panneau "Nouveau patient" n'a pas de zone d'upload photo.
- **Pourquoi c'est un CHANGE et pas un BUG** : le prototype `design/prototype/` n'a jamais montré de photo patient ; le port a livré ce que le proto demandait. C'est un ajout de feature, pas une régression.
- **Recouvrement avec QA2-6** : QA2-6 listait déjà "Upload photo patient + scan CIN à la création" (avatar + CIN recto/verso). Cet item le **précise et le rend prioritaire** sur la photo patient seule, et impose la **double source caméra ↔ fichier** (= QA5-2 appliqué au champ photo patient). Garder QA2-6 pour les CIN ; cet item se concentre sur l'avatar.
- **Scope estimé** :
  - Backend : ajouter colonne `photo_storage_key VARCHAR(255) NULL` sur `patient` (Flyway nouvelle migration — règle non-négociable n°7) **OU** réutiliser `patient_document` avec type `PHOTO` (un seul actif par patient, le plus récent fait foi). **Recommandé** : réutiliser `patient_document` pour cohérence avec QA2-2 et limiter la duplication de logique de stockage. Endpoint `PUT /api/patients/{id}/photo` (multipart) et `GET /api/patients/{id}/photo` (binary, 304 si pas changé). Le `PatientResponse` expose `hasPhoto: boolean` + `photoUrl: string | null` (URL relative pointant vers l'endpoint authentifié).
  - Validation : carrée 1:1 idéalement, max 2 Mo, MIME `image/jpeg|png|webp|heic` (alignée sur whitelist QA2-2). Compression client (lib légère type `browser-image-compression`) si > 2 Mo.
  - Frontend :
    - Composant `PatientPhotoPicker` réutilisant le `DocumentUploadButton` de QA5-2 (deux CTAs : "Photographier" / "Téléverser") + preview circulaire.
    - Intégré dans le panneau "Nouveau patient" (haut du formulaire, avant le bloc Personnel) ET dans le panneau "Modifier" (re-upload possible).
    - Composant `PatientAvatar` mis à jour : si `photoUrl` présent → `<img>` (lazy-loaded, fallback initiales en cas de 404 / erreur de chargement), sinon initiales (comportement actuel). Réutilisé dans `PatientsListPage` (cellule avatar du tableau), `DossierPage` (header), `Sidebar` patient récents, `SalleAttentePage` (cartes file d'attente), `AppointmentDrawer` (en-tête).
  - Sécurité : `GET /api/patients/{id}/photo` doit passer le même `assertResourceAccess` que le reste des données patient (tracé dans `AUDIT_TODO.md` BLOCKERS). Sur post-pilote uniquement, envisager URLs signées courtes pour permettre `<img src>` direct sans JWT en header (sinon il faut un blob fetch comme pour les documents).
- **Limites & impact** :
  - Volume disque : 2 Mo × 5000 patients = 10 Go par cabinet à 5 ans. Acceptable on-prem, à surveiller pour le backup OVH.
  - **RGPD / loi 09-08** : photo = donnée biométrique potentielle. Consentement patient à capturer (QA wave 4 future ?). Tracé dans `Compliance > Patient consent capture at creation` (déjà au backlog).
  - Retraitement : si recadrage in-app rejeté pour MVP, le médecin doit pouvoir refaire la photo (pas d'édition crop côté serveur).
- **Estimation** : 1 jour backend (migration + endpoints + IT), 1,5 jour frontend (composant photo + propagation `PatientAvatar` aux 5 surfaces), 0,5 jour QA visuel. Total ≈ 3 jours.
- **Lien** : étend QA2-6 (photo patient + CIN) en y appliquant la double source de QA5-2. Si livré avant QA2-6, la CIN reste en backlog ; si livrés ensemble, mutualiser le composant et le storage.

### Priorisation QA5
1. **QA5-2** (capture caméra) — quick-win 1 jour, gain UX immédiat sur tablette de consultation. À glisser dans le prochain sprint frontend, idéalement bundlé avec QA2-6 (photo CIN) puisqu'ils partagent le composant `DocumentUploadButton`.
2. **QA5-3** (photo patient liste + dossier) — ~3 jours, à bundler avec QA5-2 et QA2-6 dans un seul sprint "média patient" (composant `DocumentUploadButton` mutualisé, gain x3).
3. **QA5-1** (import auto + permission) — feature majeure (~10 jours). À planifier post-pilote, après que les premiers cabinets aient identifié leurs labos / centres d'imagerie partenaires (sans partenaire actif, le connecteur IMAP n'a personne à brancher).

## QA wave 6 — 2026-05-02 (retour Youssef Boutaleb)

Format : **[BUG]** = comportement actuel ≠ ce qu'on aurait dû livrer · **[CHANGE]** = évolution de spec / nouvelle feature.

### QA6-1 — Boutons "Suspendre" et "Imprimer Certificat" sur la page consultation — **[BUG]** ✅ LIVRÉ 2026-05-02
- **Demande initiale** : "Les boutons suspendre et imprimer certificat existant dans la page de consultation ne sont pas fonctionnels."
- **Diagnostic IHM (Playwright desktop + mobile 390px)** :
  - Bouton "Suspendre" du footer (`ConsultationPage.tsx:271`) : `onClick={() => handleSubmit(() => undefined)()}` — handler vide, aucune navigation, aucun appel API. URL inchangée après click.
  - Bouton "Certificat" du footer (`ConsultationPage.tsx:274`) : `<Button disabled>` hardcodé même quand un certificat existe en BDD. Le backend `GET /prescriptions/{id}/pdf` (type=CERT) répond bien — c'est seulement la prop `disabled` figée côté UI.
- **Fix livré (commit à venir)** : (a) Suspendre → `navigate('/salle')` (le BROUILLON reste persisté côté serveur, navigation suffit) · (b) Footer Certificat conditionnel sur `latestCert = [...prescriptions].reverse().find(p => p.type === 'CERT')`, onClick `api.get('/prescriptions/{id}/pdf', { responseType: 'blob' }).then → window.open(URL.createObjectURL(blob))` (même pattern que `CertificatDialog.tsx`).
- **Mobile 390px** : pas de bouton Suspendre dans `ConsultationPage.mobile.tsx` (back-arrow MTopbar joue le rôle). Bouton "Certificat" mobile = ouverture du dialog création (pas de raccourci dédié à la réimpression d'un cert existant — clic sur l'item "Documents générés" navigue vers `/prescriptions/{id}`, ce qui est suffisant pour le mobile).
- **IT bottlée** : sibling test `ConsultationPageIT.java` ajouté par le sous-agent QA (8 scénarios verts) avec regression-lock spécifique sur la réimpression PDF.
- **Leçon** : ne plus shipper de bouton avec un onClick "noop" ou un `disabled` hardcodé sans condition. Si une feature attend du backend, on désactive avec une raison calculée (pas de cert → tooltip "aucun certificat à imprimer").

### QA6-2 — Modèles de prescription médicaments réutilisables en consultation — ✅ **LIVRÉ 2026-05-02**
- **Commits** : `7c3efe6` (design doc), `3117188` (backend + IT), `4a05226` (frontend Paramétrage + picker drawer).
- **Validation IHM** : `qa6-2-template-loaded-in-drawer.png` — modèle « QA6 HTA stable » créé dans Paramétrage → Modèles d'ordonnance, chargé via picker dans la consultation, ligne hydratée avec dosage/fréquence/durée/qté/instructions, éditable avant validation.
- **Demande initiale (Youssef Boutaleb, 2026-05-02)** : "Il faut permettre au médecin de confectionner des prescriptions de médicament et pouvoir les utiliser automatiquement au moment de la consultation, avec possibilité de modification au moment de consultation."
- **État actuel** : `PrescriptionDrawer` (`features/prescription/PrescriptionDrawer.tsx`) permet de saisir ligne par ligne (autocomplete sur `catalog_medication`). Aucun système de modèle réutilisable. Chaque consultation reconstruit l'ordonnance depuis zéro même pour des protocoles fréquents (ex : "HTA stable", "renouvellement diabète", "angine virale").
- **Pourquoi c'est un CHANGE** : ligne déjà listée dans `Prescription par type (issu de 5.5d)` plus haut au backlog ("Modèles d'ordonnance pré-remplis : 'HTA de base', 'Renouvellement diabète', etc."). QA6-2 confirme la demande terrain et la rend prioritaire — à promouvoir vers la prochaine itération frontend.
- **Scope estimé** :
  - Backend : table `clinical_prescription_template` (`id` UUID, `practitioner_id` FK identity_user, `name` VARCHAR, `type` ENUM DRUG|LAB|IMAGING, `lines` JSONB array de `{medicationCode, dose, frequency, duration, freeText}`, `created_at`, `updated_at`, `deleted_at` soft-delete, `version` optimistic locking). Endpoints CRUD `GET/POST/PUT/DELETE /api/prescription-templates` (filtre par practitioner_id implicite via JWT, MEDECIN+ADMIN seulement). Migration Flyway nouvelle (règle non-négociable n°7).
  - Frontend : (a) onglet "Modèles d'ordonnance" dans Paramétrage (CRUD complet — créer/renommer/dupliquer/supprimer modèle, lignes éditables avec mêmes autocompletes que `PrescriptionDrawer`) · (b) dans `PrescriptionDrawer` (panel actions consultation), un bouton "Charger un modèle" qui ouvre un picker (liste déroulante des modèles du médecin, filtrée par type DRUG/LAB/IMAGING) · au choix → préfill des lignes de l'ordonnance, **éditables ligne par ligne** avant validation (le médecin ajuste poso, supprime une ligne, ajoute un médic). Pas d'auto-soumission.
  - Pré-condition QA6-3 : si on bloque sur le catalogue analyses/radio incomplet (CRUD KO), le modèle LAB/IMAGING ne pourra référencer que des items déjà en base. Faire QA6-3 avant ou en parallèle pour ne pas livrer un modèle stérile.
- **Risques / décisions** :
  - Stockage `lines` en JSONB plutôt qu'en table fille `prescription_template_line` : préféré pour le MVP de cette feature parce que les lignes ne sont jamais requêtées indépendamment et l'ordre est intrinsèque. Si on veut faire des stats "quel médicament est le plus prescrit" plus tard, on extrait. Tracé en ADR à écrire au moment de l'implémentation.
  - Permission : modèle privé au médecin, pas partagé entre praticiens d'un même cabinet en v1 (chaque médecin a sa façon de prescrire). Permission `PRESCRIPTION_TEMPLATE_MANAGE` à ajouter à la matrice RBAC (post QA3-3).
- **Estimation** : 2 jours backend (entité + endpoints + IT), 2 jours frontend (CRUD Paramétrage + picker dans PrescriptionDrawer + tests + design parity), 0,5 jour QA. Total ≈ 5 jours.

### QA6-3 — Modèles de bons d'analyses (et imagerie) réutilisables — ✅ **LIVRÉ 2026-05-02 (bundlé QA6-2)**
- **Commits** : mêmes que QA6-2 — la table `clinical_prescription_template` est polymorphe via `type ∈ {DRUG,LAB,IMAGING}`, donc les 3 types ont été livrés ensemble (sub-tabs DRUG/LAB/IMAGING dans Paramétrage, picker filtré par type côté drawer).
- **Demande initiale (Youssef Boutaleb, 2026-05-02)** : "Même chose pour les bons d'analyses." (par extension : les bons d'imagerie aussi, même structure).
- **État actuel** : même drawer `PrescriptionDrawer` que pour les médicaments, paramétré par `type` LAB ou IMAGING. Pas de modèles. Un médecin qui prescrit systématiquement le même bilan (NFS + CRP + ionogramme + créatinine + glycémie) le ressaisit à chaque consultation.
- **Pourquoi c'est un CHANGE** : strictement parallèle à QA6-2. Idéalement livré dans la même PR/sprint que QA6-2 puisque l'entité backend `clinical_prescription_template` couvre déjà LAB et IMAGING via la colonne `type`.
- **Scope additionnel par rapport à QA6-2** : aucun côté backend (table déjà polymorphe). Côté frontend, le picker s'affiche dans le drawer LAB et le drawer IMAGING (déjà 3 instances du même drawer), filtrage par `type` côté GET pour ne montrer que les modèles pertinents.
- **Estimation** : +0,5 jour si bundlé avec QA6-2 (les filtres + les 2 boutons supplémentaires). Total ≈ 5,5 jours combiné QA6-2 + QA6-3.
- **Lien** : à bundler avec QA6-2.

### QA6-4 — Catalogue : ajout/suppression unitaire pour analyses et imagerie — **[BUG]**
- **Demande (Youssef Boutaleb, 2026-05-02)** : "Dans le catalogue le rajout et suppression de médicament de manière unitaire est possible mais pour les analyses et radio ce n'est pas possible."
- **État actuel à investiguer** : la page Catalogue (`/catalogue`) gère 4 onglets (médicaments, analyses, imagerie, actes). Le tester confirme que l'onglet médicaments a bien des actions unitaires "ajouter" / "supprimer", mais pas les onglets analyses + imagerie.
- **Pourquoi le bug existait probablement** : la page `CataloguePage` a sans doute été portée onglet par onglet avec `MedicationsTab` complet et `LabTestsTab` / `ImagingTab` à l'état placeholder (lecture seule). À vérifier dans `frontend/src/features/catalogue/`. Côté backend, voir si `CatalogController` expose POST/DELETE pour `/api/catalog/lab-tests` et `/api/catalog/imaging-exams` — ligne 23 du backlog `CRUD UI référentiels` indique que ces endpoints n'existent peut-être pas du tout (`Endpoints à créer : POST/PUT/DELETE /api/catalog/medications, idem labs/imaging`). Si c'est le cas, c'est bien un manque structurel et non juste un bouton oublié au frontend.
- **Diagnostic à faire avant fix** :
  - Côté backend : `GET /api/catalog/medications`, `GET /api/catalog/lab-tests`, `GET /api/catalog/imaging-exams` existent ? Lesquels ont leurs POST/PUT/DELETE compagnons ? `@PreAuthorize` ?
  - Côté frontend : `CataloguePage` rend-il un `<button>` "Ajouter" sur les onglets analyses + imagerie, ou rien du tout ? Si oui, le `onClick` est-il câblé ?
- **Fix prévu (selon résultat du diagnostic)** :
  - Cas A : endpoints absents → créer `LabTestController` + `ImagingExamController` avec POST/PUT/DELETE (alignés sur le pattern `MedicationController`) + IT couvrant happy + 403 secrétaire + 404 doublon code.
  - Cas B : endpoints présents mais frontend non câblé → wire les boutons "Ajouter" et "Supprimer" comme sur l'onglet médicaments (mêmes hooks `useCreateLabTest` / `useDeleteLabTest`).
- **Lien** : ligne `CRUD UI référentiels` du backlog QA wave 1 (« endpoints à créer : POST/PUT/DELETE /api/catalog/medications, idem labs/imaging »). QA6-4 confirme et priorise.
- **Estimation** : à confirmer après diagnostic. Si cas A : 1 jour backend + 0,5 jour frontend par référentiel × 2 = 3 jours. Si cas B : 0,5 jour total.

### Priorisation QA6
1. **QA6-1** ✅ livré (commit du jour).
2. **QA6-4** ✅ livré 2026-05-02 (catalogue analyses/radio CRUD).
3. **QA6-2 + QA6-3** ✅ livrés 2026-05-02 — bundlés via la table polymorphe `clinical_prescription_template`. Brainstormés (4 décisions UX), backend (13 IT verts), frontend Paramétrage + picker drawer, validation IHM bout-en-bout.

### QA6-5 — `MedicationWriteRequest.active` silencieusement ignoré par les SQL INSERT/UPDATE — **[BUG pré-existant]**
- **Détecté par** ultrareview 2026-05-02 (rgbf0wcek).
- **Symptôme** : un client envoyant `{"active": false}` sur `POST /api/catalog/medications` ou `PUT /api/catalog/medications/{id}` reçoit un 201/204 succès, mais la valeur n'est jamais persistée. L'INSERT hardcode `VALUES (..., TRUE)` (CatalogController.java:265) et l'UPDATE omet la colonne `active` du SET (lignes 282-284). La réponse 201 retourne aussi `active=true` en dur, donc impossible de détecter le no-op côté client.
- **Pourquoi pas dans QA6-1** : pré-existant — l'ultrareview l'a remonté parce que le PR du jour ajoute `@Valid` au DTO et attire l'attention sur un champ qui *paraît* settable. Hors scope du fix Suspendre/Certificat.
- **Asymétrie avec `favorite`** : le champ `favorite` *est* honoré via `COALESCE(?, favorite)` dans l'UPDATE — `active` ne l'est pas. Soit on aligne, soit on supprime le champ du DTO.
- **Décision recommandée** : **drop `active` du DTO** (`MedicationWriteRequest`). La désactivation passe déjà par `DELETE /medications/{id}` (soft-delete `SET active = FALSE`). Aucun chemin produit ne demande la réactivation côté API → un DTO honnête vaut mieux qu'un champ no-op. Si un cabinet pilote demande la réactivation plus tard, on rouvre la porte avec `COALESCE(?, active)` dans les 2 SQL.
- **Estimation** : 30 min (drop le champ + ajuster IT existant qui pourrait s'appuyer dessus).
- **Lien** : à grouper avec QA6-4 (CRUD catalogue) si tackled ensemble — même fichier `CatalogController.java`.

## QA wave 7 — 2026-05-02 (demandes Y. Boutaleb)

### ~~QA7-1 — Module gestion de stock interne~~ — **livré 2026-05-03** (5 commits `1931556`→Étape 5 ; voir `docs/plans/2026-05-03-stock-interne-design.md`).

### QA7-1 (archive du périmètre) — Module gestion de stock interne (médicaments, dossiers physiques, consommables)
- **Demande** : « Je veux mettre en place un module pour la gestion de stock interne (des médicaments, des dossiers physiques, des consommables) etc. » (Y. Boutaleb, 2026-05-02).
- **Périmètre fonctionnel à cadrer** :
  - Référentiel **articles de stock** (≠ catalogue prescription) avec catégories : `MEDICAMENT_INTERNE` (échantillons, doses cabinet), `DOSSIER_PHYSIQUE` (chemises, intercalaires), `CONSOMMABLE` (gants, seringues, désinfectant, papier ECG, etc.), libre extension.
  - **Mouvements de stock** : entrée (achat / don / correction), sortie (consommation cabinet, périmé, perdu), inventaire (snapshot manuel).
  - **Niveaux** : seuil min par article → alerte « stock faible » dans la salle/dashboard.
  - **Lots & péremption** pour les médicaments internes (FIFO + alerte J-30).
  - **Fournisseurs** : table simple (nom, contact, dernier prix d'achat) — pas de PO/facture fournisseur en v1.
  - **Localisation** : armoire/tiroir libre texte (post-MVP : multi-emplacement).
  - **Lien consommation → consultation** (optionnel) : un médicament interne dispensé peut être attaché à une consultation pour traçabilité (pas de facturation patient en v1, juste audit).
- **Modèle backend (esquisse)** :
  - `inventory_item (id, code, label, category, unit, min_threshold, location, active, …)`
  - `inventory_movement (id, item_id, type IN/OUT/ADJUSTMENT, quantity, lot, expires_at, supplier_id, consultation_id, reason, performed_by, performed_at)`
  - `inventory_supplier (id, name, contact, notes)`
  - `inventory_stock_view` (matérialisée ou calculée à la volée : SUM mouvements par article + lot).
- **UI** : nouvel onglet `Stock` dans `ParametragePage` (inventaire + alertes), + petit widget « Stock faible » sur le dashboard salle. Mobile : consultation rapide + ajout d'une sortie en 2 taps.
- **RBAC** : MEDECIN + ADMIN écrivent ; SECRETAIRE/ASSISTANT peuvent enregistrer une sortie ; lecture pour tous.
- **Hors scope v1** : commandes fournisseurs auto, codes-barres scan caméra, intégration comptable.
- **Estimation** : module bounded-context complet → ~3-4 J-days backend + 2 J-days frontend (parité desktop/mobile selon ADR-021). À cadrer en sprint dédié post-pilote.
- **Priorisation** : à confirmer terrain — fort si le cabinet gère beaucoup d'échantillons ou consomme énormément (vaccinations, pansements). Faible si stock minimal.

### QA7-2 — Module téléconsultation — **[CHANGE / NEW MODULE]**
- **Demande** : « Je veux mettre en place un module de téléconsultation. Inscris cette demande dans le backlog pour la traiter après. » (Y. Boutaleb, 2026-05-02).
- **Périmètre fonctionnel à cadrer** :
  - **Type RDV** : nouveau `AppointmentType.TELECONSULTATION` (en plus de CONSULTATION/CONTROLE/URGENCE) avec champ `meeting_url` généré.
  - **Salle virtuelle** : choix techno à défendre (DECISIONS.md) — Jitsi self-hosted (cohérent avec ADR-020 on-prem), Daily.co, ou WebRTC custom. Jitsi gagne probablement sur on-premise + zéro tier-party PHI exposure.
  - **Lien envoyé patient** : SMS/email avec URL signée + token court à expiration (cf. ADR-019 access en mémoire). Optionnel : QR code sur le bon de RDV.
  - **Salle d'attente virtuelle** : le patient se connecte, voit « Le médecin va vous rejoindre », le médecin a un widget « Patient connecté · attendant depuis X min » dans la salle d'attente classique.
  - **Pendant la consultation** : page consultation actuelle + iframe ou panneau vidéo à droite (remplace `PatientContextCard` ou en plus). SOAP autosave inchangé.
  - **Constantes déclaratives** : le patient saisit lui-même TA/poids (ou les passe au médecin) → champ libre + flag « déclaratives ».
  - **Ordonnance numérique** : envoi PDF par email/téléchargement direct + signature électronique simple (déjà signed_at en DB, ajouter QR code de vérification).
  - **Facturation** : tarif spécifique téléconsultation (config Tarifs), paiement en ligne hors v1 (laisser « à régler en cabinet » ou virement). Statut FACTURE classique.
  - **Conformité** : RGPD/loi marocaine 09-08 → consentement explicite avant connexion, journalisation enregistrement (pas d'enregistrement par défaut), données vidéo non stockées.
- **Modèle backend (esquisse)** :
  - `scheduling_appointment` étendu avec `is_teleconsultation BOOLEAN`, `meeting_url`, `meeting_token`, `patient_joined_at`, `practitioner_joined_at`, `ended_at`.
  - `teleconsultation_consent (id, patient_id, appointment_id, accepted_at, ip, user_agent)`.
  - Endpoint `POST /api/appointments/{id}/teleconsultation/start` génère le room/token, retourne URLs côté patient + côté médecin.
- **UI** :
  - Toggle « Téléconsultation » à la création RDV (agenda + dialog).
  - Widget patient connecté dans la salle d'attente (remplace les colonnes Box).
  - Page consultation avec panneau vidéo Jitsi embarqué (iframe).
  - Page patient (lien externe public) : consentement → salle d'attente → consultation.
- **RBAC** : MEDECIN seul démarre/termine la téléconsultation. SECRETAIRE crée le RDV téléconsultation et envoie le lien.
- **Hors scope v1** : enregistrement audio/vidéo, transcription auto, e-prescription nationale (DMP marocain quand disponible).
- **Estimation** : ~5-6 J-days backend (model + Jitsi integration + endpoints) + 3-4 J-days frontend (toggle + iframe + landing patient). Sprint dédié post-pilote.
- **Dépendances** : choix techno vidéo en ADR avant tout code. Test pilote RGPD avec un cabinet volontaire.
- **Priorisation** : forte demande générale post-COVID au Maroc, mais cabinet GP type carePlus = essentiellement présentiel. À confirmer terrain.

## Clinical

- Consultation amendment (v2, v3… chain) with full audit trace
- Out-of-range vitals alerts (configurable thresholds per cabinet)
- ~~Graphs of vitals over time (weight, blood pressure, glycemia)~~ — **livré 2026-04-30** (commits `a3dcfcd` + `4884b2e` + suite — Recharts, ErrorBoundary global, yDomain dynamique, formatY propre).
- Stupéfiants / psychotropes: enforced ordonnance sécurisée legal format (Moroccan requirements)
- Ordonnance renewal in 1 click for chronic patients
- Chronic condition follow-up module (diabetes HbA1c trend, HTA, asthma peak-flow)
- ~~Vaccination schedule + reminders~~ — **livré 2026-05-03** (module Vaccination enfant Étapes 1-6 ; voir `docs/plans/2026-05-02-vaccination-enfant-design.md`).
- ~~Lab results inbound: mark analysis as "result received", attach PDF, flag doctor~~ — **livré 2026-05-01** (commits `a1ad5e7` + `7738de0` + `ce1b4d2` + `db64aa6` — un seul bouton « Téléverser résultat » par ordonnance, attache PDF/image par ligne LAB/IMAGING, possible même après signature). Reste à faire : flag d'alerte médecin (badge / notif) quand un résultat arrive.
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
- ~~**Filtres + export détaillé sur les factures**~~ — **livré 2026-05-03** (commit `8d3e663`). Filtres serveur (dates émission/encaissement, statut, mode paiement, patient, montant) sur `GET /api/invoices/search` + KPIs agrégés + URL-sync. Export CSV (UTF-8 BOM, FR) et xlsx (fastexcel, ligne SUM, freeze pane) via `GET /api/invoices/export`, capé à 10 000 lignes (`422 EXPORT_TOO_LARGE`). RBAC : filtrer ouvert à tous, export MEDECIN+ADMIN. Design : `docs/plans/2026-05-02-invoice-filter-export-design.md`. ADR fastexcel vs Apache POI : ADR-025.

## Pregnancy vertical

> **Module Grossesse v1 — livré 2026-05-03** (6 commits : design `8e4407b`, BE Étape 1 `33ae1be`, BE Étape 2 `ac7d525`, BE Étape 3 `eb569bb`, FE Étape 4 `3d781f6`, FE Étape 5 `cb805cc`). Voir `docs/plans/2026-05-03-grossesse-design.md` + ADR-031. Items v1 livrés : déclaration + plan visites OMS auto + biométrie + 3 échographies (avec correction DPA T1) + alertes hardcodées (HTA / GAJ / HGPO / terme / BCF / BU / no-visit T3) + bio panel template T1-T2-T3 + worklist `/grossesses` + sidebar badge polling 30 s + clôture avec création fiche enfant + calendrier vaccination PNI auto.

Items v2 restants à priorisation post-pilote :
- Multi-fœtus structuré (jumeaux / triplés) — biométrie séparée par fœtus, alertes différentielles. v1 = JSONB `fetuses` minimal avec un fœtus par défaut.
- Carnet maternité PDF imprimable bilingue FR/AR (équivalent du carnet vaccination).
- Courbes percentiles fœtales (Hadlock, OMS 2017) sur la biométrie écho.
- Score de risque obstétrical (Coopland modifié) + score pré-éclampsie FMF / NICE.
- Monitoring fœtal numérique (RCF non-stress test).
- Seuils d'alerte paramétrables par cabinet (Paramétrage > Grossesse).
- Bio panel intelligent : ne pas re-prescrire la rubéole déjà immunisée (consulte historique sérologies).
- Vaccination dTcaP mère pendant la grossesse (recommandation OMS chaque grossesse) — module Vaccination v1 cible enfant uniquement.
- Promotion Option D BioPanel → Option C : endpoint `POST /patients/{id}/prescriptions/standalone` pour transformer le preview en vraie ordonnance signée hors contexte consultation.

## Documents & files

- ~~**Ancien dossier patient** (anciennes prescriptions, comptes-rendus radio, bilans biologiques)~~ — **livré 2026-04-27** via QA2-2 (module `ma.careplus.documents` + V009 + `DocumentsPanel` + `DocumentUploadButton`). Voir QA2-2 plus haut.
- ~~Patient document uploads (scans, photos, PDFs)~~ — **livré** via QA2-2 (multipart, whitelist MIME, soft-delete, RBAC).
- ~~Drag-drop from device camera (mobile PWA)~~ — **livré 2026-05-01** via QA5-2 (`DocumentUploadButton`, `capture="environment"`).
- WYSIWYG template editor with variable picker
- Multiple templates per document type + selection at print time
- Watermark "copie" on reprinted invoices

## Notifications

- Email + SMS integration (provider abstraction, Moroccan SMS provider)
- In-app notifications center per user
- WhatsApp share link for PDFs (deep link with pre-filled message)

## Test automation — Karate for backend APIs

Origin: 2026-05-01 IHM QA pass surfaced ~7 backend bugs (PUT /invoices 500, prescription 500, /patients/{id} 500, sign() accepts empty diagnosis, invoice issue at 0 MAD, payment overpayment, charset double-encoding). Each one had **zero IT** before — they only got caught because someone walked the UI in a browser. We need a layer between unit tests and Playwright that exercises every endpoint as a real HTTP client.

**Why Karate (not REST-assured / Postman):**
- Specs read like Gherkin (`Given path /api/invoices` / `When method PUT` / `Then status 422`) — non-Java QA can write tests without knowing JUnit
- Built-in JSON match with partial / wildcard / regex
- Same runner can do API + DB assertions (via JDBC) — useful for billing flows where the side effects (auto-invoice on sign) are what matters
- One Maven dep, runs as part of `mvn verify` next to existing `*IT.java`
- The team already invested in Testcontainers — Karate plays nice with the same Postgres container

**Scope to cover (from AUDIT_TODO.md "Sécurité applicative / robustesse" + audit sweep):**
- Identity: login happy / wrong password / lockout after N failed / refresh rotation / logout revokes
- Patients: CRUD + soft-delete + tier change + mutuelle change + 404 vs 500 on bad UUID + the `severity='GRAVE'` poisoning regression (V017 CHECK)
- Scheduling: create / update / status machine / availability slots / holiday refusal / leave refusal / reschedule conflicts
- Clinical: vitals record + range validation + consultation lifecycle (BROUILLON → SIGNEE) + sign rejects empty diagnosis (audit fix) + prescription DRUG/LAB/IMAGING + allergy override + free-text line
- Billing: auto-invoice on sign + add lines + issue (must reject 0 MAD) + payment (must reject overpayment) + credit note
- Catalog: medication / lab / imaging / acts CRUD + tariff effective dates
- Settings: clinic update + tiers update + RBAC matrix UPDATE persists
- Documents: upload happy + size guard + MIME guard + photo replace + result attach/detach + RESULT_NOT_APPLICABLE on DRUG line
- Errors: ROUTE_NOT_FOUND, PARAM_MISSING, PARAM_INVALID, METHOD_NOT_ALLOWED, BODY_UNREADABLE all return their declared codes (regression-guard the GlobalExceptionHandler)

**Layout:**
```
src/test/java/karate/
  KarateRunner.java                # JUnit 5 @Karate.Test bootstrap
  features/
    auth.feature
    patients.feature
    scheduling.feature
    clinical.feature
    billing.feature
    catalog.feature
    documents.feature
    settings.feature
    errors.feature
  helpers.js                        # auth headers, fixture seeders
karate-config.js                    # baseUrl per env (test / dev / staging)
```

**Boot strategy:** reuse the same Testcontainers Postgres + Spring Boot test slice as the existing `*IT.java` so we don't double the CI cost. `@SpringBootTest(webEnvironment = RANDOM_PORT)` exposes the port to Karate via `karate-config.js`.

**Acceptance to close this item:**
- All endpoints in `docs/API.md` have at least one Karate scenario covering happy + one error case
- `mvn verify` runs Karate green in CI
- README explains how to add a new feature file

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

> **Note 2026-05-03** : une **landing page in-app** a été livrée 2026-04-30 (commit `afd3056`) — `/` rend désormais hero + 4 features + trust strip + CTA `/login`, wrappée dans `<GuestOnly />`. C'est un dépannage qui mute le « NOT recommended » ci-dessous : pour la version finale (apex domain séparé, hébergée Vercel/Netlify, SEO indépendant) le travail reste à faire — la landing actuelle est dans le bundle Vite de l'app et partage le déploiement Render.

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
