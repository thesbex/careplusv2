# Sauvegarde & restauration de la base careplus (on-premise Windows)

Deux scripts PowerShell pour exploiter une base PostgreSQL careplus déployée
chez le client, avec sauvegarde quotidienne sur disque dur externe et
restauration encadrée.

> Prérequis : les binaires PostgreSQL (`pg_dump.exe`, `pg_restore.exe`) doivent
> être installés. S'ils ne sont pas dans le `PATH`, indiquez leur dossier via
> `-PgBin "C:\Program Files\PostgreSQL\16\bin"` ou la variable d'environnement
> `CAREPLUS_PG_BIN`.

## 1. Sauvegarde quotidienne (`careplus-backup.ps1`)

Effectue un `pg_dump -Fc` (format custom, compressé), horodaté, applique une
rétention et journalise dans `careplus-backup.log` du dossier de destination.

```powershell
# Sauvegarde manuelle vers le disque externe E:
.\careplus-backup.ps1 -BackupDir E:\careplus-backups -RetentionDays 30
```

Paramètres de connexion (par priorité) : arguments CLI → variables
d'environnement (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`) →
défauts locaux (`localhost:5432/careplus`). Le mot de passe transite par
`PGPASSWORD` (jamais en argument visible).

### Planifier la sauvegarde tous les jours à 02:00

Via le **Planificateur de tâches Windows** (en une commande, à lancer en
administrateur — adaptez le chemin du script et le disque) :

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\careplus\scripts\backup\careplus-backup.ps1" -BackupDir "E:\careplus-backups" -RetentionDays 30'
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName 'CarePlus - Sauvegarde quotidienne' `
  -Action $action -Trigger $trigger -RunLevel Highest -Description 'pg_dump careplus vers disque externe'
```

> Définissez `PGPASSWORD` (ou un fichier `%APPDATA%\postgresql\pgpass.conf`) dans
> l'environnement du compte qui exécute la tâche, pour éviter de stocker le mot
> de passe dans la ligne de commande.

Le code de sortie (`0` succès / `1` échec) permet au Planificateur de signaler
une sauvegarde ratée. Vérifiez périodiquement `careplus-backup.log`.

## 2. Restauration (`careplus-restore.ps1`)

**DESTRUCTIF.** Remplace le contenu de la base par la sauvegarde choisie.
**Arrêtez l'application careplus avant** (aucune connexion active ne doit rester
ouverte sur la base).

```powershell
# 1. Arrêter le service / l'application careplus
# 2. Restaurer
.\careplus-restore.ps1 -DumpFile E:\careplus-backups\careplus_20260530_020000.dump
#    -> taper RESTAURER pour confirmer
# 3. Redémarrer l'application
```

`pg_restore --clean --if-exists --no-owner` supprime les objets existants avant
de recréer, et ignore les divergences de rôle propriétaire.

> Un écran de restauration **in-app** (réservé au super administrateur) est aussi
> disponible dans Paramètres ; il s'appuie sur le même mécanisme. Le script CLI
> reste le moyen de secours quand l'application ne démarre plus.

## Bonnes pratiques

- **Tester une restauration** régulièrement sur un poste de recette : une
  sauvegarde jamais restaurée n'est pas une sauvegarde.
- **Disque externe dédié**, idéalement tournant (rotation hebdomadaire de 2
  disques) et stocké hors site pour le risque incendie/vol.
- **Chiffrer le disque** (BitLocker) : les `.dump` contiennent des données de
  santé — données personnelles sensibles.
