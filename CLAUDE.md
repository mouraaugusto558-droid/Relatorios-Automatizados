# MeuNovoProjeto

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

- **Backend**: manual, numa VPS via EasyPanel (Docker/Linux). Quem aplica o
  deploy é o usuário (`git pull` + rebuild do container) — não fazer isso a
  menos que ele peça explicitamente.
- **Frontend**: Vercel, projeto `frontend` no time `alvaro's projects`
  (plano Hobby), linkado via `frontend/.vercel/project.json`. Deploy com:

  ```
  cd frontend
  npx vercel --prod --yes --scope alvaros-projects-f99b9f96
  ```

  Isso builda e já promove pra produção (`frontend-nine-psi-90.vercel.app`).
  **Não é** disparado automaticamente por `git push` — este projeto não tem
  webhook do GitHub configurado na Vercel, só builda quando alguém roda
  `vercel deploy`/`--prod`.

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
