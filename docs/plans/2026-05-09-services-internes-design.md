# Services internes — Design (2026-05-09)

Module pour : (1) logo établissement injecté sur les PDFs, (2) workflow d'envoi
en interne d'une demande LAB/IMAGING au lieu d'un bon papier, (3) nouveaux
rôles RADIO et LAB pour traiter les demandes et téléverser les résultats.

## Décisions clés (validées avec utilisateur)

- **Séquencement** : slice A (logo) en commit isolé, puis B+C bundlés
  (queue + rôles n'ont pas de sens l'un sans l'autre).
- **Modèle de données B** : colonnes ajoutées sur la ligne d'ordonnance
  existante, pas de nouvelle table. La queue = SELECT lignes WHERE
  internal_status IS NOT NULL.
- **Rôles C** : codes `RADIO` et `LAB` ajoutés à `identity_role` ; un user
  accumule des rôles (table `identity_user_role` est déjà multi-rôle).
- **Logo position PDF** : à gauche, nom + meta à droite. Pas de filigrane,
  pas de remplacement total.

## Slice A — Logo établissement

### Migration V036
```sql
ALTER TABLE configuration_clinic_settings
    ADD COLUMN logo_blob BYTEA NULL,
    ADD COLUMN logo_mime VARCHAR(64) NULL,
    ADD COLUMN logo_uploaded_at TIMESTAMPTZ NULL;
```

### Backend
- **Endpoints** (`SettingsController`, calque exact du pattern signature V035) :
  - `GET /api/settings/clinic/logo/meta` — métadonnées (mime + sizeBytes + uploadedAt). 204 si absent. Tous rôles auth.
  - `GET /api/settings/clinic/logo` — bytes bruts (image/png|jpeg). 204 si absent. Tous rôles auth.
  - `PUT /api/settings/clinic/logo` — multipart "file". ADMIN-only.
  - `DELETE /api/settings/clinic/logo` — idempotent. ADMIN-only.
- **Validation** : MIME ∈ {image/png, image/jpeg}, taille ≤ 500 KB.
  SVG repoussé en BACKLOG (nécessite `openhtmltopdf-svg-support`).
- **DTO** : `ClinicSettingsView` gagne `boolean hasLogo`. Le blob n'est PAS
  retourné par GET /clinic — séparé pour éviter de polluer chaque fetch.

### PDF — injection
- `PrescriptionPdfService.fetchCabinetSettings()` étendu pour lire
  `logo_blob, logo_mime` ; encodage base64 + variables Thymeleaf
  `cabinetLogoBase64` et `cabinetLogoMime` (null si pas de logo).
- Pattern identique à `signatureBase64` / `signatureMime` (V035).
- `VaccinationBookletPdfService` reçoit le même traitement (carnet vacc).

### Templates
3 templates existants : `ordonnance.html`, `certificat.html`,
`vaccination-booklet.html`. Header gauche réécrit pour rendre `<img>` data URL
si `cabinetLogoBase64 != null`, sinon le texte seul (rendu actuel inchangé).

```html
<div class="header-left">
    <img th:if="${cabinetLogoBase64 != null}"
         th:src="'data:' + ${cabinetLogoMime} + ';base64,' + ${cabinetLogoBase64}"
         style="max-height:80px;max-width:160px;float:left;margin-right:14px;"
         alt="Logo"/>
    <div class="cabinet-name" th:text="...">Cabinet</div>
    <!-- adresse / ville / tél / inpe / cnom : inchangé -->
</div>
```

**Hors scope v1** : la facture (template HTML séparé non-Thymeleaf, à
inspecter en B+C ou en commit dédié).

### UI
Nouvelle section `LogoSettingsSection` dans onglet Cabinet de `/parametres`
(parallèle exact de `SignatureSettingsSection`). Mobile : pas d'écran
dédié — la page mobile `/parametres` redirige vers desktop pour les actions
admin.

### IT (commit séparé)
`ClinicLogoIT.java` :
- upload PNG OK → `hasLogo=true`
- upload JPEG OK
- upload PDF (mauvais mime) → 400 LOGO-MIME
- upload 600 KB → 400 LOGO-TOO-BIG
- DELETE puis GET → 204
- SECRETAIRE upload → 403
- ordonnance + bytes du logo présent dans le HTML rendu (assertion sur
  marqueur base64 dans le HTML intermédiaire avant pdf renderer)

## Slice B+C — Workflow demandes internes + rôles RADIO / LAB

### Migration V037
```sql
ALTER TABLE clinical_prescription_line
    ADD COLUMN internal_status VARCHAR(16) NULL,
    ADD COLUMN internal_assigned_at TIMESTAMPTZ NULL,
    ADD COLUMN internal_claimed_by UUID NULL,
    ADD CONSTRAINT clinical_prescription_line_internal_status_chk
        CHECK (internal_status IS NULL
               OR internal_status IN ('PENDING','IN_PROGRESS','DONE','CANCELLED'));

CREATE INDEX idx_prescription_line_internal_status
    ON clinical_prescription_line (internal_status)
    WHERE internal_status IS NOT NULL;

INSERT INTO identity_role (id, code, label_fr) VALUES
    ('00000000-0000-0000-0000-000000000005', 'RADIO', 'Technicien radiologie'),
    ('00000000-0000-0000-0000-000000000006', 'LAB',   'Technicien laboratoire');
```

### State machine
```
NULL ──(médecin coche "Réaliser en interne")──► PENDING
PENDING ──(technicien claim)──► IN_PROGRESS
IN_PROGRESS ──(upload résultat)──► DONE   (V015 result_document_id rempli)
PENDING|IN_PROGRESS ──(médecin annule)──► CANCELLED
```

### Endpoints
- `GET /api/internal-requests?service=LAB&status=PENDING` — LAB+RADIO+MEDECIN+ADMIN
- `POST /api/internal-requests/{lineId}/claim` — LAB ou RADIO selon service
- `POST /api/internal-requests/{lineId}/cancel` — MEDECIN+ADMIN
- `POST /api/internal-requests/{lineId}/result` — réutilise mécanisme V015 + transitionne IN_PROGRESS → DONE

### UI
- **Drawer LAB/IMAGING** (`PrescriptionDrawer`) : toggle "Réaliser en interne"
  visible si flag `imagingInternal` ou `labInternal` actif. S'applique à
  toutes les lignes du formulaire (v1).
- **Sidebar** : entrée "Laboratoire" si user a rôle LAB → `/queue/lab`. Idem
  "Radiologie" pour RADIO. À ajouter aussi au menu Plus mobile.
- **Page queue** (`/queue/{service}`) : 3 onglets (En attente / En cours /
  Traitées). Cards desktop + mobile. Bouton "Prendre en charge" → claim,
  "Téléverser résultat" → upload + transition.
- **Onglet Utilisateurs** dans paramètres : 2 nouvelles cases (LAB, RADIO).
  Désactivées si flag interne correspondant `false`, avec tooltip.

### IT
`InternalRequestIT.java` (~10 scénarios, voir section design 4/4 du
brainstorming pour la liste complète).

## Estimation

| Slice | Commits | Effort |
|---|---|---|
| A — Logo | 1 feature + 1 IT | ~3 h |
| B+C — Queue + rôles | 3 (BE / FE / IT) | ~6-8 h |

## BACKLOG (post-livraison)

- Logo SVG : ajouter `openhtmltopdf-svg-support` + tester rendu
- Logo dans facture : nécessite que la facture passe par un template
  Thymeleaf (n'est pas le cas en v1)
- Toggle "interne" par-ligne (pas par-formulaire) si demandé
- Audit trail demandes internes : table `internal_request_history` si on
  veut tracer les transitions et les acteurs (sinon on perd l'info quand
  la ligne passe à DONE)
