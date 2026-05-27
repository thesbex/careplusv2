# careplus — Design-System Refresh Brief (complete UI inventory)

> **For the AI designer.** This is the **entire** careplus product surface — every screen (desktop **and** mobile), every button, modal, drawer, tab, table, form, badge and state. Your job: design a **fresh new visual theme / design system** that re-skins **all** of it without dropping any screen, control, or state. Treat this as the source of truth for coverage. Nothing here is optional.

---

## 0. Product context & hard constraints

- **What it is:** careplus — a Système d'Information de Cabinet Médical for Moroccan medical practices (solo cabinet → clinic/hospital). One on-premise install per cabinet.
- **Language:** UI is **French** (labels below are verbatim — keep them).
- **Form factors (MANDATORY parity):** every screen ships **desktop** AND **mobile (~390 px)**. Mobile is not an afterthought — it has its own shell, bottom tab bar, bottom sheets, cards, and FABs. Design both.
- **Stack the design must live in:** React + Vite + plain CSS driven by **CSS custom properties** (design tokens). No Tailwind, no CSS-in-JS, no external UI kit beyond Radix primitives (Dialog/Popover). On-prem: **all assets self-hosted** (fonts via @fontsource, icons inline SVG, no CDN). Keep this model; deliver tokens + component specs that map to CSS variables.
- **Roles drive visibility:** ADMIN, MEDECIN, SECRETAIRE, ASSISTANT, INFIRMIER, RECEPTIONNISTE, LAB, RADIO. Many controls are role/permission-gated. "Pure-tech" users (LAB/RADIO only) get a reduced 3-tab shell.
- **Accessibility:** WCAG AA contrast, visible focus rings, keyboard nav, ARIA labels on icon-only buttons, status conveyed by **text + color** (never color alone), touch targets ≥44 px on mobile.
- **Density:** clinical tool used all day → information-dense, calm, fast-scanning. Tabular numbers for times/money/measures.

**Deliverables expected from you:** (1) a refreshed token set (the variables in §1), (2) restyled specs for every shared component (§3), (3) a visual language applied across all screens (§5) incl. both form factors, (4) status/semantic color system (§2), (5) states (loading/empty/error), toasts, badges. Keep every French label and every control; you may reorganize visual hierarchy, spacing, color, type, radii, shadows, iconography.

---

## 1. Current design tokens (the baseline to refresh)

These are the **actual** CSS variables in use (`src/styles/tokens.css`). Re-theme them; keep the variable names so the refactor is a token swap.

**Surface & ink**
- `--bg: #f7f5f1` (warm paper) · `--bg-alt: #efebe3` · `--surface: #ffffff` · `--surface-2: #fbfaf7`
- `--ink: #1a1a1a` · `--ink-2: #3d3d3d` · `--ink-3: #6b6b6b` · `--ink-4: #9b9b9b`
- `--border: #e8e4dc` · `--border-strong: #d6d0c3` · `--border-soft: #efebe3`

**Brand (careplus blue)**
- `--primary: #2a7ce7` · `--primary-hover: #1b5bc7` · `--primary-soft: #e4eefa` · `--primary-ink: #ffffff`

**Semantic**
- `--amber: #b8500c` / `--amber-soft: #fbeadb` (warnings, allergies)
- `--danger: #a8321e` / `--danger-soft: #f5e1dc` (destructive, errors)
- `--success: #3f7a3a` / `--success-soft: #e1ecde`

**Patient-status palette** (pills + agenda blocks must read the same color per status)
- arrived → `#def0e6` bg / `#2f8f6b` ink
- waiting → `#fbefe3` bg / `#c68a2e` ink
- vitals → `#fbefe3` / `#c68a2e` ("en attente constantes")
- consult → `#c9d9ee` / `#1e5aa8`
- done → `#f5e1dc` / `#a8321e`

**Typography**
- Sans (UI): **Plus Jakarta Sans** (400/500/600/700/800)
- Serif (letterheads/invoice headers, accents): **Instrument Serif** (400 + italic)
- Mono (codes, times, amounts, IDs): **JetBrains Mono** (400/500); utility `.tnum` = tabular numerals; `.mono`, `.serif` helpers
- Base: 14px / line-height 1.4 / `font-feature-settings: 'cv11','ss01','tnum'`, antialiased
- Observed scale: 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 14 / 15 / 17 / 18 / 22 / 26 px. Headings use slightly negative tracking (−0.01 to −0.02em); labels often uppercase with +0.04–0.08em.

**Radii:** `--r-xs: 3px` · `--r-sm: 4px` · `--r-md: 6px` · `--r-lg: 10px` · pills 999px.

