# Scripts arquivados: deploy em Windows Server (NSSM + junctions)

Movidos pra cá em `2026-08-24`. Esses 4 scripts implementavam a "Rota A" de
deploy descrita no `Kickoff` original: backend rodando como serviço do
Windows (via NSSM) numa VPS Windows Server 2012 R2, com troca de release por
junction (`mklink /J`) e backup via Windows Task Scheduler.

Essa rota foi abandonada em favor da "Rota B" — VPS Linux comum com Docker,
gerenciada por EasyPanel (ver `docs/plano-deploy-easypanel-vercel.md` e o
processo real de deploy documentado no `CLAUDE.md`, raiz do repo). O backend
hoje builda e roda via `Dockerfile` (raiz do repo) + rebuild manual do
container no EasyPanel — não existe mais serviço NSSM, junction de release
nem `C:\app` em produção.

**Não é código morto por engano** — preservado aqui, fora de qualquer
pipeline (nada em `package.json` chama esses scripts), caso um dia faça
sentido voltar a rodar isso numa VPS Windows.

## O que tem aqui

- `install-service.ps1` — registra o backend como serviço do Windows via
  NSSM (reinício automático em crash).
- `switch-release.ps1` — aponta o junction `current` para uma release
  específica em `releases/<timestamp>_<commit>/` (permite rollback).
- `build-release.ps1` — gera o pacote autocontido de uma release (roda no
  Windows 11 de desenvolvimento, não na VPS).
- `backup.ps1` — zip do `storage/` (banco SQLite + sessão do WhatsApp +
  relatórios) com retenção dos últimos N backups.

## Como reativar, se precisar

1. Mover os 4 arquivos de volta para `scripts/`.
2. Provisionar uma VPS Windows Server, instalar Node.js e o `nssm.exe`
   (https://nssm.cc/download) no PATH.
3. Rodar `build-release.ps1` (no Windows 11 de dev) para gerar o primeiro
   pacote em `releases/`.
4. Copiar a pasta da release para `C:\app\releases\` na VPS, rodar
   `npm ci --omit=dev --omit=peer` dentro de `backend/` lá.
5. Rodar `install-service.ps1` uma vez, depois `switch-release.ps1
   -Release "<nome-da-release>"` e iniciar o serviço (`nssm start
   PainelRelatorios`).
6. Agendar `backup.ps1` no Windows Task Scheduler da VPS.

O `Dockerfile` da raiz e o processo EasyPanel continuariam existindo em
paralelo sem conflito — as duas rotas partem do mesmo código-fonte, só
mudam variáveis de ambiente/forma de build (mesma premissa registrada em
`docs/plano-deploy-easypanel-vercel.md`).

Contexto completo da decisão original (stack, riscos, cronograma) está em
`docs/_archive/kickoff-windows-server.md` e
`docs/_archive/planejamento-windows-server.md`.
