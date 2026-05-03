# Plan de test QA — Module Vaccination enfant

**Date** : 2026-05-03
**Module** : Vaccination (Étapes 1-6 livrées, commits `290129f` → `09ca5c8`)
**Pour** : QA fonctionnel (manuel) — pré-déploiement pilote.
**Couverture** : 4 surfaces utilisateur + 1 PDF + RBAC.

## Comptes de test

À créer si absents (via `/parametres > Utilisateurs`) :

| Login | Rôle | Mot de passe | Usage |
|---|---|---|---|
| `medecin@test.ma` | MEDECIN | `Test-2026!` | Saisir / éditer / signer / paramétrer |
| `assistant@test.ma` | ASSISTANT | `Test-2026!` | Vacciner sous délégation (saisir doses) |
| `secretaire@test.ma` | SECRETAIRE | `Test-2026!` | Lecture seule worklist + dossier |
| `admin@test.ma` | ADMIN | `Test-2026!` | Référentiel vaccins + calendrier |

## Données de test à seeder

À créer manuellement via `/patients > Nouveau patient` :

| Patient | DDN | Âge approx. | Attendu sur calendrier |
|---|---|---|---|
| TestVacc-bebe | aujourd'hui | 0 mois | 25 doses PLANNED, BCG + HepB1 OVERDUE |
| TestVacc-2mois | aujourd'hui − 2 mois | 2 mois | Penta D1 + VPI + Pneumo + Rota DUE_SOON |
| TestVacc-1an | aujourd'hui − 12 mois | 12 mois | ROR1 + HepB3 + Pneumo rappel DUE_SOON |
| TestVacc-5ans | aujourd'hui − 5 ans | 5 ans | ROR2 + DTP rappel 2 OVERDUE/UPCOMING |
| TestVacc-adulte | 1980 | 45 ans | calendar vide (aucune dose pertinente) |

---

## Surface 1 — Dossier patient → Onglet Vaccination (desktop)

**Path** : `/patients/{id}` → onglet « Vaccinations » (5ᵉ position, entre « Prescriptions » et « Analyses »).

### Scénarios

1. **Affichage calendrier matérialisé**
   - Ouvrir TestVacc-bebe → onglet Vaccinations.
   - ✅ Attendu : 25 cartes regroupées par âge (Naissance / 2 mois / 4 mois / 12 mois / 18 mois / 5 ans / 11 ans).
   - ✅ Codes couleur : rouge (OVERDUE), ambre (DUE_SOON), gris (UPCOMING).

2. **Saisir une dose ADMINISTERED**
   - Cliquer sur la carte BCG → drawer « Saisir dose » s'ouvre, champs `vaccine` et `dose` pré-remplis.
   - Remplir : date = aujourd'hui, lot = `ABC123`, voie = `ID`, site = `Bras gauche`.
   - Cliquer « Enregistrer ».
   - ✅ Attendu : carte BCG passe au vert, lot `ABC123` affiché, drawer fermé.
   - ✅ Vérifier persistance en base : `SELECT * FROM vaccination_dose WHERE patient_id = '...' AND vaccine_id = '...';` doit montrer la dose.

3. **Lot obligatoire**
   - Re-cliquer sur HepB1 → drawer.
   - Remplir tout sauf le lot. Cliquer « Enregistrer ».
   - ✅ Attendu : message d'erreur sous le champ lot « Numéro de lot obligatoire ». Pas d'enregistrement.

4. **Saisir 2× la même dose**
   - Cliquer à nouveau sur BCG → drawer en mode édition (vue de la dose déjà saisie).
   - ✅ Attendu : champs en lecture seule, badge `ADMINISTERED`.

5. **Reporter (DEFER)**
   - Cliquer sur Penta D1 (DUE_SOON) → drawer.
   - Cliquer « Reporter » → modal `DeferModal` → motif = « Fièvre passagère ».
   - ✅ Attendu : carte Penta D1 hachurée + tooltip « Fièvre passagère ». Drawer fermé.

6. **Skipper (MEDECIN/ADMIN seulement)**
   - Login MEDECIN : sur HepB1 (DEFERRED) → cliquer « Marquer non administrée » → confirm.
   - ✅ Attendu : carte barrée, statut SKIPPED.
   - Login ASSISTANT sur le même flux : ✅ bouton « Marquer non administrée » non visible / désactivé.