**Shadows (current, informal):** card `0 1px 2px rgba(0,0,0,.04)`; popover/drawer `0 8px 24px rgba(0,0,0,.08)` / `-16px 0 40px rgba(0,0,0,.1)`; FAB `0 4px 16px rgba(42,124,231,.35)`. Modal overlay `rgba(20,18,12,.45)` or `rgba(0,0,0,.4)`.

**Spacing:** informal 2/4/6/8/10/12/14/16/18/20/24px steps. Propose a real scale.

> Current aesthetic = warm off-white "paper" surfaces + a single blue brand + muted earthy semantic tones. You may keep, evolve, or replace this mood — but deliver the full token set.

---

## 2. Status / badge / semantic system (used everywhere)

- **Pill** component statuses: `arrived | waiting | vitals | consult | done | allergy` (+ dot variant). Allergy = amber-soft bg, amber ink, Warn icon.
- **Appointment statuses** (agenda + queue): PLANIFIE (gray), CONFIRME (blue), ARRIVE (green), EN_ATTENTE_CONSTANTES (amber), CONSTANTES_PRISES (blue), EN_CONSULTATION (blue), CONSULTATION_TERMINEE/TERMINE (green), CLOS (gray), ANNULE (red), NO_SHOW (gray).
- **Allergy severity badges:** Légère (green) · Modérée (amber) · Sévère (red).
- **Invoice statuses:** Brouillon (gray) · Émise (blue) · Partielle (amber) · Payée (green) · Annulée (red).
- **Stay statuses:** EN_COURS (red) · SORTI (amber) · FACTURE (green) · ANNULE (gray).
- **Bed statuses:** LIBRE · RESERVE · OCCUPÉ · NETTOYAGE · HORS_SERVICE (color-coded).
- **Template/active toggles:** "Actif" (green-soft) / "Inactif" (gray).
- **Trimester pills (grossesse):** T1 (info) · T2 (primary) · T3 (amber).
- **Alert severities (grossesse):** CRITICAL (danger) · WARNING (amber) · INFO (info).
- **Expiry pills (stock):** ≤7j danger, 8–30j amber ("Périme dans Nj").
- **Premium tier:** 🌟 prefix on patient name.
- **Counts/badges:** sidebar nav badge (primary pill), mobile tab badge (amber, top-right, white border), unread/mention badges in chat (`@N`).

---

## 3. Global shells

