# Runbook — Deploy e persistência (backend Fly.io + frontend Vercel)

> Objetivo deste documento: registrar **todos os problemas conhecidos** desta
> topologia de deploy e a forma de resolver cada um, para que sessão do
> WhatsApp, banco SQLite e configurações salvas pelo cliente **não se percam**.
> Só depois de tudo abaixo estar aplicado é que faz sentido escrever o tutorial
> "como o cliente usa".
>
> Topologia atual: backend em container Docker na **Fly.io**
> (`app = meu-novo-projeto-backend`, ver `fly.toml`), frontend estático na
> **Vercel** (ver `CLAUDE.md` → seção Deploy). Front e back ficam em domínios
> diferentes (`*.vercel.app` × `*.fly.dev`) → é cross-origin.

---

## Estado em 2026-09-01 (o que está pendente)

| # | Problema | Gravidade | Status |
|---|---|---|---|
| 1 | Trial da Fly.io acabou, app `suspended` | 🔴 bloqueia tudo | pendente |
| 2 | `DATABASE_PATH`/`WHATSAPP_AUTH_PATH`/`REPORTS_PATH` apontam pra dentro do container (apagados a cada deploy) | 🔴 perda de dados | pendente |
| 3 | Volume `app_data` pode não existir ainda | 🔴 perda de dados | conferir |
| 4 | `HOST` precisa ser `0.0.0.0` (default do código é `127.0.0.1`) | 🔴 app inacessível | conferir |
| 5 | Estratégia de deploy com 1 volume + 1 máquina | 🟡 deploy pode falhar/travar | pendente |
| 6 | Secrets obrigatórios podem estar faltando | 🔴 login/relatório quebram | conferir |
| 7 | `CORS_ALLOWED_ORIGIN` + `VITE_API_BASE_URL` (Vercel ↔ Fly) | 🟡 frontend não fala com API | conferir |
| 8 | Cookie de sessão cross-site (Safari / bloqueio de 3rd-party cookies) | 🟡 login cai em alguns navegadores | mitigar depois |
| 9 | QR do WhatsApp precisa ser escaneado 1x após o volume entrar | 🟢 esperado | passo operacional |
| 10 | Backup do SQLite (snapshot da Fly não basta) | 🟡 sem plano de backup | pendente |
| 11 | GitHub Actions (`.github/workflows/deploy-fly.yml`) não commitado, aponta pra branch `main` (repo está em `develop`) | 🟢 automação opcional | pendente |
| 12 | `fly.toml`, `.github/`, `MeuNovoProjeto-codigo-fonte.zip` fora do git | 🟢 higiene | pendente |

---

## 1. Trial da Fly.io acabou / app suspenso 🔴

**Sintoma:** `fly status`, `fly secrets list`, `fly deploy` retornam
`Error: ... trial has ended, please add a credit card`. `fly apps list` mostra
`meu-novo-projeto-backend ... suspended`.

**Causa:** o trial da Fly em 2026 dura **2 horas de VM ou 7 dias, o que acabar
primeiro**. Depois disso as máquinas param e não dá pra deployar, criar volume
nem attachar volume.

