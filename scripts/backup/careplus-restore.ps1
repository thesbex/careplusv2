<#
.SYNOPSIS
    Restaure la base careplus depuis une sauvegarde .dump (pg_restore).

.DESCRIPTION
    DESTRUCTIF : remplace le contenu de la base cible par celui de la
    sauvegarde. À n'exécuter que par l'exploitant, application ARRÊTÉE
    (aucune connexion active autre que pg_restore).

.PARAMETER DumpFile
    Chemin du .dump à restaurer (obligatoire).
.PARAMETER Force
    Saute la confirmation interactive (restauration scriptée encadrée).

.EXAMPLE
    .\careplus-restore.ps1 -DumpFile E:\careplus-backups\careplus_20260530_020000.dump

.NOTES
    Arrêter l'application careplus AVANT la restauration.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DumpFile,
    [string]$DbHost   = $(if ($env:PGHOST) { $env:PGHOST } else { 'localhost' }),
    [int]   $Port     = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
    [string]$Database = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { 'careplus' }),
    [string]$User     = $(if ($env:PGUSER) { $env:PGUSER } else { 'careplus' }),
    [string]$Password = $(if ($env:PGPASSWORD) { $env:PGPASSWORD } else { 'careplus' }),
    [string]$PgBin    = $env:CAREPLUS_PG_BIN,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $DumpFile)) {
    Write-Error "Fichier de sauvegarde introuvable : $DumpFile"
    exit 1
}

$pgRestore = if ($PgBin) { Join-Path $PgBin 'pg_restore.exe' } else { 'pg_restore' }

Write-Host "ATTENTION : restauration DESTRUCTIVE de la base '$Database' ($DbHost`:$Port)." -ForegroundColor Yellow
Write-Host "Source : $DumpFile" -ForegroundColor Yellow
Write-Host "Le contenu actuel sera REMPLACE. L'application doit etre arretee." -ForegroundColor Yellow

if (-not $Force) {
    $answer = Read-Host "Taper exactement RESTAURER pour confirmer"
    if ($answer -ne 'RESTAURER') { Write-Host "Annule."; exit 1 }
}

$env:PGPASSWORD = $Password
try {
    & $pgRestore -h $DbHost -p $Port -U $User -d $Database --clean --if-exists --no-owner $DumpFile
    if ($LASTEXITCODE -ne 0) { throw "pg_restore a renvoye le code $LASTEXITCODE" }
    Write-Host "Restauration terminee." -ForegroundColor Green
}
catch {
    Write-Error "Echec de la restauration : $($_.Exception.Message)"
    exit 1
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

exit 0