### Desktop shell (`AppLayout` → `Sidebar` + per-page `Screen`)
- **Sidebar** (224px, fixed): brand block (`BrandMark` + "careplus" wordmark "care"=ink/"plus"=primary, + establishment name·city); 2 nav sections — **FLUX PATIENT** (Dashboard, Agenda, Patients, Salle d'attente, Consultations, Facturation, Vaccinations, Grossesses, Stock, Hospitalisation[gated], Messages, Assistant IA[MEDECIN/ADMIN], Laboratoire[LAB], Radiologie[RADIO]) and **CONFIGURATION** (Catalogue, Charges[ADMIN], Personnel[ADMIN], Paramètres). Items: icon + label, active state (white surface, primary text), live count badges on Salle/Vaccinations/Grossesses/Stock. Bottom **user chip**: avatar + name + role → popover ("Mon profil" / "Se déconnecter").
- **Topbar** (`Screen`, 56px): page title + optional sub; center patient search ("Rechercher un patient par nom, téléphone, CIN…"); right: Notifications (bell), optional page actions, "Session : Dr. …", "Déconnexion".
- **Workspace** + optional **right panel** (312px).
- **⌘K / Ctrl+K spotlight** (`PatientSearchSpotlight`): overlay dialog, debounced patient search, arrow-key nav, Enter to open dossier.

### Mobile shell (`MScreen` + `MTopbar` + `MTabs`)
- **MTopbar** (52px): brand mode (logo + wordmark) OR back-button + title + sub + right slot.
- **MTabs** (bottom, 5): Agenda · Salle · Patients · Factures · **Plus** (menu hub). Active = primary; badges = amber top-right. Pure-tech variant = 3 tabs (File · Messages · Profil).
- **FAB** (primary, 56px, bottom-right above tab bar) on list screens.
- **Bottom sheets** (`m-sheet`, grab handle) replace drawers; **cards/rows** (`m-card`/`m-row`) replace tables; `m-segmented` for in-screen tabs; `m-stat-grid` (2-col) for KPIs; `m-tl` vertical timeline for agenda.

---

## 4. Shared UI components (restyle each, with all variants/states)

- **Button** — variants: `default` (paper surface + border), `primary` (filled blue), `ghost` (transparent), `danger`; sizes `sm`(26) / `md`(32) / `lg`(38); `iconOnly` (square); states: hover, focus-ring, disabled (~.55 opacity), loading. Mobile `m-btn` (full-width, larger).
- **Pill** — status badge (see §2), optional leading dot/icon; compact (11px).
- **Avatar** — initials (2 chars), sizes sm/md/lg; deterministic bg. **PatientAvatar** — async photo via `/documents/{id}/preview`, silent fallback to initials, sizes sm/md/lg/xl. **UserAvatar** (chat) — photo by user id + online dot.
- **Panel** + **PanelHeader** — card container (surface, border, radius); header (weight 550, bottom border).
- **Field** (+ `FieldLabel`, `FieldHelp`), **Input**, **Select** (custom chevron), **Textarea** — focus = primary border + soft ring; error = red border + message. Mobile `m-input` (46px, 15px, 10px radius).
- **BrandMark** (inline SVG logo, sizes sm/md/lg, tones primary/inverted) + **BrandWordmark** ("care"+"plus").
- **DocumentUploadButton** — "Téléverser" + "Photographier" (mobile native capture / desktop webcam); accepts PDF/JPEG/PNG/WebP/HEIC.
- **WebcamCaptureModal** — desktop webcam capture (video + capture + error states: insecure context, no permission, no device).
- **KPI tile / KpiCard** — uppercase label + large bold value (+ unit) + optional sub/hint + loading skeleton.
- **Modal/Drawer shells** — centered modal (Radix Dialog), right slide-over drawer (~480–520px), bottom sheet (mobile); overlay, focus trap, Esc to close, title + optional description + close (×); footer action row (primary right, cancel/ghost left).
- **Toasts** (sonner) — success/error, title + optional description, auto-dismiss.
- **States** — loading "Chargement…" / skeletons; empty "Aucun(e) …"; error red banner/text.

---

## 5. Screen-by-screen inventory

> Format: **Screen** (route) — desktop regions + mobile variant; **buttons** (verbatim); **modals/drawers**; **tables/forms**; **states**.

### 5.1 Entry / auth (no app chrome)
- **Landing** (`/`): desktop = blue-gradient hero (BrandMark inverted + wordmark + tagline + 3 KPI stats) | right app-preview panel; CTA **"Se connecter"**. Mobile = full-screen hero + feature checklist + CTA.
- **Login** (`/login`): split hero (gradient 155° #1E5AA8→#112F5C + brand + value prop + stats) | form (Email, Mot de passe + eye toggle, **"Se connecter"** lg full-width, register link). Errors: "Identifiants incorrects" / "Trop de tentatives. Réessayez dans 15 minutes." Mobile = hero band + stacked form.
- **Register** (`/register`): hero + signup form (Prénom, Nom, Email, Téléphone?, Mot de passe, Rôle select [Médecin/Secrétaire/Gestionnaire], terms checkbox). 409 → already-bootstrapped.
- **Onboarding** (`/onboarding`): wizard — `OnboardingSidebar` step tracker + steps (cabinet identity, logo, doctors, rooms, leave, users, review); `AddDoctorModal`; Next/Prev.
- **Force change password** (`/force-change-password`): centered card — Current?, New (≥12), Confirm; **"Mettre à jour"**.
- **Profil** (`/profil`): desktop 2-col — ProfilePhotoSection (upload/camera), Identité (read-only), PasswordChangeSection (Current/New/Confirm + "Mettre à jour"), SignatureSettingsSection (MEDECIN: upload signature scan), ReferralContactsSection (add/remove confrère contacts). Mobile = single column + back nav.

### 5.2 Dashboard (`/dashboard`)
- Desktop sections: **Aujourd'hui** (KPIs: Patients actifs, Consultations du jour, RDV du jour, CA du jour), **Activité** (30-day sparkline, hourly-load bars, Top-5 pathologies), **Agenda — semaine** (RDV semaine, No-shows, Annulations, Nouveaux patients), **Performance financière** (MEDECIN/ADMIN: CA mois, CA YTD, Impayés, Taux encaissement + CA-12-mois bars + CA par acte top-6). Topbar CTAs: **"Appel rapide"**, **"Nouveau RDV"**. Components: KpiCard, MiniSparkline (role=img), HourlyBars. Mobile = 2×2 KPI grids stacked, "Retour"+ "Dashboard" topbar.

### 5.3 Agenda (`/agenda`)
- Desktop: view selector **Semaine / Jour / Mois**, prev/today/next, practitioner filter ("Tous les médecins"), room filter ("Toutes les salles"), motif filter ("Tous les motifs"); week grid 8:00–20:00 with draggable colored blocks (leave-day stripes, now-line); month grid; right panel = "Arrivées du jour" (semaine) or "Vue d'ensemble — {mois}" stats + **"Exporter le mois (CSV)"**. CTAs: **"Appel rapide"**, **"Nouveau RDV"**, **"Imprimer"**.
- **AppointmentDrawer** (right, 480px): title=patient, sub=reason·time·status; room-conflict alert; **Déplacer** (Date/Heure/Durée + Médecin?/Salle?), **"Déplacer le RDV"**, **"Voir dossier patient"**, **"Déclarer arrivée"**; cancel section (reason textarea, **"Confirmer l'annulation"** danger).
- Mobile: week strip (‹ Préc./Suiv. ›/Auj.), filters, day chips, single-day vertical timeline (`m-tl`, colored blocks + allergy pill); FAB **"+ Nouveau RDV"**; empty "Aucun rendez-vous ce jour."

### 5.4 Salle d'attente (`/salle`)
- Desktop: title + "N patient(s) présent(s)"; CTAs **"Liste"** (print), **"Ajouter un patient sans RDV"**, **"Déclarer arrivée"**; KPI tiles (En attente / En constantes / En consultation / Terminés); queue = per-doctor columns (≥2 active practitioners → `QueueColumnCard`) else flat table [Patient, RDV, Arrivé à, Attente(amber ≥25min), Motif, Statut pill, Salle, Actions]. Row CTAs by status: **"Prendre constantes →"**, **"Envoyer en consult. →"**, **"Ouvrir"**, **"Appeler"**, **"Retirer"** (danger), overflow ⋯. Upcoming section "RDV prévus — pas encore arrivés" + **"Marquer arrivé"**.
- **AddWalkInDialog**: patient search + Médecin select + Motif select + **"Ajouter à la salle"**. **CancelAppointmentDialog**: "Retirer de la liste d'attente" + reason + **"Confirmer l'annulation"**.
- Mobile: 2×2 KPI grid, doctor filter chips, patient cards (avatar+name+status pill+time), tap → action; FAB "+ Sans RDV".

### 5.5 Prise de constantes (`/constantes/:appointmentId`)
- Desktop: left form (Anthropométrie: Poids/Taille/IMC auto; Vitaux: TA Sys/Dia, FC, T°, SpO₂, Respiration; Bio: Glycémie, Périm. abdo, Périm. crânien) + checkboxes (Patient à jeun / Carnet présent / Analyses prescrites) + Notes; right panel = previous vitals; TA warning (amber if Sys≥130). CTAs **"Enregistrer et retourner"**, **"Retour"**. Mobile = full-screen large fields + allergy strip + **"Enregistrer"**.

### 5.6 Patients list + Dossier (`/patients`, `/patients/:id`)
- **PatientsListPage** desktop: search + segment (Actifs/Inactifs) + filter + **"Nouveau patient"**; left list / right = new-patient form OR profile. New-patient form: photo upload; tabs Personnel/Medical; fields (Prénom, Nom, Genre, Date naissance, CIN, Téléphone, Email, Ville, Groupe sanguin, Tier NORMAL/PREMIUM radio, Notes, mutuelle toggle+policy); Allergies table (Substance/Sévérité badge/remove + add); Antécédents table (Type select/Description/remove + add); compact Documents panel. Mobile: list + FAB → `NewPatientMobileSheet`.
- **DossierPage** desktop: header (PatientAvatar + name + sex·age·CIN + coverage badge), AllergyStrip (amber), CTAs **"Démarrer consult."**, **"Modifier"**, print/share. **DossierTabs** (badge counts): Chronologie · Consultations · Constantes · Prescriptions · Vaccination · Grossesse[?] · Séjours[?] · Analyses · Imagerie · Documents · Facturation.
  - Tab panels: **TimelinePanel** (vertical, "En cours" pill, tags); **VitalsEvolutionPanel** (6 ChartCards: TA, FC, T°, SpO₂, Poids, IMC sparklines + current value); **BiologicalTrendsPanel** (analyte mini-charts Hb/Glycémie… SVG); consultations list; prescriptions list (→ PDF); **VaccinationCalendarTab**; **PregnancyTab**; **StaysTab**; **DocumentsPanel** (filter chips ALL/PRESCRIPTION_HISTORIQUE/ANALYSE/IMAGERIE/COMPTE_RENDU/AUTRE; upload type+notes+`DocumentUploadButton`; rows with Prévisualiser/Télécharger/Supprimer); invoice list.
  - **DocumentPreviewDialog**: "Aperçu — {name}" (iframe PDF / img), **"Télécharger"**, **"Imprimer"**, **"Fermer"**.
  - Mobile: vertical tabs, full-width panels, `EditPatientMobileSheet`, bottom CTAs **"Démarrer consult."**, **"Consentement éclairé"**.

### 5.7 Consultation (`/consultations`, `/consultations/:id`)
- **ConsultationsListPage** desktop: KPI strip (Aujourd'hui / Durée moyenne / Taux ordonnance / Annulations·30j); segmented (Toutes/Aujourd'hui/Cette semaine/En cours/Annulées with counts); sort dropdown; filter chips (Médecin/Type/Période/Diagnostic CIM-10) + **"+ Ajouter un filtre"**; per-day tables [Heure·ID, Patient, Motif·Diagnostic, Type·Médecin, Durée, Statut (En cours pulsing / Annulée / Terminée), Suite (Ordo badge + Lock)]; pagination. Mobile: FAB "+ Depuis patient", sections "En cours · brouillon (N)" / "Signées (N)".
- **ConsultationPage** desktop: left **PatientContextCard** (avatar, name, allergy pill, coverage, vitals table with VitalRow, antécédents, traitement), center **SoapEditor** (S Subjectif/O Objectif/A Appréciation [+ "+ Ajouter aux antécédents"]/P Plan textareas; readonly when signed), top toolbar **"Modèles"**/**"CIM-10"** (disabled); right **Actions** column (`ActionBtn`): **"Prescription médicaments"**, **"Bon d'analyses"**, **"Bon d'imagerie"**, **"Certificat médical"**, **"Courrier confrère"**, **"Prochain RDV"** + **Documents générés** (DocRow: title/type, eye, trash) + **ConsultationPrestationsPanel** + **Facturation** panel (Sous-total/Remise/Net + Remise input + "Ajuster" or "Ouvrir la facture →"). Footer: autosave status, **"Suspendre"**, **SignatureLock** → **"Clôturer et facturer →"**. Mobile: patient strip + vitals grid + flat SOAP + 3×2 prescription buttons (Médic./Analyses/Imagerie/Certificat/Courrier/Prochain RDV) + documents cards + **"Clôturer la consultation"**.
- Consultation dialogs (verbatim titles): **QuickVitalsDialog** "Saisir les constantes" (11 vital fields with hints, Enregistrer); **CertificatDialog** "Certificat médical" (templates Aptitude/Présence/Repos; Repos→jours+date début+Sortie autorisée; body; "Générer le certificat"); **FollowUpDialog** "Programmer un prochain RDV" (Date/Heure/Motif/Notes + day-planning panel + overlap alert; "Programmer"); **PromoteDiagnosisDialog** "Ajouter ce diagnostic aux antécédents" (Description + Type + date + Catégorie; "Enregistrer"); **SuspendChoiceDialog** "Suspendre la consultation" (choice: remettre en salle / annuler RDV → reason; "Confirmer l'annulation"); **SignatureLock** "Signer et verrouiller la consultation" ("Confirmer et clôturer").

### 5.8 Prescription / documents
- **PrescriptionDrawer** (titles by type): "Prescription médicamenteuse" / "Bon d'analyses biologiques" / "Bon d'imagerie médicale"; allergy banner / conflict banner; search (catalogue) + suggest listbox; internal toggle **"Fournir en interne (pharmacie)"** / **"Réaliser en interne"** + no-price warning; line cards (DRUG: Posologie/Fréquence/Durée/Quantité + Instructions); **"+ Ajouter une ligne"**; Recommandations textarea; allergy-override section; **"Créer l'ordonnance"** / **"Confirmer override"**. **PrescriptionTemplatePicker** ("Charger un modèle" popover/sheet).
- **PrescriptionResultsPanel** (LAB/IMAGING): per-line result upload button + structured results grid (Analyte datalist / Valeur / Unité / delete) + "+ Ajouter une ligne" + "Enregistrer".
- **OrdonnancePdfPage** (`/prescriptions/:id`): PDF viewer (`DocumentPdfViewer`/`PdfCanvasViewer` canvas), type-aware title/prefix; **"Télécharger"**, **"Imprimer"**; mobile pinch-zoom.
- **ConfrereLetterDialog** "Courrier au confrère": Confrère (carnet) select, Modèle de courrier select, Destinataire*, Spécialité, Ville, body; **"Générer & imprimer"**.
- **ConsentDialog** "Consentement éclairé": Modèle select, Titre*, body, placeholders hint; **"Générer & imprimer"**.

### 5.9 Vaccinations (`/vaccinations`) & Grossesses (`/grossesses`)
- **VaccinationsQueuePage**: title "Vaccinations" / "Suivi PNI marocain"; tabs En retard / Dues cette semaine / Dues ce mois; filters Vaccin select + age-range buttons (Tout/0-12 mois/12-36 mois/3-5 ans); table [Patient, Âge, Vaccin, Dose, Date cible, Statut pill, Jours en retard]; row → **RecordDoseDrawer** (vaccine, date, batch#, site, notes); pagination. Mobile cards + drawer. `VaccinationParamTab` in settings.
- **PregnancesQueuePage**: title "Grossesses" / "Programme PSGA Maroc"; trimester chips Toutes/T1/T2/T3; search + "Avec alertes uniquement" checkbox; table [Patiente, DDN, Trimestre pill, Alertes badges]; row → pregnancy management. **PregnancyTab** (summary/visits/ultrasounds/labs); drawers: **PregnancyVisitDrawer** (date, findings, BCF/HU/TA/poids, next visit), **PregnancyUltrasoundDrawer** (type, date, SA weeks/days, biometry BIP/PC/DAT/LF/EG/percentile, findings, doc upload, "Corriger la DPA"), **PregnancyCloseDialog** (outcome), **CreateChildDialog**, BioPanel preview. Per-ultrasound **"Compte-rendu PDF"** download. Mobile parity.

### 5.10 Facturation / caisse / charges / personnel
- **FacturationPage**: status chips Toutes/Brouillons/Émises/Partielles/Payées/Annulées; Médecin filter; **"Filtres avancés"** popover (date Émission/Encaissement + presets Ce mois/Mois dernier/Cette année, payment modes checkboxes, patient search, amount min/max, Réinitialiser/Appliquer); **"Exporter"** (CSV/XLSX); KPI tiles (Total net / Encaissé / À encaisser); table [Numéro, Patient, Date, Statut pill, Total net, Encaissé]. **InvoiceDrawer**: lines table (editable if BROUILLON) + "Ajouter une ligne"; totals (Sous-total/Remise/Net/Déjà encaissé/Reste à régler); payments list; footer by state — **"Enregistrer brouillon"**/**"Émettre →"** | **"Avoir"**/**"Encaisser"**. Nested **PaymentDialog** "Encaisser un paiement" (Montant/Mode ESPECES·CHEQUE·CB·VIREMENT·TIERS_PAYANT/Référence) + **CreditNoteDialog** "Émettre un avoir" (reason). **ApercuFacturePage** (`/facturation/:id/apercu`): A4 letterhead (serif cabinet name) + patient/number + lines + totals; **"Retour"**, **"Imprimer"**. Mobile: chips + 2-col stats + invoice cards.
- **CaisseTodayPanel**: "Caisse du jour" + date; 2 KPI boxes (Encaissé aujourd'hui / Factures émises) + per-mode 5-col grid.
- **ChargesPage** (ADMIN): **"+ Ajouter une charge"**; annual 12-month bar chart "Récapitulatif {year}"; category chips; table [Catégorie, Libellé, Montant, Date, Périodicité, Fournisseur, actions]; form drawer (Catégorie/Libellé/Montant/Date/Périodicité PONCTUELLE·MENSUELLE·TRIMESTRIELLE·ANNUELLE/Fournisseur/Notes; "Enregistrer charge"). Mobile cards + sheet.
- **PersonnelPage** (ADMIN): **"+ Ajouter un membre"**; table [Nom, Poste, Date recrutement, Salaire, Téléphone, Statut, actions]; form drawer (Nom/Poste SECRETAIRE·INFIRMIER·ASSISTANT·MEDECIN/Date/Salaire/Téléphone/Actif/Notes); detail modal (leave summary + entries + add, salary payments + add). Mobile cards + sheets.

### 5.11 Stock (`/stock`, `/stock/articles/:id`)
- **StockArticlesPage**: "Stock interne"; **"+ Ajouter article"**; category chips Tous/MEDICAMENT_INTERNE/DOSSIER_PHYSIQUE/CONSOMMABLE; search; supplier select; "Stock sous seuil" checkbox; table [Code, Libellé, Catégorie badge, Quantité, Seuil min, Expiration pill, action]; pagination. **StockArticleFormDrawer** (Code/Libellé/Catégorie/Unité/Seuil/Fournisseur/Emplacement/Actif; DOSSIER_PHYSIQUE reduced form). **StockArticleDetailPage**: header + lots table (Lot/Quantité/Expire/Statut) + quick actions **"Entrée"/"Sortie"/"Ajustement"** → **MovementDrawer** (Quantité/Motif/Lot?/Expiration?) + movements table; **LotInactivateDialog**. `StockParamTab` (suppliers). Mobile cards.

### 5.12 Hospitalisation (`/hospitalisation`)
- **HospitalisationPage**: "Patients hospitalisés"; **"+ Nouvelle admission"** toggle → **AdmissionForm** (Patient search*, Lit select* [free beds], Motif; "Admettre"); worklist rows (name, bed·ward·reason, day counter, **"Gérer"**) → **StayDetailPanel** (status badge EN_COURS/SORTI/FACTURE; affectations; vitals record; **StayPrestationsSection** [acte select + Libellé + Prix + Qté + "Ajouter"; total]; transfer select + "Transférer"; discharge type DOMICILE/AUTRE_ETABLISSEMENT/DECES + résumé + "Enregistrer la sortie"; "Générer la facture de séjour"; "Voir la facture"; "Télécharger le compte-rendu (PDF)"). Mobile cards + inline detail. **StaysTab** (dossier): expandable closed-stay history. **ChambresLitsTab** (settings): wards/rooms/beds CRUD with statuses & classes.

### 5.13 Internal requests (`/queue/:service`)
- **QueuePage**: title "Laboratoire" / "Radiologie"; tabs En attente / En cours / Traitées; rows (patient, request code, requested-by, time) with **"Prendre en charge"** (PENDING) / **"Téléverser résultat"** (IN_PROGRESS) / **"Voir résultat"** (DONE). Mobile cards.

### 5.14 Catalogue (`/catalogue`, `/catalogue/analyses`, `/catalogue/radio`)
- Tabs Médicaments / Analyses biologiques / Imagerie. **Medications**: **"+ Ajouter médicament"** + **"Importer CSV"** (`CatalogImportButton`); search "…nom commercial ou DCI…"; class filter; DCI-grouped list (commercial name/dosage/form/favori/tags); form drawer (Nom commercial*/DCI*/Forme*/Dosage*/Classes/Favori/Prix interne MAD). **Lab**: code/name/category/prix interne + drawer. **Imaging**: code/name/modalité (RADIO/ECHOGRAPHIE/SCANNER/IRM)/prix interne + drawer. Mobile = read-only search cards.

### 5.15 Messages (`/messages`, `/messages/:id`)
- Desktop 3-col: left rail (search "Rechercher une conversation"; sections **Canaux**/**Messages directs**/**Fils patient** with counts + add; channel rows `#name` + `@N`/unread; DM rows avatar+dot+unread; footer self chip); center (header prefix #/◆/@ + name + URGENT badge + topic + member avatars + pin + ⋯; messages with day dividers, grouped bubbles, @mention highlight, reactions, reply indicator, urgent red border, typing indicator; composer textarea + toolbar **@** mention / ☺ emoji / 📎 attach / ⚕ Patient + **"Envoyer"**); right rail (À propos, Membres + "Inviter un membre", Fichiers partagés placeholder, **Patients liés** cards with **"Ouvrir dossier"**). Topbar "Messages équipe" + "N membres · K en ligne" + **"Tous"** + **"Nouveau message"**. Popovers: MentionPickerPopover, EmojiPickerPopover (8-col), PatientPickerPopover.
- Mobile: tabs Tout/Mentions/Non lus; urgent banner; conversation rows; FAB (edit) → **MobileColleaguePicker** bottom sheet "Nouveau message". **MConversationPage.mobile**: back + channel header + pinned bar + chat bubbles (self primary / other bg-alt / urgent danger-soft) + composer.

### 5.16 Assistant IA (`/assistant`, MEDECIN/ADMIN)
- Desktop 2-col: left rail **"Nouvelle conversation"** + conversation list (⚕ patient-linked badge, title, delete); main = config banner ("Assistant non configuré… GEMINI_API_KEY"), patient-context note + **"Retirer"**, thread (welcome: Sparkles + "Comment puis-je vous aider ?"), composer ("Posez votre question…" + send). Provider label "Google Gemini · {model}". Mobile: "Nouvelle" + "Conversations (N)" toggle + thread + composer. Entry: **"Demander à l'IA"** button in dossier → `/assistant?patient=…`.

### 5.17 Notifications (settings tab) — uncommitted but in scope
- **NotificationTemplatesTab** (Paramètres → "Notifications", ADMIN): intro text + **"Ajouter un modèle"**; table [Événement, Canal, Aperçu, Statut, actions Modifier/trash]; drawer (Événement select [RDV créé / Rappel (J-1) / Ordonnance prête], Canal WHATSAPP/EMAIL, Sujet [email], Corps + placeholders {{patientNom}}/{{patientPrenom}}/{{date}}/{{heure}}/{{medecin}}/{{cabinet}}/{{motif}}, Nom template Meta [WhatsApp], Actif). Plus a **patient opt-in toggle** (consent + canal) to add in the dossier.

### 5.18 Paramètres (`/parametres`) — ADMIN tabs + mobile menu hub
- Desktop tab bar: **Cabinet/Clinique/Hôpital identity** (Type select, Nom*, Téléphone*, Adresse*, Ville*, Email, INPE, N° CNOM, ICE, RIB; Services internes checkboxes [Laboratoire / Radiologie / Pharmacie interne]; Hospitalisation checkbox; "Enregistrer") · **Tarifs** (NORMAL/PREMIUM discount %) · **Prestations** (code/libellé/tarif/actif CRUD) · **Modèles d'ordonnance** (sub-tabs Médicaments/Analyses/Imagerie + `PrescriptionTemplateDrawer`) · **Consentements** (`ConsentTemplatesTab`) · **Courriers confrère** (`LetterTemplatesTab`) · **Notifications** · **Utilisateurs** (`UtilisateursTab`: create user Email/Mot de passe/Rôle/Prénom/Nom/Téléphone/Spécialité/Médecins gérés; reset-password dialog) · **Congés** (practitioner leave CRUD, "À venir"/"Passé" badges) · **Droits d'accès** (permission matrix by role) · **Vaccinations** (`VaccinationParamTab` + OrphanRolesPanel) · **Stock** (`StockParamTab`) · **Chambres & lits** (`ChambresLitsTab`). Plus **LogoSettingsSection** (upload + position En-tête/Pied/Filigrane/Aucun), **SignatureSettingsSection**, **RoomsManagementSection**, **AgendaIsolationToggle**.
- Mobile `ParametragePage.mobile` = **menu hub** (the "Plus" tab): profile header + sections Tableau de bord / Cabinet (Paramétrage, Charges, Personnel) / Suivi clinique (Consultations, Vaccinations, Grossesses, Stock, Hospitalisation — with badges) / Communication (Messages, Assistant IA) / Catalogues (Médicaments, Analyses, Radio) / Compte (Mon profil, Déconnexion). `MenuRow` = icon + label + hint + badge + chevron. Footer "careplus · v1".

---

## 6. Consolidated modal/drawer/dialog list (don't miss any)
AppointmentDrawer · AddWalkInDialog · CancelAppointmentDialog · PriseRDVDialog · QuickVitalsDialog · CertificatDialog · FollowUpDialog · PromoteDiagnosisDialog · SuspendChoiceDialog · SignatureLock dialog · PrescriptionDrawer · PrescriptionTemplatePicker · ConfrereLetterDialog · ConsentDialog · DocumentPreviewDialog · WebcamCaptureModal · NewPatientMobileSheet · EditPatientMobileSheet · InvoiceDrawer · PaymentDialog · CreditNoteDialog · AdvancedFiltersPopover · Charges form drawer · Personnel form drawer + detail modal · StockArticleFormDrawer · MovementDrawer · LotInactivateDialog · AdmissionForm · StayDetailPanel · RecordDoseDrawer · PregnancyVisitDrawer · PregnancyUltrasoundDrawer · PregnancyCloseDialog · CreateChildDialog · PrescriptionTemplateDrawer · Reset-password dialog · MentionPickerPopover · EmojiPickerPopover · PatientPickerPopover · MobileColleaguePicker · NotificationTemplate drawer · AddDoctorModal · ⌘K PatientSearchSpotlight.

## 7. Cross-cutting states & motion
- **Loading:** "Chargement…" + skeleton tiles/rows; spinners inline.
- **Empty:** muted centered "Aucun(e) …" copy (per screen).
- **Error:** red banner / red field border + message; toast for actions.
- **Toasts:** success (green) / error (red), top-level, auto-dismiss.
- **Focus/keyboard:** visible focus ring (primary), Esc closes overlays, Enter submits/sends.
- **Live polling badges:** salle/vaccinations/grossesses/stock counts, chat unread — keep a subtle "live" affordance.

---

### Ask to the designer
Deliver: refreshed token set (§1) + semantic/status system (§2) + restyled shared components with all variants/states (§3–§4) + the full visual language applied to **every** screen in §5 for **both desktop and mobile**, preserving all French labels, controls, and states. Provide light theme (and optionally dark). Keep it implementable as CSS custom properties + the existing component contracts.
