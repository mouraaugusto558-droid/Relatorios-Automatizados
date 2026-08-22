<#
Registra a aplicacao como servico do Windows usando NSSM (Non-Sucking
Service Manager), para o Node nao depender de uma sessao RDP aberta
(secao 24 do kickoff) e reiniciar sozinho se cair (secao 24).

Pre-requisito: baixar o nssm.exe (https://nssm.cc/download) e colocar em
algum lugar do PATH da VPS (ou informar o caminho completo em -NssmPath).

Rodar NA VPS, UMA VEZ (reinstalar so se mudar caminho/nome do servico).
Depois de uma atualizacao de release normal, NAO precisa rodar de novo -
so reiniciar o servico (nssm restart <ServiceName>), pois o Node sempre
le o codigo por baixo do junction "current".

Estrutura esperada:
  C:\app\current\backend\dist\server.js   (junction -> release ativa)
  C:\app\.env
  C:\app\storage\
  C:\app\logs\                             (criado por este script)

Uso:
  .\install-service.ps1
  .\install-service.ps1 -ServiceName "PainelRelatorios" -AppRoot "D:\app" -NodePath "C:\Program Files\nodejs\node.exe"
#>

param(
    [string]$ServiceName = "PainelRelatorios",
    [string]$AppRoot = "C:\app",
    [string]$NodePath = "node.exe",
    [string]$NssmPath = "nssm.exe"
)

$ErrorActionPreference = "Stop"

$entryScript = Join-Path $AppRoot "current\backend\dist\server.js"
$logsDir = Join-Path $AppRoot "logs"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

Write-Host "Instalando servico '$ServiceName'..." -ForegroundColor Cyan

& $NssmPath install $ServiceName $NodePath $entryScript
& $NssmPath set $ServiceName AppDirectory $AppRoot
& $NssmPath set $ServiceName AppEnvironmentExtra "NODE_ENV=production"

# Reinicio automatico em crash (secao 24: Node crash -> service manager -> Node restart)
& $NssmPath set $ServiceName AppExit Default Restart
& $NssmPath set $ServiceName AppRestartDelay 3000

# Logs simples com rotacao por tamanho, para nao crescer indefinidamente
# (secao 25 do kickoff) sem precisar de nenhuma dependencia extra no Node.
& $NssmPath set $ServiceName AppStdout (Join-Path $logsDir "output.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $logsDir "error.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateOnline 1
& $NssmPath set $ServiceName AppRotateBytes 10485760   # 10 MB por arquivo

& $NssmPath set $ServiceName Start SERVICE_AUTO_START

Write-Host "Servico '$ServiceName' instalado." -ForegroundColor Green
Write-Host "Para iniciar: nssm start $ServiceName"
Write-Host "Para parar:   nssm stop $ServiceName"
Write-Host "Para status:  nssm status $ServiceName"
