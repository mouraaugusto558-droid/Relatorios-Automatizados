<#
Faz backup dos dados persistentes (nunca do codigo/release) em um .zip com
timestamp. Nao apaga nada da sessao atual do WhatsApp nem do banco.

Rodar NA VPS. Pode ser agendado no Windows Task Scheduler (uso operacional
de backup, diferente do scheduler interno de jobs de negocio da aplicacao
- ver secao 12 do kickoff, que veda depender do Task Scheduler para logica
de jobs, nao para tarefas de infraestrutura como esta).

Uso:
  .\backup.ps1
  .\backup.ps1 -AppRoot "D:\app" -KeepLast 14
#>

param(
    [string]$AppRoot = "C:\app",
    [int]$KeepLast = 14
)

$ErrorActionPreference = "Stop"

$storagePath = Join-Path $AppRoot "storage"
$backupsPath = Join-Path $AppRoot "backups"
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupFile = Join-Path $backupsPath "backup-$timestamp.zip"

if (-not (Test-Path $storagePath)) {
    throw "storage nao encontrado em $storagePath"
}

New-Item -ItemType Directory -Path $backupsPath -Force | Out-Null

# Inclui database.sqlite + os arquivos -wal/-shm do modo WAL (se existirem),
# para nao arriscar um snapshot inconsistente do banco.
$itemsToBackup = @()
$itemsToBackup += Get-ChildItem -Path $storagePath -Filter "database.sqlite*" -File -ErrorAction SilentlyContinue
$whatsappAuth = Join-Path $storagePath "whatsapp\auth"
if (Test-Path $whatsappAuth) { $itemsToBackup += Get-Item $whatsappAuth }
$reportsPath = Join-Path $storagePath "reports"
if (Test-Path $reportsPath) { $itemsToBackup += Get-Item $reportsPath }

if ($itemsToBackup.Count -eq 0) {
    Write-Host "Nada para fazer backup ainda (storage vazio)." -ForegroundColor Yellow
    exit 0
}

Compress-Archive -Path $itemsToBackup.FullName -DestinationPath $backupFile
Write-Host "Backup criado: $backupFile" -ForegroundColor Green

# Limpeza: mantem so os $KeepLast backups mais recentes, para nao crescer
# indefinidamente no disco de 2GB da VPS (secao 26 do kickoff).
$allBackups = Get-ChildItem -Path $backupsPath -Filter "backup-*.zip" | Sort-Object LastWriteTime -Descending
if ($allBackups.Count -gt $KeepLast) {
    $toDelete = $allBackups | Select-Object -Skip $KeepLast
    foreach ($old in $toDelete) {
        Remove-Item $old.FullName -Force
        Write-Host "Backup antigo removido: $($old.Name)"
    }
}
