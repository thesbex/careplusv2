# Cloisonnement Grossesse — Design figé 2026-05-09

Design issu du brainstorming session 2026-05-09. Étend le cloisonnement V036 (vaccination) au module Grossesse.

## Décisions validées

1. **Critère de rattachement** : *toute action obstétricale*. Un médecin est rattaché à la grossesse de la patiente Y dès qu'il a effectué au moins une action sur le dossier (déclaration, visite, écho, plan de visite). Symétrie exacte avec V036 vaccination.
2. **Patients orphelins** : paramètre cabinet dédié `pregnancy_orphan_visible_roles VARCHAR(32)[]`, default = tous les rôles. Indépendant de `vaccination_orphan_visible_roles` pour granularité fine.
3. **Réaffectation** : *cumulatif implicite*. Tout médecin qui agit se rattache automatiquement. Aucune UI « transférer ». Symétrie V036.

## Architecture

### Source du rattachement (requête SQL bulk unique)

```sql
SELECT p.id AS pregnancy_id, COALESCE(rb, cb) AS practitioner_id FROM (
  SELECT pr.id, NULL::uuid AS rb, pr.created_by AS cb
    FROM pregnancy pr WHERE pr.status = 'EN_COURS' AND pr.created_by IS NOT NULL
  UNION ALL
  SELECT pv.pregnancy_id, pv.recorded_by, pv.created_by
    FROM pregnancy_visit pv
  UNION ALL
  SELECT pu.pregnancy_id, pu.recorded_by, pu.created_by
    FROM pregnancy_ultrasound pu
  UNION ALL
  SELECT pvp.pregnancy_id, NULL::uuid, pvp.created_by
    FROM pregnancy_visit_plan pvp WHERE pvp.created_by IS NOT NULL
) p WHERE COALESCE(rb, cb) IS NOT NULL
```

Pré-charge `Map<UUID pregnancyId, Set<UUID> practitioners>` une fois, puis filtrage en mémoire `Collections.disjoint(rattaches, allowedPractitioners)`. Pas de nouvel index — FK existantes suffisent au scope MVP (~50 grossesses actives max).

### Service layer

`PregnancyQueueServiceImpl.queue(QueueFilters, Authentication)` :
- `Optional<Set<UUID>> scopeOpt = accessScope.allowedPractitioners(auth)` — empty = bypass (ADMIN, isolation OFF, 1 seul MEDECIN actif).
- Si scope présent : pré-charge la map, lit `pregnancy_orphan_visible_roles`, calcule `callerCanSeeOrphans`.
- Boucle sur grossesses `EN_COURS` : filtre orphelin/rattaché *avant* le calcul SA + alertes (économise N+1 alertes).
- Bypass V036 hérité gratuitement via `AccessScopeService` — aucune logique dupliquée.

### Controller

`PregnancyQueueController` : ajouter `Authentication auth` au handler, passer au service. Aucun changement de signature publique de l'endpoint.

## Migration V039

```sql
ALTER TABLE configuration_clinic_settings
  ADD COLUMN IF NOT EXISTS pregnancy_orphan_visible_roles VARCHAR(32)[] NOT NULL
    DEFAULT ARRAY['MEDECIN','ADMIN','SECRETAIRE','ASSISTANT']::VARCHAR(32)[];

COMMENT ON COLUMN configuration_clinic_settings.pregnancy_orphan_visible_roles IS
    'Liste des codes de rôle autorisés à voir une grossesse sans médecin référent (orpheline) dans la queue, quand agenda_strict_isolation = TRUE. Default = tous les rôles. Codes : MEDECIN, ADMIN, SECRETAIRE, ASSISTANT.';
```

Default = tous les rôles → comportement actuel préservé tant que l'admin ne durcit pas.

## UI Paramètres

Refactor `VaccinationOrphanRolesPanel.tsx` → `OrphanRolesPanel` paramétrable (`module: 'vaccination' | 'pregnancy'`). Deux instances dans la page Paramètres → Cloisonnement. Endpoint `PUT /api/parametres/clinic-settings` étendu pour `pregnancy_orphan_visible_roles` (champ optionnel).

## Tests

`PregnancyQueueIsolationIT` calqué sur `VaccinationQueueIsolationIT` — 8 scénarios :
1. Isolation OFF → MEDECIN voit toutes les grossesses
2. ON, MEDECIN ∈ orphan_roles → voit orphelines
3. ON, MEDECIN ∉ orphan_roles → ne voit rien
4. ON, grossesse rattachée à Dr A (visite) → Dr A voit
5. ON, grossesse rattachée à Dr A → Dr B ne voit pas
6. ON, ADMIN bypass → voit tout
7. ON, rattachement via `pregnancy.created_by` (déclaration sans visite) suffit
8. ON + 1 seul MEDECIN actif → bypass

QA IHM Playwright : walk desktop + mobile (390 px) sur localhost:5173 — 2 médecins, 1 grossesse rattachée à Dr A, vérifier file de Dr B vide, toggle cloisonnement OFF, vérifier que Dr B la voit.

## Plan d'exécution

Ordre :
1. QA Playwright commits feature en attente (`8f2c80d` salle-attente, `7b05dfe` catalog V038).
2. **Commit BE-1** — `feat(grossesse): cloisonnement file Grossesse — symétrie V036 vaccination` (V039 + service + IT).
3. **Commit FE-1** — `feat(parametres): panneau orphelins grossesse + refactor OrphanRolesPanel`.
4. **ADR-032** dans `docs/DECISIONS.md`.
5. **PROGRESS.md** mis à jour.

## Hors scope (explicite)

- Pas de `pregnancy.lead_practitioner_id` (cumulatif implicite).
- Pas de UI « transférer le suivi » / « quitter le suivi ».
- Pas d'application aux modules autres que vaccination + grossesse.
- Pas de renommage rétroactif du paramètre vaccination.
