<#
Regenera backend/package-lock.json de forma isolada, fora da arvore do
workspace npm. Necessario porque rodar "npm install" dentro de backend/
diretamente e' interpretado pelo npm como parte do workspace raiz e nao
gera um lockfile proprio do backend.

Esse lockfile isolado e' o que garante que a VPS instale exatamente as
mesmas versoes resolvidas e testadas aqui (npm ci --omit=dev), em vez de
resolver versoes novas na hora do deploy (prioridade do projeto:
Compatibilidade > Estabilidade > ...).

Rodar sempre que backend/package.json mudar (nova dependencia, bump de
versao) e commitar o backend/package-lock.json resultante.
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPackageJson = Join-Path $repoRoot "backend\package.json"
$rootNpmrc = Join-Path $repoRoot ".npmrc"
$tempDir = Join-Path $env:TEMP ("backend-lockfile-" + [guid]::NewGuid())

New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    Copy-Item $backendPackageJson $tempDir
    # Crucial: sem o .npmrc (omit=peer) presente durante a RESOLUCAO, o npm
    # auto-instala o "sharp" (peer dependency nativa do Baileys) e o grava
    # no lockfile - depois disso "npm ci" na VPS o reproduz fielmente,
    # mesmo com um .npmrc correto ao lado, porque ci so obedece o que ja
    # esta fixado no lockfile.
    Copy-Item $rootNpmrc $tempDir
    Push-Location $tempDir
    npm install --package-lock-only
    if ($LASTEXITCODE -ne 0) { throw "npm install --package-lock-only falhou" }
    Pop-Location

    Copy-Item (Join-Path $tempDir "package-lock.json") (Join-Path $repoRoot "backend\package-lock.json") -Force
    Write-Host "backend/package-lock.json atualizado." -ForegroundColor Green
}
finally {
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}
