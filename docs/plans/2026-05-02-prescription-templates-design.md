# Design — Modèles de prescription réutilisables (QA6-2 + QA6-3)

**Date** : 2026-05-02
**Auteur** : Y. OUAKRIM (avec Claude)
**Origine** : retour terrain Y. Boutaleb 2026-05-02 — *« Permettre au médecin de confectionner des prescriptions de médicament et pouvoir les utiliser automatiquement au moment de la consultation, avec possibilité de modification au moment de consultation. »* + *« Même chose pour les bons d'analyses. »*

## Décisions UX (validées en brainstorming)

| # | Question | Choix |
|---|---|---|
| 1 | Scope des modèles | **Privé médecin** — chaque praticien voit/édite uniquement les siens. FK `practitioner_id`, filtré par JWT. |
| 2 | Charger un modèle sur drawer non-vide | **Append** — les lignes du template sont ajoutées à la suite. Multi-template natif (charger plusieurs successivement). |
| 3 | UX picker en consultation | **Bouton + popover filtrable** — bouton `+ Charger un modèle` dans le header du `PrescriptionDrawer`. Popover avec recherche client-side. Plein écran sur mobile <768px. |
| 4 | CRUD des modèles | **Onglet Paramétrage dédié** — `/parametres/modeles-ordonnance` avec sub-tabs DRUG / LAB / IMAGING. Drawer création/édition réutilise `PrescriptionDrawer` en mode `template`. |
| 5 | Polymorphisme | **Une seule table** avec discriminant `type` (DRUG/LAB/IMAGING) → QA6-2 et QA6-3 livrés ensemble, pas de duplication. |

## Modèle de données

### Migration `V020__prescription_templates.sql`

```sql
CREATE TABLE clinical_prescription_template (
    id              UUID         PRIMARY KEY,
    practitioner_id UUID         NOT NULL REFERENCES identity_user(id),
    name            VARCHAR(120) NOT NULL,
    type            VARCHAR(16)  NOT NULL CHECK (type IN ('DRUG','LAB','IMAGING')),
    lines           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    deleted_at      TIMESTAMPTZ,
    version         INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_rxtpl_practitioner_type
    ON clinical_prescription_template (practitioner_id, type)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uniq_rxtpl_practitioner_name
    ON clinical_prescription_template (practitioner_id, lower(name))
    WHERE deleted_at IS NULL;
```

### Forme du JSONB `lines`

Tableau d'objets, ordre intrinsèque préservé. Selon `type` :

**DRUG** :
```json
[{ "medicationId": "uuid", "medicationCode": "string", "dosage": "string", "frequency": "string", "duration": "string", "quantity": null|number, "instructions": "string" }]
```

**LAB** :
```json
[{ "labTestId": "uuid", "labTestCode": "string", "instructions": "string" }]
```

**IMAGING** :
```json
[{ "imagingExamId": "uuid", "imagingExamCode": "string", "instructions": "string" }]
```

**Pourquoi JSONB plutôt qu'une table fille `prescription_template_line`** :
- Ordre intrinsèque, jamais requêté indépendamment
- Pattern cohérent avec `consultation_amendment` et autres entités du projet
- Si un médic / lab / imaging est supprimé du catalogue, le JSONB conserve `*Code` + `*Id` ; le frontend matérialise en flaggant la ligne "obsolète" plutôt que de casser la jointure

**Limite** : max 20 lignes par template (garde-fou à valider côté Bean Validation).

## Endpoints REST

Tous sous `/api/prescription-templates`. RBAC : **MEDECIN/ADMIN seulement**. Filtrage implicite par `practitioner_id = JWT.subject` — un médecin ne voit jamais ceux d'un autre.

| Méthode | Path | Description | Codes |
|---|---|---|---|
| GET | `/api/prescription-templates?type=DRUG\|LAB\|IMAGING` | Liste ordonnée par `updated_at DESC` | 200 |
| GET | `/api/prescription-templates/{id}` | Détail | 200 / 404 (pas le mien) |
| POST | `/api/prescription-templates` | Création | 201 / 400 (validation) / 409 (nom dupliqué pour ce médecin + type) |
| PUT | `/api/prescription-templates/{id}` | Update | 204 / 400 / 404 / 409 (renommage en collision) |
| DELETE | `/api/prescription-templates/{id}` | Soft-delete via `deleted_at = now()` | 204 / 404 |

### DTOs