7. **Imprimer carnet PDF**
   - Header onglet → bouton « Imprimer carnet ».
   - ✅ Attendu : nouveau onglet navigateur → PDF avec : nom enfant + DDN, tableau (Vaccin / Dose / Date / Lot / Voie / Site / Administré par / Signature).
   - Vérifier : doses ADMINISTERED listées par ordre chronologique. PLANNED/DEFERRED non listées.

8. **Patient adulte = calendrier vide**
   - Ouvrir TestVacc-adulte → onglet Vaccinations.
   - ✅ Attendu : 0 carte, message vide « Aucune vaccination ».

### RBAC à vérifier

| Action | SECRETAIRE | ASSISTANT | MEDECIN | ADMIN |
|---|---|---|---|---|
| Voir l'onglet | ✅ | ✅ | ✅ | ✅ |
| Saisir dose | ❌ (bouton invisible) | ✅ | ✅ | ✅ |
| Reporter | ❌ | ✅ | ✅ | ✅ |
| Skipper | ❌ | ❌ | ✅ | ✅ |
| Modifier | ❌ | ❌ | ✅ | ✅ |
| Imprimer carnet | ✅ | ✅ | ✅ | ✅ |

---

## Surface 2 — Dossier patient → Onglet Vaccination (mobile 390 px)

**Path** : Chrome DevTools → device toolbar → mobile 390 px → login → dossier patient → onglet Vaccinations.

### Scénarios

1. **Bottom-sheet** : tap sur une carte → bottom-sheet Vaul s'ouvre avec drag handle. Form complet.
2. **Saisir dose** : même flow qu'en desktop. Vérifier que safe-area-inset-bottom respecte le notch.
3. **Imprimer carnet** : footer fixe à 76 px du bas (bouton « Imprimer carnet ») → tap → PDF.
4. **Scrolling** : 25 cartes scrollables, header sticky.

---

## Surface 3 — Page transversale `/vaccinations` (desktop)

**Path** : Sidebar → item « Vaccinations » (entre « Facturation » et « Catalogue »).

### Scénarios

1. **Badge sidebar**
   - Au login, attendre 30 s.
   - ✅ Attendu : si OVERDUE > 0, badge rouge avec compteur sur l'item « Vaccinations ».

2. **3 onglets**
   - Onglet « En retard » (par défaut) → liste OVERDUE triée par jours de retard DESC.
   - Onglet « Dues cette semaine » → DUE_SOON.
   - Onglet « Dues ce mois » → UPCOMING (horizon 30 j).

3. **Filtres**
   - Sélectionner « BCG » dans « Vaccin » → liste filtrée.
   - Cliquer « 0-12 mois » → filtre âge appliqué + URL met à jour `?status=OVERDUE&page=0&vaccineCode=BCG`.

4. **Saisir dose depuis worklist**
   - Cliquer « Saisir dose » sur la ligne TestVacc-bebe / BCG.
   - ✅ Attendu : drawer pré-rempli (vaccin + dose + patient).
   - Remplir + enregistrer → ligne disparaît de la worklist OVERDUE.

5. **Lien profil patient**
   - Cliquer sur le nom du patient dans la ligne.
   - ✅ Attendu : navigation vers `/patients/{id}` avec onglet Vaccinations actif.

6. **Pagination**
   - Si > 50 entrées → bouton « Suivant » actif.
   - Cliquer → page 2, URL `?page=1`.
   - ✅ Attendu : compteur « Page 2 / N » correct.

### RBAC

| Rôle | Accès `/vaccinations` |
|---|---|
| SECRETAIRE | ✅ lecture seule (bouton « Saisir dose » invisible) |
| ASSISTANT | ✅ peut saisir |
| MEDECIN | ✅ tout |
| ADMIN | ✅ tout |

---

## Surface 4 — Page `/vaccinations` (mobile 390 px)

1. **Cartes empilées** (pas de tableau).
2. **3 tabs sticky** en haut : En retard / Cette semaine / Ce mois.
3. **Bouton « Saisir »** par carte → bottom-sheet drawer.
4. **Charger plus** : bouton en bas, accumule jusqu'à `totalElements`.

---

## Surface 5 — Paramétrage → Onglet Vaccinations (desktop ADMIN/MEDECIN)

