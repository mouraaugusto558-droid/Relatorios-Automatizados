<#
Aponta o junction "current" para uma release especifica, sem tocar em
storage/ nem apagar nenhuma outra release (permite rollback: basta rodar
de novo apontando para uma release anterior).

Rodar NA VPS, dentro da estrutura:
  C:\app\
  |- current\      (junction -> releases\<uma-delas>)
  |- releases\
  |  |- 2026-01-01_abc1234\
  |  |- 2026-01-02_def5678\
  |- storage\
  |- .env

Uso:
  .\switch-release.ps1 -Release "2026-01-02_def5678"
  .\switch-release.ps1 -Release "2026-01-02_def5678" -AppRoot "D:\app"

Depois de trocar, reinicie o servico do Windows (NSSM) para a mudanca
valer - o Node so le o codigo de "current" na inicializacao.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Release,

    [string]$AppRoot = "C:\app"
)

$ErrorActionPreference = "Stop"

$releasePath = Join-Path $AppRoot "releases\$Release"
$currentPath = Join-Path $AppRoot "current"

if (-not (Test-Path $releasePath)) {
    throw "Release '$Release' nao encontrada em $releasePath"
}

if (Test-Path $currentPath) {
    # "cmd /c rmdir" remove SO o junction (o ponteiro), nunca o conteudo da
    # release apontada. NAO usar Remove-Item -Recurse aqui: em alguns
    # cenarios o PowerShell segue o link e apaga o conteudo real da release.
    cmd /c rmdir "`"$currentPath`""
}

cmd /c mklink /J "`"$currentPath`"" "`"$releasePath`""

Write-Host "current -> $Release" -ForegroundColor Green
Write-Host "Reinicie o servico do Windows (NSSM restart <nome-do-servico>) para aplicar." -ForegroundColor Yellow