```java
record TemplateView(UUID id, String name, String type, List<LineView> lines, int lineCount, OffsetDateTime updatedAt) {}
record TemplateWriteRequest(@NotBlank @Size(max=120) String name, @NotBlank String type, @Size(min=1, max=20) @Valid List<LineWriteRequest> lines) {}
sealed interface LineWriteRequest permits DrugLineWriteRequest, LabLineWriteRequest, ImagingLineWriteRequest {}
```

(Sérialisation polymorphe via Jackson `@JsonTypeInfo`/`@JsonSubTypes`.)

### Validation

- `name` : 1–120 chars, non-blank
- `type` : DRUG | LAB | IMAGING (enum)
- `lines` : 1 à 20 éléments, chaque ligne validée selon son type
- DRUG line : `medicationId` UUID requis ; `dosage` non-blank ; `frequency`, `duration`, `quantity`, `instructions` optionnels
- LAB / IMAGING line : `*Id` UUID requis ; `instructions` optionnel
- Conflit 409 : pré-check `existsByPractitionerAndNameAndTypeAndDeletedAtIsNull` (pattern QA6-4 catalogue)

## UI Flow consultation

### Composant `PrescriptionTemplatePicker`

Path : `frontend/src/features/prescription/components/PrescriptionTemplatePicker.tsx`

**Trigger** : bouton `+ Charger un modèle` placé dans le header du `PrescriptionDrawer`, à droite du titre.

**Comportement click** :
1. Fetch `GET /api/prescription-templates?type=<type courant du drawer>` via TanStack Query (staleTime 30s).
2. Popover ouvre (Radix `Popover` desktop, `Dialog` plein écran si <768px).
3. Champ recherche en haut + liste filtrée client-side (la liste est petite, max ~50 modèles par médecin).
4. Click → callback `onLoad(template)` → popover se ferme.

**Empty state** : "Aucun modèle créé. Créez-en un depuis Paramétrage > Modèles d'ordonnance." + lien direct.

### Logique d'append dans `PrescriptionDrawer`

```ts
function handleTemplateLoad(template: PrescriptionTemplate) {
  setLines((prev) => {
    // Si le drawer est dans son état initial (1 ligne vide), on remplace
    // au lieu d'append pour ne pas garder la ligne vide en haut.
    const trimmed = prev.length === 1 && isLineEmpty(prev[0]) ? [] : prev;
    return [...trimmed, ...template.lines.map(materializeLine)];
  });
  toast.success(`Modèle « ${template.name} » ajouté (${template.lines.length} ligne${template.lines.length > 1 ? 's' : ''}).`);
}
```

**`materializeLine`** : re-hydrate le `medicationCode` du JSONB en objet `CatalogItem` complet via la liste déjà chargée, ou via un `GET /api/catalog/medications/{id}` lazy si pas trouvé. Si l'item est marqué `deleted_at` côté catalog, la ligne est ajoutée avec un warning visuel "obsolète, à remplacer" — non-bloquant, le médecin choisit d'éditer ou supprimer.

### États de bordure

- **Consultation SIGNEE** : bouton "Charger un modèle" caché (cohérent avec `disabled` sur tout le drawer).
- **Médic obsolète dans le template** : ligne ajoutée avec icône warning + texte "Médicament n'est plus au catalogue, à remplacer". Pas bloquant.
- **Réseau coupé pendant fetch** : toast "Impossible de charger les modèles" + bouton "Réessayer".

### Mobile (390px)

- Popover devient `Dialog` plein écran (pattern `MNouveauPatient`).
- Header : titre "Charger un modèle" + bouton fermer.
- Liste prend tout l'écran, item au tap.

## CRUD Paramétrage

### Onglet `PrescriptionTemplatesTab`

Path : `frontend/src/features/parametrage/PrescriptionTemplatesTab.tsx`

Ajouté à `ParametragePage` après "Droits d'accès".

**Layout** :
- Sub-tabs : `Médicaments | Analyses | Imagerie` (filtre `type`).
- Bouton `+ Nouveau modèle` en topbar à droite.
- Tableau : `Nom · Nb lignes · Mis à jour · Actions (Modifier / Supprimer)`.
- Empty state : "Aucun modèle. Créez-en un avec le bouton ci-dessus pour gagner du temps en consultation."

### Drawer création / édition

Réutilise `PrescriptionDrawer` via nouvelle prop `mode?: 'consultation' | 'template'` (défaut `'consultation'`).

En mode `template` :
- Champ `name` (text input) ajouté en haut.
- Pas de `consultationId` requis ; pas d'allergy override (les allergies dépendent d'un patient).
- Bouton submit devient "Enregistrer le modèle".
- POST/PUT vers `/api/prescription-templates`.

