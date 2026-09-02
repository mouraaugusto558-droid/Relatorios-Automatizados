# CONTINUAR AQUI — colocar backend Fly.io + frontend Vercel em produção

> **Para o Claude de uma próxima sessão.** Este arquivo é o ponto de retomada.
> O usuário vai adicionar o cartão na Fly.io e então pedir para "trabalhar
> nisso". Quando isso acontecer, siga este arquivo.
>
> Detalhe técnico de cada item (o *porquê*, as fontes da doc da Fly, as regras
> de volume): `docs/deploy-fly-vercel-runbook.md`. Este arquivo aqui é o
> **passo a passo de execução** + contexto do que já foi decidido.

---

## Contexto / histórico

- Data do levantamento: **2026-09-01**.
- O usuário conectou, via terminal (`fly` CLI e `vercel` CLI), o **backend na
  Fly.io** (`app = meu-novo-projeto-backend`) e o **frontend na Vercel**.
  Isso **substitui** o plano antigo de EasyPanel para o backend
  (`docs/plano-deploy-easypanel-vercel.md` continua válido só como referência
  de CORS/auth/persistência conceitual).
- Objetivo final do usuário: um **tutorial extremamente básico** de como o
  cliente edita e salva as configurações. Mas **primeiro** tudo abaixo tem que
  estar pronto e testado — foi decisão explícita dele
  ("só podemos montar tutoriais de como usar depois de deixar tudo pronto").
- Quando começar, o `git status` provavelmente ainda terá muitos arquivos `M`
  e `??` de outra frente de trabalho — **não commitar tudo junto**; commitar
  só o que este trabalho toca (`fly.toml`, `.github/`, `frontend/.gitignore`,
  `.gitignore`).

## Bloqueio que estava aberto

`fly` CLI retornava `Error: ... trial has ended, please add a credit card`.
`fly apps list` → `meu-novo-projeto-backend ... suspended`.
**Só o usuário resolve** (adicionar cartão em <https://fly.io/dashboard> →
Billing). Quando ele disser que fez isso, começar pelo passo 1 abaixo.

## Decisões já tomadas (não relitigar)

- **Persistência**: os 3 caminhos de dados vão no `fly.toml` `[env]` apontando
  pra `/data/...` (o volume `app_data`). Não são segredo, então `[env]`
  versionado, não `fly secrets`.
- **1 máquina só.** Volume da Fly é 1-máquina / 1-região. Nada de
  `fly scale count 2`, nada de multi-região, nada de LiteFS por enquanto —
  o app é uso interno com 1 destinatário de WhatsApp.
- **Estratégia de deploy**: `immediate` (downtime de segundos é aceitável;
  `canary`/`bluegreen` são incompatíveis com volume).
- **Timezone dos jobs**: já resolvido no código (`croner` com
  `timezone: "America/Sao_Paulo"` em `backend/src/jobs/scheduler.ts`). `TZ` no
  container é só cosmético pra logs.
- **GitHub Actions**: opcional, fica por último. Não bloqueia o go-live.

---

## PASSO A PASSO (executar em ordem)

### 1. Confirmar que a Fly voltou

```
fly auth whoami
fly status --app meu-novo-projeto-backend
fly apps resume meu-novo-projeto-backend   # se ainda estiver suspended
```
`fly status` tem que responder sem erro de billing e mostrar a **região** da
máquina (anotar — vai precisar no passo 3).

### 2. Ver o que já existe (não assumir)

```
fly volumes list --app meu-novo-projeto-backend
fly secrets list --app meu-novo-projeto-backend
fly config show --app meu-novo-projeto-backend   # ou: fly config env
```
Anotar: o volume `app_data` existe? Quais secrets já estão setados? `HOST` /
`NODE_ENV` já aparecem em algum lugar?

### 3. Criar o volume se faltar

Só se o passo 2 mostrou que `app_data` **não** existe:
```
fly volumes create app_data --size 1 --region <REGIAO-DO-PASSO-1> --app meu-novo-projeto-backend
```

### 4. Editar `fly.toml` (raiz do repo)

Adicionar estes dois blocos (o resto do arquivo fica como está):
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
Conferir que `[[mounts]] source = "app_data" / destination = "/data"` continua
lá (já estava em 2026-09-01).

### 5. Setar os secrets que faltarem

Do passo 2, comparar com esta lista e setar só os ausentes:
```
fly secrets set \
  OTODATA_API_KEY=... \
  REPORT_RECIPIENT_NUMBER=... \
  AUTH_USERNAME=admin \
  AUTH_PASSWORD_HASH='...' \
  AUTH_SESSION_SECRET='...' \
  CORS_ALLOWED_ORIGIN=https://<DOMINIO-DA-VERCEL> \
  --app meu-novo-projeto-backend
```
- `AUTH_PASSWORD_HASH`: gerar com
  `npm run generate-password-hash --workspace backend -- "a-senha"` — pedir a
  senha ao usuário, não inventar.