**Path** : `/parametres` → onglet « Vaccinations » (à droite des « Droits d'accès »). Pas de version mobile (rejected scope).

### Scénarios

1. **Section Vaccins**
   - ✅ Tableau ~12 vaccins PNI seedés (BCG, HepB, Penta, VPI, VPO, Pneumo, Rota, ROR, DTP, HPV, Hexa, TD) avec badge `PNI` vert.
   - ✅ 2 vaccins non-PNI (HepA, Varicelle).

2. **Ajouter vaccin non-PNI**
   - Bouton « Ajouter un vaccin » → drawer.
   - Code = `MENI` (auto-uppercase), nom = `Méningococcique ACWY`, voie = `IM`, actif = ✅.
   - Enregistrer.
   - ✅ Attendu : ligne ajoutée, sans badge PNI, bouton trash visible.

3. **PNI lock — pas de delete**
   - Sur la ligne BCG (PNI) : ✅ bouton trash absent.
   - Sur la ligne HepA (non-PNI) : ✅ bouton trash visible.
   - Si on force un DELETE en curl : `DELETE /api/vaccinations/catalog/{bcg-id}` → 422 PNI_PROTECTED.

4. **Modifier un vaccin**
   - Cliquer Modifier sur HepA → drawer en mode édition.
   - Le code est en lecture seule, le reste éditable.
   - Renommer en « Hépatite A — vaccin », enregistrer.
   - ✅ Attendu : tableau mis à jour.

5. **Section Calendrier**
   - ✅ Tableau ~25 doses planifiées (Vaccin / N° dose / Âge cible / Tolérance / Libellé).

6. **Ajouter une dose au calendrier**
   - Bouton « Ajouter une dose » → drawer.
   - Vaccin = MENI (créé scénario 2), dose = 1, âge = 60 j (preset « 2 mois »), tolérance = 30, libellé = `MENI 2 mois D1`.
   - Enregistrer.
   - ✅ Attendu : ligne ajoutée. Si on créé TestVacc-2mois après, MENI doit apparaître dans son calendrier.

7. **Conflit dose existante**
   - Re-créer (BCG, dose=1) → 409 « Cette dose existe déjà pour ce vaccin ».

8. **Supprimer une dose**
   - Sur MENI dose=1 → bouton trash → modal de confirmation.
   - Confirmer → ligne supprimée.

### RBAC

| Rôle | Accès onglet Vaccinations |
|---|---|
| SECRETAIRE | ❌ Onglet « Paramétrage » non visible (RBAC sidebar) |
| ASSISTANT | ❌ Idem |
| MEDECIN | ✅ Tout |
| ADMIN | ✅ Tout |

---

## Surface 6 — Endpoint PDF carnet (vérification format)

**Path** : `GET /api/patients/{id}/vaccinations/booklet` (depuis tous les rôles).

### Scénarios

1. **Magic bytes** : `curl -i -H "Authorization: Bearer ..." .../booklet` → `Content-Type: application/pdf`, premiers octets = `%PDF`.
2. **Filename** : `Content-Disposition: inline; filename=carnet-vaccination-{lastName}-{firstName}.pdf`.
3. **Patient inconnu** : `GET /api/patients/00000000-0000-0000-0000-000000000000/vaccinations/booklet` → 404 PATIENT_NOT_FOUND.
4. **Aucune dose ADMINISTERED** : PDF généré quand même, tableau vide avec en-tête.

---

## Bugs déjà corrigés en QA wave 7 (2026-05-03)

Pour mémoire, à NE PAS reproduire — couverts par `VaccinationQueueDtoContractIT` :

- `VaccinationQueueEntry` : `patientFullName` → `patientFirstName` + `patientLastName`, ajout `vaccineId` + `scheduleDoseId`.
- `PageView` : ajout `number` + `totalPages` (alias `pageNumber`/`pageSize` conservés).

## Critères d'acceptation pilote

- ✅ Tous les scénarios des 6 surfaces verts.
- ✅ Aucun crash console (Chrome DevTools → onglet Console pendant les walks).
- ✅ Mobile 390 px navigable d'un seul doigt (pas de scroll horizontal).
- ✅ PDF carnet ouvrable dans tous les viewers testés (Chrome, Firefox, Safari, Acrobat).
- ✅ Pas de régression sur les modules autres (sondage rapide : agenda, salle d'attente, consultation, facturation).

## Reporting

Pour chaque scénario testé, le QA reporte :

| Scénario | Résultat | Capture | Remarque |
|---|---|---|---|
| 1.1 Affichage calendrier | ✅ / ❌ | path/screenshot | (libre) |

En cas de bug : ticket Linear avec étiquette `vaccination`, captures, étapes de repro précises (`localhost:5173` ou env staging selon contexte).
