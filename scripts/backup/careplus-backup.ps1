<#
.SYNOPSIS
    Sauvegarde quotidienne de la base careplus vers un disque externe.

.DESCRIPTION
    pg_dump format custom (compressé, restaurable via pg_restore), horodaté,
    vers le dossier de sauvegarde (typiquement un disque dur externe). Applique
    une rétention (supprime les sauvegardes > N jours) et journalise chaque
    exécution. Conçu pour le déploiement on-premise Windows + Planificateur de
    tâches (voir README.md).

    Connexion résolue par priorité : arguments CLI > variables d'environnement
    (PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD) > défauts locaux.

.PARAMETER BackupDir
    Dossier de destination (ex. E:\careplus-backups). Créé s'il n'existe pas.
.PARAMETER RetentionDays
    Jours de rétention. Les .dump plus vieux sont supprimés. Défaut 30.
.PARAMETER PgBin
    Dossier de pg_dump.exe si absent du PATH (ex. C:\Program Files\PostgreSQL\16\bin).

.EXAMPLE
    .\careplus-backup.ps1 -BackupDir E:\careplus-backups -RetentionDays 30

.NOTES
    Code de sortie 0 = succès, 1 = échec (exploitable par le Planificateur).
#>
[CmdletBinding()]
param(
    [string]$BackupDir = $env:CAREPLUS_BACKUP_DIR,
    [string]$DbHost    = $(if ($env:PGHOST) { $env:PGHOST } else { 'localhost' }),
    [int]   $Port      = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
    [string]$Database  = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { 'careplus' }),
    [string]$User      = $(if ($env:PGUSER) { $env:PGUSER } else { 'careplus' }),
    [string]$Password  = $(if ($env:PGPASSWORD) { $env:PGPASSWORD } else { 'careplus' }),
    [int]   $RetentionDays = 30,
    [string]$PgBin     = $env:CAREPLUS_PG_BIN
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    Write-Error "BackupDir non défini. Passez -BackupDir <chemin> ou définissez CAREPLUS_BACKUP_DIR."
    exit 1
}

$pgDump = if ($PgBin) { Join-Path $PgBin 'pg_dump.exe' } else { 'pg_dump' }

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}
$logFile = Join-Path $BackupDir 'careplus-backup.log'

function Write-Log($msg) {
    $line = "$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')) $msg"
    Add-Content -Path $logFile -Value $line -Encoding utf8
    Write-Host $line
}

$stamp   = [DateTime]::Now.ToString('yyyyMMdd_HHmmss')
$outFile = Join-Path $BackupDir "careplus_$stamp.dump"

Write-Log "DEBUT sauvegarde -> $outFile (db=$Database host=$DbHost`:$Port user=$User)"

$env:PGPASSWORD = $Password
try {
    & $pgDump -h $DbHost -p $Port -U $User -d $Database -Fc -f $outFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump a renvoye le code $LASTEXITCODE" }
    $sizeKb = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
    Write-Log "OK sauvegarde terminee ($sizeKb Ko)"
}
catch {
    Write-Log "ECHEC sauvegarde : $($_.Exception.Message)"
    if (Test-Path $outFile) { Remove-Item $outFile -Force -ErrorAction SilentlyContinue }
    exit 1
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# Rétention.
try {
    $cutoff = [DateTime]::Now.AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter 'careplus_*.dump' |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object {
            Remove-Item $_.FullName -Force
            Write-Log "Retention : supprime $($_.Name)"
        }
}
catch {
    Write-Log "AVERTISSEMENT retention : $($_.Exception.Message)"
}

Write-Log "FIN"
exit 0