Cette factorisation évite de dupliquer l'autocomplete + l'éditeur de lignes.

### Hooks frontend

```
usePrescriptionTemplates(type: PrescriptionType)
usePrescriptionTemplate(id: string)
useCreatePrescriptionTemplate()
useUpdatePrescriptionTemplate()
useDeletePrescriptionTemplate()
```

Tous invalident la query `['prescription-templates', type]` après mutation.

## Permissions / RBAC

V1 : pas de permission atomique dédiée (en attendant QA3-3 RBAC granulaire). Les endpoints utilisent `@PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")` + filtrage par `practitioner_id = JWT.subject` côté service.

Quand QA3-3 livre la matrice de permissions atomiques, ajouter `PRESCRIPTION_TEMPLATE_MANAGE` à `identity_permission` + seedée pour MEDECIN+ADMIN.

## Tests

### Backend — `PrescriptionTemplateIT.java`

~12 scénarios couvrant :

1. POST happy → 201 + GET retourne avec lines correctement parsées
2. GET liste filtrée par practitioner_id du JWT (médecin A ne voit jamais ceux de B)
3. 409 sur nom dupliqué (même médecin, même type)
4. 200 sur même nom mais type différent (DRUG/LAB peuvent partager le nom)
5. 403 secrétaire sur POST/PUT/DELETE
6. 404 sur GET/PUT/DELETE d'un id qui n'appartient pas au médecin courant
7. 400 sur name vide
8. 400 sur lines vide
9. 400 sur lines > 20
10. PUT avec renommage en collision → 409
11. DELETE soft-delete : GET ne retourne plus l'item, row reste avec deleted_at
12. Polymorphisme : les 3 types (DRUG/LAB/IMAGING) round-trip propre via JSONB

### Frontend — vitest

- `PrescriptionTemplatesTab.test.tsx` : CRUD + filtre par sub-tab type
- `PrescriptionTemplatePicker.test.tsx` : ouverture popover, search filter, click → onLoad
- `PrescriptionDrawer.test.tsx` : ajout d'un cas pour append après load template

## Estimation

| Phase | Effort |
|---|---|
| Backend (migration + entité + repo + service + controller + IT) | 1 j |
| Frontend Paramétrage (tab + drawer mode template + hooks + tests) | 1 j |
| Frontend consultation (picker + append dans drawer + tests) | 0,5 j |
| QA IHM desktop + mobile 390px + bottle | 1 j |
| **Total bundlé QA6-2 + QA6-3** | **~3,5 j** |

Estimation backlog initiale était de 5,5 j séparés (QA6-2 = 5 j + QA6-3 = 0,5 j). Le bundle gagne ~2 j parce que l'entité polymorphe + les composants réutilisés évitent la duplication.

## Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| JSONB rend les requêtes "quel médic est le plus prescrit" plus complexes | Faible (post-MVP) | Quand on aura besoin de stats, on extraira en table fille via une nouvelle migration |
| Médic supprimé du catalogue → ligne du template obsolète | Moyen | Frontend matérialise avec warning visuel non-bloquant ; ne pas casser le drawer |
| Médecin recruté hérite de zéro modèle | Faible (cabinet mono-médecin en MVP) | Si demande terrain → ouvrir QA6-2-bis avec mécanisme "partager au cabinet" |
| Confusion template vs renouvellement d'ordonnance | Moyen | Renouvellement reste un item séparé (`Prescription par type` dans BACKLOG) — clone une ordonnance signée existante. Template = construction *à froid*, renouvellement = clonage *à chaud*. |

## Plan de livraison

Ordre proposé (parallel-sync ADR-021) :

1. **Commit 1** — design doc seul (ce fichier).
2. **Commit 2** — backend complet : V020 migration + entité + repo + service + controller + DTOs + `PrescriptionTemplateIT.java` (12 scénarios). Doit être vert sur `mvn verify`.
3. **Commit 3** — frontend Paramétrage : tab + drawer mode template + hooks + vitest tests.
4. **Commit 4** — frontend consultation : picker + append + test du drawer mis à jour.
5. **QA IHM** : drive Playwright/chrome-devtools sur les 2 écrans (Paramétrage CRUD + consultation picker), desktop + mobile 390px, screenshots.
6. **Commit 5** (optionnel si QA révèle un fix) ou push direct.

Push après chaque commit pour éviter les big-bang. Le pre-push hook (`scripts/githooks/pre-push`) validera le build frontend avant chaque push.

Mise à jour de `docs/BACKLOG.md` à la fermeture des items QA6-2 + QA6-3.
