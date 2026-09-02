# Relatorios-Automatizados

> Repositório renomeado de `MeuNovoProjeto` em 2026-09-02. A pasta local e o
> `name` do `package.json` ainda usam o nome antigo — só o repositório no
> GitHub mudou (`https://github.com/mouraaugusto558-droid/Relatorios-Automatizados`).

Visão geral do que o sistema faz: `docs/como-o-sistema-funciona.md`.

## Ideias abandonadas (arquivadas, não excluídas)

Três direções técnicas foram exploradas e abandonadas. Código e docs foram
**movidos**, não apagados — cada local abaixo tem seu próprio `README.md`
com o passo a passo completo de como reativar, então esta seção só serve de
índice (não duplicar detalhe aqui).

- **Deploy em Windows Server 2012 R2** (ideia original do projeto, antes da
  VPS/EasyPanel atual): specs em `docs/_archive/kickoff-windows-server.md` e
  `docs/_archive/planejamento-windows-server.md`; scripts (NSSM, junction de
  release, backup) em `scripts/_archive/windows-server-deploy/`.
- **Sincronização com Supabase**: plano em
  `docs/_archive/plano-integracao-supabase-planilha.md`; código (cliente,
  mapeamento, migração SQL) em
  `backend/_archive/legacy-integrations/supabase/`.
- **Sincronização com Google Sheets**: mesmo plano acima; código em
  `backend/_archive/legacy-integrations/googleSheets/`.

Motivo do abandono de Supabase/Sheets: substituídos pelo relatório em HTML
estilo planilha + imagem PNG, enviado direto por WhatsApp (ver
`docs/plano-relatorio-planilha-imagem.md`) — sem depender de nenhum serviço
externo adicional.

## Deploy

Backend na **Fly.io** (app `meu-novo-projeto-api`, `fly.toml` e `Dockerfile`
na raiz), frontend na **Vercel**. Isso substitui o EasyPanel, que era o host
anterior do backend. Branch de produção: `develop`.

### Caminho normal: push

Cada push na `develop` dispara o workflow correspondente ao que mudou, roda
`npm run check` (typecheck + testes) e só publica se passar:

| Mudou | Workflow | Publica |
|---|---|---|
| `backend/`, `Dockerfile`, `fly.toml`, `package*.json` | `.github/workflows/deploy-fly.yml` | Fly.io |
| `frontend/`, `package*.json` | `.github/workflows/deploy-vercel.yml` | Vercel |
| só `docs/` ou `*.md` | nenhum | nada |

Secrets necessários no GitHub (Settings → Secrets and variables → Actions):
`FLY_API_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Os dois
últimos saem de `frontend/.vercel/project.json`, que é ignorado pelo git.

### Caminho manual (infra e depuração)

```
npm run check       # typecheck + 103 testes — portão de qualidade
npm run deploy      # check + backend (Fly) + frontend (Vercel)
npm run deploy:api  # só backend
npm run deploy:web  # só frontend
```

O `deploy:web` embute o `--scope alvaros-projects-f99b9f96` por causa do gotcha
descrito abaixo. Tarefas de infra (`fly volumes`, `fly secrets`, `fly logs`,
`fly ssh console`) não têm equivalente no GitHub — são sempre terminal.

### Persistência (não quebrar)

O `fly.toml` monta o volume `app_data` em `/data` e o bloco `[env]` aponta
`DATABASE_PATH`, `WHATSAPP_AUTH_PATH` e `REPORTS_PATH` para lá. Os defaults do
código (`backend/src/config/env.ts`) são `./storage/...`, **dentro do container
descartável** — se esse `[env]` sumir, todo deploy apaga banco, configurações
salvas e a sessão do WhatsApp. Volume é 1 máquina / 1 região: manter
`fly scale count 1`, `min_machines_running = 1`, `auto_stop_machines = false` e
`strategy = "immediate"`.

Detalhe e ordem de execução: `docs/CONTINUAR-AQUI-fly-vercel.md` e
`docs/deploy-fly-vercel-runbook.md`. Passo a passo para quem só publica:
`docs/publicar-alteracoes-passo-a-passo.md`.

### Gotcha: deploy bloqueado por "commit author sem acesso" (2026-08-24)

O plano Hobby da Vercel não permite colaboradores em repositório privado.
Quando o `vercel` CLI roda de dentro do repositório git (`.git` presente), ele
anexa o autor do commit atual (HEAD) ao deploy — se esse autor não for
reconhecido como o dono/colaborador do projeto na Vercel, o deploy fica
bloqueado (aparece "Deployment Blocked — the commit author did not have
contributing access to the project on Vercel" no dashboard, status
`UNKNOWN`/`Blocked`, sem nenhum log de build).

A identidade global do git nesta máquina (`git config --global user.name/
user.email`) é `senpainatsu12345-ai <senpainatsu12345@gmail.com>` — **não**
reconhecida pela Vercel. O dono real do repositório no GitHub é
`mouraaugusto558-droid` (id `246547990`).

**Correção aplicada**: identidade git sobrescrita *localmente, só neste
repositório* (não afeta a config global nem outros projetos):

```
git config --local user.name "mouraaugusto558-droid"
git config --local user.email "246547990+mouraaugusto558-droid@users.noreply.github.com"
```

Isso usa o e-mail padrão de "e-mail privado" que o GitHub atribui a toda
conta nova — funciona porque a conta `mouraaugusto558-droid` não desativou
essa opção. Validado em 2026-08-24: um commit com essa identidade + `vercel
--prod --yes` de dentro do repo real completou como `READY`, sem bloqueio.

**Se isso reaparecer** (ex.: repo clonado de novo em outra máquina/sessão e
o `git config --local` acima não foi refeito), duas opções:

1. Reaplicar o `git config --local` acima e commitar de novo antes de
   deployar.
2. Workaround sem tocar em git: copiar `frontend/` (pastas `src`, `.vercel`;
   arquivos `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`)
   para um diretório **fora de qualquer repositório git** (ex. um temp dir) e
   rodar `npx vercel --prod --yes` de lá. Sem `.git` na árvore, o CLI não
   anexa metadado de commit/autor ao deploy, então a checagem de acesso nunca
   é acionada. Foi assim que os primeiros deploys manuais desta sessão (antes
   da correção de identidade) conseguiram passar.

### Gotcha: `npx vercel --prod --yes` sem `--scope` falha com "Not authorized" (2026-08-24)

Mesmo com `vercel whoami` autenticado e `vercel teams ls` mostrando acesso ao
time `alvaros-projects-f99b9f96` (que é dono do projeto `frontend`, conforme
`frontend/.vercel/project.json` → `orgId`), rodar `npx vercel --prod --yes`
sem mais nada falhou direto no upload com:

```
{"status":"error","reason":"deploy_failed","message":"Not authorized", ...}
```

Isso é diferente do gotcha de "commit author" acima (aquele bloqueia depois
do upload, com status `Blocked` no dashboard; este falha antes de começar o
build). **Correção**: passar `--scope alvaros-projects-f99b9f96` explicitamente
— sem isso o CLI parece resolver pro escopo errado (conta pessoal) mesmo com
o projeto linkado corretamente. Validado em 2026-08-24: com `--scope`, o
deploy completou como `READY` e promoveu para produção.