- `AUTH_SESSION_SECRET`: `openssl rand -hex 32`.
- `CORS_ALLOWED_ORIGIN`: domínio exato do frontend na Vercel, sem `/` no fim
  (o `CLAUDE.md` cita `frontend-nine-psi-90.vercel.app` — **confirmar** com
  `vercel ls` ou com o usuário antes de gravar).
- Se `HOST` estiver setado como secret com valor `0.0.0.0`, pode deixar; se
  quiser limpar: `fly secrets unset HOST` (o `[env]` do passo 4 cobre).

### 6. Deploy do backend

Na **raiz do repo** (onde estão `fly.toml` e `Dockerfile`):
```
fly deploy --app meu-novo-projeto-backend
fly logs --app meu-novo-projeto-backend
fly status --app meu-novo-projeto-backend
```
Sucesso = healthcheck `/api/health` passando e máquina `started`.
Se ficar "unhealthy": quase sempre é `HOST` != `0.0.0.0` ou o processo
crashando por secret faltando — ver `fly logs`.

Testar a API direto:
```
curl -i https://meu-novo-projeto-backend.fly.dev/api/health
```

### 7. Frontend na Vercel

1. Setar a env de **build** no projeto `frontend` da Vercel:
   `VITE_API_BASE_URL = https://meu-novo-projeto-backend.fly.dev`
   (dashboard da Vercel → Project → Settings → Environment Variables, ou
   `vercel env add VITE_API_BASE_URL production`).
2. Redeployar (variável de build só entra no próximo deploy). Comando e
   gotchas (identidade de commit, `--scope`) no `CLAUDE.md` seção Deploy:
   ```
   cd frontend
   npx vercel --prod --yes --scope alvaros-projects-f99b9f96
   ```

### 8. Escanear o QR do WhatsApp (uma vez)

Abrir o frontend da Vercel → login → aba **WhatsApp** → escanear o QR pelo
celular. A credencial vai pra `/data/whatsapp/auth` (volume) e sobrevive aos
próximos deploys.

### 9. TESTE DE PERSISTÊNCIA (o teste que valida tudo)

1. No painel, salvar o número do WhatsApp do relatório (aba de configuração).
2. `fly deploy --app meu-novo-projeto-backend` de novo (sem mudar nada).
3. Recarregar o painel → o número **tem que continuar salvo**, e o WhatsApp
   **não pode** pedir QR de novo.
4. Se sumiu → o `[env]` do passo 4 não pegou / volume não montado. Revisar
   com `fly ssh console -C "ls -la /data"`.

### 10. Higiene do git (commitar só o desta frente)

```
git add fly.toml .github frontend/.gitignore
# criar/editar .gitignore da raiz adicionando a linha:  MeuNovoProjeto-codigo-fonte.zip
git add .gitignore
git commit -m "chore: config de deploy Fly.io (volume, env, estrategia) + gitignore"
```

### 11. (Opcional, por último) Deploy automático via GitHub Actions

```
fly tokens create deploy -x 8760h --app meu-novo-projeto-backend
```
GitHub → repo → Settings → Secrets and variables → Actions → `FLY_API_TOKEN`.
Ajustar `.github/workflows/deploy-fly.yml`: `branches: [main]` → `[develop]`
(o repo trabalha em `develop`). Testar com um push ou "Run workflow".

### 12. SÓ AGORA: escrever o tutorial do cliente

Criar `docs/como-o-cliente-usa.md` — passo a passo do **painel web**
(login → abas Planilha / Jobs / Excluir Clientes / configuração de número e
critérios de alerta). Lembrar: quase nada disso é terminal/GitHub; o cliente
faz tudo pelo navegador. As poucas coisas que exigem `fly secrets` (trocar a
senha do painel, a chave da Otodata) ficam num apêndice "manutenção
(desenvolvedor)".

---

## Se algo der errado — pistas rápidas

| Sintoma | Causa provável |
|---|---|
| deploy "unhealthy" em loop | `HOST` != `0.0.0.0`, ou crash por secret faltando (`fly logs`) |
| painel abre mas Dashboard não carrega dados | `CORS_ALLOWED_ORIGIN` errado/ausente, ou `VITE_API_BASE_URL` não buildado |
| login funciona e "cai" logo depois | cookie cross-site bloqueado (Safari/Firefox estrito) — ver item 8 do runbook |
| config some depois do deploy | `DATABASE_PATH`/`WHATSAPP_AUTH_PATH` não estão em `/data` (passo 4) ou volume não existe |
| job das 08:00 não dispara | máquina parada — conferir `auto_stop_machines = false` e `min_machines_running = 1` no `fly.toml` |
| `vercel --prod` bloqueado / "Not authorized" | gotchas de identidade de commit e `--scope` no `CLAUDE.md` |
