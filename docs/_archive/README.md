# Documentos arquivados

Planos e specs de ideias abandonadas, movidos pra cá em `2026-08-24` pra não
poluir `docs/` com material que não descreve mais o sistema atual. Nada
aqui é apagado — é histórico, caso algum dia faça sentido retomar.

- **`kickoff-windows-server.md`** (era `Kickoff — Sistema Node.js + React +
  Baileys — Desenvolvimento Local e Deploy em Windows Server 2012 R2.md`,
  raiz do repo) — especificação original completa do projeto, escrita para
  produção numa VPS Windows Server 2012 R2 (serviço via NSSM, deploy por
  junction). Essa rota de deploy foi abandonada — ver
  `docs/plano-deploy-easypanel-vercel.md` para a decisão e
  `scripts/_archive/windows-server-deploy/README.md` para como reativar os
  scripts correspondentes.
- **`planejamento-windows-server.md`** (era `planejamento`, raiz do repo) —
  plano vivo derivado do kickoff: decisões de stack, fases e riscos, todos
  justificados pelas restrições do Windows Server 2012 R2 (2 vCPU/2GB RAM,
  sem Docker). A seção 1.1 (API Otodata) ainda tem valor de referência, mas
  a fonte de verdade pra isso hoje é o código
  (`backend/src/services/otodata/client.ts`) e
  `docs/como-o-sistema-funciona.md`.
- **`plano-integracao-supabase-planilha.md`** — plano original de
  sincronizar os tanques com Supabase + Google Sheets a cada hora. Abandonado
  em `2026-08-24` em favor do relatório em HTML estilo planilha + imagem PNG
  (ver `docs/plano-relatorio-planilha-imagem.md`). O código correspondente
  (cliente Supabase, cliente Google Sheets, orquestrador de sync) está
  preservado em `backend/_archive/legacy-integrations/`, com instruções de
  como reativar.

## Deploy em Windows Server: como reverter

Se um dia a VPS Windows Server voltar a ser necessária:

1. Os 4 scripts de deploy (`install-service.ps1`, `switch-release.ps1`,
   `build-release.ps1`, `backup.ps1`) estão em
   `scripts/_archive/windows-server-deploy/` — mover de volta para
   `scripts/` (ver o README ao lado deles para o passo a passo completo).
2. `kickoff-windows-server.md` e `planejamento-windows-server.md` (nesta
   pasta) têm todo o contexto de decisão original (por que NSSM, por que
   junction, restrições de Node/React/canvas naquele SO).
3. Nada no código do backend/frontend depende de Windows especificamente
   hoje (roda em Docker/Linux via EasyPanel) — a rota Windows voltaria a
   funcionar só reintroduzindo o processo de deploy acima, sem mudança de
   código-fonte.

## Supabase / Google Sheets: como reverter

Ver `backend/_archive/legacy-integrations/README.md` — tem o passo a passo
completo (mover pastas de volta, reinstalar dependências, restaurar
variáveis de ambiente e a entrada do job).
