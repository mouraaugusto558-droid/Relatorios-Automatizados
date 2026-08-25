<#
Gera um pacote de release autocontido em releases/<timestamp>_<commit>/,
pronto para ser copiado inteiro para a VPS.

Rodar SEMPRE a partir do Windows 11 (maquina de desenvolvimento). Este
script nao acessa a VPS - so prepara o pacote local. A copia para a VPS
e' o passo seguinte, manual (seguindo o processo documentado no
planejamento, secao "Fases de execucao / Deploy").

O pacote gerado contem:
  backend/dist/            - codigo compilado (sem TypeScript)
  backend/package.json     - so dependencias de producao (Fase 7 separou
                              pino-pretty como devDependency)
  backend/package-lock.json- lockfile isolado (ver update-backend-lockfile.ps1)
  backend/.npmrc            - omit=peer, evita que o "sharp" (peer dependency
                              nativa do Baileys) seja instalado sem querer
  frontend/dist/            - build estatico do React, servido pelo backend
  .env.example              - referencia; o .env real fica fora do release,
                              na raiz do "app" da VPS, e nunca deve ser
                              commitado ou versionado
  RELEASE_INFO.txt          - commit e timestamp, para rastreio/rollback

NAO inclui node_modules - deve ser instalado na propria VPS dentro de
backend/, para nunca depender de binarios resolvidos no Windows 11
(secao 18/19 do kickoff), usando OBRIGATORIAMENTE:

    npm ci --omit=dev --omit=peer

Os dois --omit são necessarios: passar so --omit=dev na linha de comando
SOBRESCREVE (nao soma com) o "omit=peer" do .npmrc, e sem --omit=peer
explicito o "sharp" (peer dependency nativa do Baileys que decidimos
evitar - ver planejamento) acaba instalado mesmo com o .npmrc presente.
Confirmado na pratica gerando e instalando um release de teste.
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    Write-Host "1/5 - Rodando testes do backend..." -ForegroundColor Cyan
    npm run test --workspace backend
    if ($LASTEXITCODE -ne 0) { throw "Testes falharam - release abortado." }

    Write-Host "2/5 - Gerando build de producao (frontend + backend)..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build falhou - release abortado." }

    $backendLockfile = Join-Path $repoRoot "backend\package-lock.json"
    if (-not (Test-Path $backendLockfile)) {
        throw "backend/package-lock.json nao existe. Rode scripts\update-backend-lockfile.ps1 primeiro."
    }

    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $commitHash = (git rev-parse --short HEAD 2>$null)
    if (-not $commitHash) { $commitHash = "sem-git" }
    $releaseName = "${timestamp}_$commitHash"
    $releaseDir = Join-Path $repoRoot "releases\$releaseName"

    Write-Host "3/5 - Montando pacote em releases\$releaseName ..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path "$releaseDir\backend" -Force | Out-Null

    Copy-Item "$repoRoot\backend\dist" "$releaseDir\backend\dist" -Recurse
    Copy-Item "$repoRoot\backend\package.json" "$releaseDir\backend\package.json"
    Copy-Item $backendLockfile "$releaseDir\backend\package-lock.json"
    Copy-Item "$repoRoot\.npmrc" "$releaseDir\backend\.npmrc"
    Copy-Item "$repoRoot\frontend\dist" "$releaseDir\frontend\dist" -Recurse
    Copy-Item "$repoRoot\.env.example" "$releaseDir\.env.example"

    "commit: $commitHash`ngerado em: $timestamp`n" | Out-File "$releaseDir\RELEASE_INFO.txt" -Encoding utf8

    Write-Host "4/5 - Pacote pronto: releases\$releaseName" -ForegroundColor Green
    Write-Host "5/5 - Proximos passos (na VPS):" -ForegroundColor Yellow
    Write-Host "  1. Copiar a pasta releases\$releaseName inteira para C:\app\releases\ na VPS"
    Write-Host "  2. Na VPS: cd C:\app\releases\$releaseName\backend; npm ci --omit=dev --omit=peer"
    Write-Host "  3. Rodar scripts\switch-release.ps1 -Release `"$releaseName`" (aponta 'current' pra essa release)"
    Write-Host "  4. Reiniciar o servico do Windows (NSSM restart)"
    Write-Host "  5. Verificar GET /api/health"
}
finally {
    Pop-Location
}