**Resolver:**
1. Entrar em <https://fly.io/dashboard> → **Billing** → adicionar cartão
   (ou comprar crédito pré-pago em <https://fly.io/dashboard/personal/billing>).
   Adicionar cartão **encerra o trial** e a partir daí o uso é cobrado (uma
   máquina `shared-cpu-1x` 256–512 MB + volume de 1 GB fica em poucos
   dólares/mês; confira o preço atual porque o free tier de 2026 foi cortado).
2. Retomar o app:
   ```
   fly apps resume meu-novo-projeto-backend
   fly status
   ```
   Se `resume` não existir na sua versão do CLI, um `fly deploy` já
   religa a máquina.

**Fontes:** [Fly.io Free Trial](https://fly.io/docs/about/free-trial/) ·
[Fly.io Billing](https://fly.io/docs/about/billing/)

---

## 2 + 3. Persistência: volume e caminhos de dados 🔴

**Este é o problema mais importante.** Um container Docker é descartável: o
filesystem é recriado do zero **a cada `fly deploy` e a cada restart de
máquina**. Só o que estiver dentro de um **volume** montado sobrevive.

O `fly.toml` já monta um volume em `/data`:
```toml
[[mounts]]
  source = "app_data"
  destination = "/data"
```
Mas o código (`backend/src/config/env.ts`) grava, por padrão, em
`./storage/...` — **dentro do container, fora do volume**:

| Dado | Variável | Default (RUIM em prod) | Precisa ser |
|---|---|---|---|
| Banco SQLite (jobs, relatórios, `settings`, clientes excluídos, cooldowns de alerta) | `DATABASE_PATH` | `./storage/database.sqlite` | `/data/database.sqlite` |
| Sessão do WhatsApp (credenciais Baileys) | `WHATSAPP_AUTH_PATH` | `./storage/whatsapp/auth` | `/data/whatsapp/auth` |
| Arquivos `.txt` dos relatórios | `REPORTS_PATH` | `./storage/reports` | `/data/reports` |

Sem essa correção, **toda vez que você deployar**: o cliente perde o número do
WhatsApp configurado, os critérios de alerta, o filtro do relatório diário, a
lista de clientes excluídos, e o WhatsApp pede QR de novo.

**Resolver — passo 3a: garantir que o volume existe**
```
fly volumes list
```
Se não aparecer `app_data`, crie **na mesma região da máquina** (veja a região
em `fly status`):
```
fly volumes create app_data --size 1 --region <regiao-da-maquina>
```
(1 GB é folgado pra SQLite + sessão + `.txt`; dá pra estender depois.)

**Resolver — passo 3b: apontar o código pro volume**

Colocar os 3 caminhos no `fly.toml` (não são segredo, então vão em `[env]`, que
fica versionado no git). Adicione ao `fly.toml`:
```toml
[env]
  HOST = "0.0.0.0"
  NODE_ENV = "production"
  TZ = "America/Sao_Paulo"
  DATABASE_PATH = "/data/database.sqlite"
  WHATSAPP_AUTH_PATH = "/data/whatsapp/auth"
  REPORTS_PATH = "/data/reports"

[deploy]
  strategy = "immediate"
```
O código já cria as subpastas que faltarem (`fs.mkdirSync(..., { recursive: true })`
em `database/index.ts` e no whatsappManager), então não precisa criar
`/data/whatsapp` na mão.

**Regras do volume da Fly (não violar):**
- Um volume atende **uma única máquina** e **uma única região**. Não rode
  `fly scale count 2` — a 2ª máquina não consegue attachar o mesmo volume e,
  se conseguisse outro, seriam dois SQLite divergentes (split-brain).
  Mantenha `fly scale count 1`.
- `min_machines_running = 1` + `auto_stop_machines = false` (já está assim no
  `fly.toml`) — **manter**, senão o scheduler (croner) para e o disparo das
  08:00 é perdido.
- `strategy = "canary"` e `"bluegreen"` **não funcionam** com volume attachado;
  por isso `immediate` (ou o `rolling` padrão, que atualiza a máquina no lugar
  com uma pausa curta).

**Fontes:** [Fly Volumes overview](https://fly.io/docs/volumes/overview/) ·
[Volumes (JS)](https://fly.io/docs/js/the-basics/volumes/) ·
[Deploy an app](https://fly.io/docs/launch/deploy/)

---

## 4. App tem que escutar em `0.0.0.0` 🔴

`backend/src/config/env.ts`: `host: process.env.HOST ?? "127.0.0.1"`. Em
`127.0.0.1` o Fly-proxy não alcança o processo e o healthcheck `/api/health`
nunca passa (deploy fica em loop de "unhealthy"). Resolvido pelo
`HOST = "0.0.0.0"` no bloco `[env]` acima.

Se `HOST` também estiver setado como **secret** (`fly secrets list`), pode
remover pra não duplicar: `fly secrets unset HOST` (secret vence env; os dois
com o mesmo valor não causam problema, é só higiene).

---

## 5. Estratégia de deploy 🟡

Com 1 máquina + 1 volume, o `rolling` padrão não tem pra onde subir uma máquina
nova, então o Fly atualiza a máquina existente no lugar (downtime de alguns
segundos). `strategy = "immediate"` (no `[deploy]` acima) deixa isso explícito
e mais rápido. Para este app (uso interno, 1 destinatário de WhatsApp) alguns
segundos de downtime no deploy são aceitáveis.

---

## 6. Secrets obrigatórios 🔴

Conferir com `fly secrets list` (mostra os **nomes** e um digest, nunca o
valor). Precisam existir:

| Secret | Como gerar / de onde tirar |
|---|---|
| `OTODATA_API_KEY` | chave da API Otodata (já em uso) |
| `REPORT_RECIPIENT_NUMBER` | número DDI+DDD+numero, só dígitos (fallback; o cliente pode sobrescrever pelo painel) |
| `AUTH_USERNAME` | ex. `admin` |
| `AUTH_PASSWORD_HASH` | `npm run generate-password-hash --workspace backend -- "a-senha"` |
| `AUTH_SESSION_SECRET` | `openssl rand -hex 32` |
| `CORS_ALLOWED_ORIGIN` | URL exata do frontend na Vercel, ex. `https://frontend-nine-psi-90.vercel.app` (sem `/` no fim, nunca `*`) |

Setar (um ou vários de uma vez; cada `set` dispara um redeploy):
```
fly secrets set AUTH_SESSION_SECRET=xxxxx CORS_ALLOWED_ORIGIN=https://frontend-nine-psi-90.vercel.app
```

Sem `AUTH_*` → nenhuma rota de login funciona (erro lançado na 1ª tentativa).
Sem `REPORT_RECIPIENT_NUMBER` **e** sem destinatário salvo no painel → job do
relatório falha antes de buscar dados.

---

## 7. CORS + base URL do frontend 🟡

Front e back em domínios diferentes. Duas pontas para configurar:

**Backend (Fly):** `CORS_ALLOWED_ORIGIN` = domínio da Vercel (ver item 6). O
código (`backend/src/server.ts`) só registra o `@fastify/cors` — com
`credentials: true` e métodos PUT/PATCH/DELETE — **quando essa variável existe**.
Sem ela, todo `PUT /api/settings/*` cross-origin falha no preflight.

**Frontend (Vercel):** `VITE_API_BASE_URL` = URL pública do backend na Fly, ex.
`https://meu-novo-projeto-backend.fly.dev`. É variável **de build** do Vite
(`frontend/src/api/client.ts`, `frontend/src/hooks/useWhatsAppStatus.ts`) — com
ela vazia o frontend chama caminho relativo `/api/...` e quebra na Vercel.
Setar no dashboard da Vercel (Project → Settings → Environment Variables) **e
refazer o deploy** (variável de build só entra em vigor no próximo `vercel
--prod`; ver comando e gotchas no `CLAUDE.md`).

**Testar ponta a ponta:** abrir o frontend da Vercel, logar, confirmar que os
cards do Dashboard carregam (prova CORS + cookie ok) e que um `PUT` (ex. salvar
número do WhatsApp) responde 200.

---

## 8. Cookie de sessão cross-site 🟡 (mitigar depois)

`backend/src/routes/auth.ts`: em produção o cookie sai
`SameSite=None; Secure; HttpOnly`. Isso **funciona** entre `*.vercel.app` e
`*.fly.dev` (ambos HTTPS), mas é um cookie de terceiros — Safari (ITP), Firefox
estrito e extensões de privacidade **podem bloquear**, derrubando o login só
nesses navegadores.

Mitigação real (quando incomodar): usar um **domínio próprio** com o mesmo
apex para os dois — ex. `app.suaempresa.com` (Vercel) e `api.suaempresa.com`
(Fly), e trocar o cookie para `SameSite=Lax; Domain=.suaempresa.com`. Fica pra
uma etapa futura; não bloqueia o go-live.

---

## 9. QR do WhatsApp 🟢 (passo operacional)

Depois que o volume estiver montado e o primeiro deploy "bom" subir, a pasta
`/data/whatsapp/auth` está vazia → o backend gera um QR. Alguém precisa:
1. abrir o painel → aba **WhatsApp**;
2. escanear o QR (WhatsApp do celular → Aparelhos conectados);
3. pronto — a credencial fica no volume e **sobrevive aos próximos deploys**.

Rescan só é necessário de novo se o celular deslogar o aparelho manualmente
(as credenciais são apagadas nesse caso).

---

## 10. Backup do SQLite 🟡

A Fly tira **snapshot diário do volume, retido ~5 dias** — é rede de segurança,
não backup (pode não ter o dado mais recente; some junto se a conta fechar).

Plano mínimo recomendado (rodar de vez em quando ou semanalmente):
```
# baixa os 3 arquivos do WAL num diretório local de backup
fly ssh sftp get /data/database.sqlite      ./backups/database-$(date +%F).sqlite
fly ssh sftp get /data/database.sqlite-wal  ./backups/ 2>/dev/null || true
fly ssh sftp get /data/database.sqlite-shm  ./backups/ 2>/dev/null || true
```
Snapshot manual do volume antes de mudanças grandes:
```
fly volumes list                       # pega o ID (vol_xxx)
fly volume snapshots create <vol_id>
```

**Fonte:** [Fly Volumes overview](https://fly.io/docs/volumes/overview/) (seção Snapshots)

---

## 11. Deploy automático via GitHub Actions 🟢 (opcional)

Já existe `.github/workflows/deploy-fly.yml` (ainda **não commitado**). Ele roda
`flyctl deploy --remote-only` a cada push e precisa de:

1. Token de deploy:
   ```
   fly tokens create deploy -x 8760h
   ```
2. No GitHub: repo → **Settings → Secrets and variables → Actions → New
   repository secret** → nome `FLY_API_TOKEN`, valor = o token.
3. Decidir a branch: o workflow dispara em `main`, mas o repo está em `develop`.
   Ou trocar `branches: [main]` → `[develop]`, ou passar a fazer merge em
   `main` para publicar.
4. Commitar `.github/` e `fly.toml`.

Enquanto isso não estiver pronto, o deploy é manual: `fly deploy` na raiz do
repositório (onde estão `fly.toml` e `Dockerfile`).

---

## 12. Higiene do repositório 🟢

Ainda fora do git (`git status`):
- `fly.toml` → **commitar** (com o bloco `[env]`/`[deploy]` dos itens 2 e 5).
- `.github/` → commitar (item 11).
- `frontend/.gitignore` → commitar.
- `MeuNovoProjeto-codigo-fonte.zip` → **não** commitar; adicionar ao
  `.gitignore` (é um dump, não faz parte do código).

---

## Ordem de execução (checklist)

- [ ] 1. Adicionar cartão na Fly, `fly apps resume`, `fly status` ok
- [ ] 2. `fly volumes list` → criar `app_data` se faltar (item 3a)
- [ ] 3. Editar `fly.toml`: blocos `[env]` (HOST, NODE_ENV, TZ, os 3 `*_PATH`) e `[deploy]` (item 2/4/5)
- [ ] 4. `fly secrets list` → setar os que faltarem (item 6)
- [ ] 5. `fly secrets set CORS_ALLOWED_ORIGIN=https://<vercel>` (item 7)
- [ ] 6. `fly deploy` na raiz do repo → acompanhar `fly logs` / `fly status`
- [ ] 7. Vercel: setar `VITE_API_BASE_URL=https://<fly>.fly.dev` + `vercel --prod` (item 7)
- [ ] 8. Abrir painel, logar, **escanear o QR do WhatsApp** (item 9)
- [ ] 9. Testar: salvar número do WhatsApp no painel → deployar de novo → confirmar que o número **continua salvo** (prova que a persistência está ok)
- [ ] 10. Commitar `fly.toml`, `.github/`, `frontend/.gitignore`; `.gitignore` do zip (item 12)
- [ ] 11. (opcional) `FLY_API_TOKEN` no GitHub + ajustar branch do workflow (item 11)
- [ ] 12. Configurar backup do SQLite (item 10)
- [ ] **Só agora**: escrever `docs/como-o-cliente-usa.md` (tutorial de uso do painel)

---

## Fontes

- [Fly.io Free Trial](https://fly.io/docs/about/free-trial/)
- [Fly.io Billing](https://fly.io/docs/about/billing/)
- [Fly Volumes overview](https://fly.io/docs/volumes/overview/)
- [Volumes · Fly Docs (JS)](https://fly.io/docs/js/the-basics/volumes/)
- [Deploy an app · Fly Docs](https://fly.io/docs/launch/deploy/)
- [Machine Suspend and Resume · Fly Docs](https://fly.io/docs/reference/suspend-resume/)
- [SQLite3 · Fly Docs](https://fly.io/docs/rails/advanced-guides/sqlite3/)
