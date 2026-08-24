# Plano de execução — Planilha/imagem + VPS (EasyPanel) + Vercel + Login

Documento de planejamento (sem código). Consolida e **substitui**, nos pontos em
que conflitam, três decisões tomadas em `2026-08-24`:

1. **Abandonar Supabase e Google Sheets** — não sincronizar mais dados para
   nenhum serviço externo. `docs/plano-integracao-supabase-planilha.md` fica
   **obsoleto** a partir deste documento (mantido no repo só como histórico).
2. **Relatório vira HTML estilo planilha + imagem PNG**, como já detalhado em
   `docs/plano-relatorio-planilha-imagem.md` (esse documento continua valendo
   nos detalhes técnicos — canvas, colunas, limites de linha; aqui só resolvo
   as "decisões em aberto" da seção 10 dele).
3. **Abandonar a Rota A (Windows Server 2012 R2) por enquanto.** A Rota B de
   `docs/plano-deploy-easypanel-vercel.md` deixa de ser "alternativa" e passa a
   ser **a única rota de produção perseguida agora**: backend em VPS comum via
   EasyPanel (Docker/Linux), frontend na Vercel.
4. **Novidade não coberta em nenhum doc anterior**: a API pública precisa de
   **login com usuário/senha guardados no `.env`** — hoje não existe nenhuma
   autenticação (confirmado em `backend/src/routes/{health,whatsapp,jobs,reports}.ts`).

O objetivo deste documento é ter **uma única lista de execução** cobrindo os
quatro pontos acima, na ordem certa (porque eles se atravessam: autenticação e
CORS precisam existir *antes* de expor a API na internet).

---

## 1. Remoção de Supabase e Google Sheets

### 1.1 O que sai

| Arquivo/dependência | Ação |
|---|---|
| `backend/src/services/dataSync/index.ts` | remover (orquestra os dois syncs) |
| `backend/src/services/supabase/` | remover pasta inteira |
| `backend/src/services/googleSheets/` | remover pasta inteira |
| Job `sincronizacao-dados` em `backend/src/jobs/definitions.ts:14-19` | remover a entrada |
| Dependência `@supabase/supabase-js` (`backend/package.json`) | `npm uninstall` |
| Dependência `googleapis` (`backend/package.json`) | `npm uninstall` |
| Env vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | remover de `backend/src/config/env.ts` e de `.env.example` |
| Linhas na tabela de jobs do `docs/como-o-sistema-funciona.md` (seção 4 e 5) | atualizar depois, junto do resto da doc, quando o código mudar de verdade |

### 1.2 O que fica (nada muda de comportamento)

- `jimp` (`backend/package.json`) — não tem relação com Supabase/Sheets; decisão
  sobre mantê-lo ou não é independente (ver seção 2.4).
- Toda a lógica de `dailyReport.ts`, `otodata/client.ts`, `whatsappManager.ts`.

### 1.3 Cuidado ao remover

Rodar `npm run typecheck` e `npm run test --workspace backend` depois de tirar
os imports — como `dataSync/index.ts` é o único lugar que importa
`syncDevicesToSupabase`/`syncDevicesToGoogleSheets`, remover a pasta inteira
não deve deixar import quebrado em outro lugar, mas vale conferir com
`grep -rn "supabase\|googleSheets\|dataSync" backend/src` antes de considerar
concluído.

---

## 2. Relatório: HTML estilo planilha + imagem PNG

Detalhamento técnico completo já está em
`docs/plano-relatorio-planilha-imagem.md` (arquitetura, por que
`@napi-rs/canvas` em vez de Puppeteer, colunas, onde entra no código). Aqui só
**resolvo as 6 decisões em aberto** da seção 10 daquele documento, para não
começar a codar sem saber o alvo:

| # | Decisão em aberto | Resolução |
|---|---|---|
| 1 | Imagem no lugar do texto, ou os dois? | **Os dois.** Mantém o texto atual no WhatsApp (pesquisável/copiável) e adiciona a imagem da planilha logo em seguida, na mesma execução de `runDailyReport`. Baixo custo extra, zero perda de funcionalidade existente. |
| 2 | Uma imagem (alarmes) ou duas (alarmes + abastecimentos)? | **Duas imagens separadas**, cada uma com seu próprio `caption` — mantém cada imagem legível/pequena e é mais fácil paginar cada seção de forma independente se crescer (decisão #4). |
| 3 | Supabase fica de pé "para quem quiser consultar via SQL/BI"? | **Não.** Ver seção 1 — remoção total, sem exceção. Já não há caso de uso citado por você para manter. |
| 4 | Limite de linhas por imagem antes de paginar | **50 linhas por imagem**, paginando em `1/2`, `2/2`... se passar disso. Ajustável depois de ver o resultado real (consistente com a sugestão original do plano). |
| 5 | Remover `jimp`? | **Remover.** Não é usado em nenhum arquivo de `src` hoje e não faz parte do novo pipeline de imagem (`@napi-rs/canvas` não depende dele). Se um dia precisar de pós-processamento (logo, marca d'água), `@napi-rs/canvas` já desenha isso nativamente via `drawImage`/`fillText`, sem precisar do `jimp`. |
| 6 | Fonte customizada no canvas ou fonte padrão do sistema? | **Fonte padrão do sistema** por enquanto (`sans-serif` genérico) — zero arquivo novo pra versionar/empacotar no deploy. Registrar uma TTF customizada fica como melhoria futura opcional, não bloqueia a v1. |

### 2.1 Ordem de implementação (retomando a seção 11 do plano original, sem mudanças)

1. Extrair filtros/ordenação de alarme e abastecimento de `dailyReport.ts` para
   um módulo compartilhado.
2. Criar `backend/src/services/reports/spreadsheetView.ts` (linhas/colunas) +
   testes unitários.
3. Adicionar `@napi-rs/canvas` (produção) e criar
   `backend/src/services/reports/renderSpreadsheetImage.ts` + testes de
   formato do buffer PNG.
4. Ligar ao `runDailyReport` (`backend/src/services/reports/index.ts`): depois
   de `sendMessage(jid, reportText)` (linha 32), gerar as duas imagens
   (alarmes, abastecimentos) e chamar
   `getWhatsAppManager().sendImage(jid, buffer, caption)` — método já
   implementado em `whatsappManager.ts:176`, hoje sem chamador.
5. Frontend: nova aba "Planilha" com `<table>` HTML real, cores de status
   extraídas para `frontend/src/utils/statusColors.ts` (espelhando
   `STATUS_META` do backend, para HTML e imagem não divergirem visualmente).
6. (Opcional, depois do resto funcionando) Endpoint de exportação CSV da
   listagem completa dos ~1012 tanques.

---

## 3. Abandonar Windows Server — EasyPanel (backend) + Vercel (frontend) como rota única

`docs/plano-deploy-easypanel-vercel.md` já mapeou o que muda tecnicamente
(seções 2 e 3 daquele doc). A mudança de decisão aqui é só de **prioridade**:
deixa de ser "Rota B alternativa" e vira **a rota real de produção**. Isso
muda uma resposta do próprio documento: a decisão em aberto #4 daquele plano
("Rota A continua sendo testada/mantida?") fica resolvida como **não** — os
scripts `scripts/*.ps1` (NSSM, backup, release em `releases/`) e o
`Kickoff — Sistema Node.js + React + Baileys...md` passam a ser **histórico**,
não mantidos ativamente enquanto essa nova rota for a única em uso.

Isso também **libera** uma restrição do plano de planilha/imagem: a seção 5
de `plano-deploy-easypanel-vercel.md` já observa que, num Linux comum, headless
Chrome deixaria de ser tecnicamente inviável — mas **mantemos a decisão por
`@napi-rs/canvas`** mesmo assim (seção 2 aqui), porque continua sendo a opção
mais leve nas duas plataformas e evita reintroduzir a complexidade de
gerenciar um processo Chromium.

### 3.1 O que muda de verdade (resumo do plano já existente, sem repetir os detalhes)

- Volume persistente no EasyPanel apontando pra `storage/` (banco, sessão do
  WhatsApp, relatórios) — configurar **antes** do primeiro deploy.
- `@fastify/cors` condicional, `HOST=0.0.0.0` no EasyPanel.
- `VITE_API_BASE_URL` no frontend (`frontend/src/api/client.ts:18` e
  `frontend/src/hooks/useWhatsAppStatus.ts:14`), vazio em dev, apontando pro
  domínio do EasyPanel no build da Vercel.
- `@fastify/static` (`backend/src/server.ts:33-48`) deixa de servir o frontend
  em produção (a Vercel assume esse papel), mas o código não precisa ser
  removido — já lida bem com a ausência do build.

### 3.2 O que muda em relação ao plano original: autenticação deixa de ser "token simples opcional"

A seção 3.3 de `plano-deploy-easypanel-vercel.md` propunha um
`API_AUTH_TOKEN` simples via header como proteção mínima. Isso é **substituído**
pelo sistema de login/senha da seção 4 abaixo, que é o que você pediu agora —
mais adequado porque dá um fluxo de login de verdade no frontend (tela de
login, não só um token estático embutido em algum lugar).

---

## 4. Autenticação: login e senha via `.env`

Não existe nenhuma autenticação hoje — confirmado lendo as 4 rotas do backend
(`health.ts`, `whatsapp.ts`, `jobs.ts`, `reports.ts`): nenhuma delas checa
identidade. Isso é seguro **só** enquanto a API só existe em `127.0.0.1`
(Rota A). Como a seção 3 abandona essa premissa, autenticação deixa de ser
opcional.

### 4.1 Desenho da solução

Sistema propositalmente simples (um único usuário administrador, credenciais
no `.env` — sem tabela de usuários, sem cadastro, sem "esqueci minha senha"):

- **Novas variáveis em `.env`** (`backend/src/config/env.ts` +
  `.env.example`):
  - `AUTH_USERNAME` — usuário do painel.
  - `AUTH_PASSWORD_HASH` — hash bcrypt da senha (**nunca** a senha em texto
    puro no `.env** — gerar o hash uma vez com um script simples e colar o
    resultado).
  - `AUTH_SESSION_SECRET` — chave usada para assinar o cookie de sessão
    (string aleatória longa, gerada uma vez, ex. `openssl rand -hex 32`).
- **Rota nova** `backend/src/routes/auth.ts`:
  - `POST /api/auth/login` — recebe `{ username, password }`, compara
    `username` com `AUTH_USERNAME` e `password` com `AUTH_PASSWORD_HASH`
    (`bcrypt.compare`), e se bater, seta um **cookie httpOnly assinado**
    (`@fastify/cookie` + `@fastify/secure-session` ou JWT guardado em cookie
    httpOnly — qualquer uma resolve; JWT é mais simples de não precisar de
    lib extra de sessão).
  - `POST /api/auth/logout` — limpa o cookie.
  - `GET /api/auth/me` — devolve `{ authenticated: true/false }`, usado pelo
    frontend pra saber se já está logado ao abrir a página (evita mostrar a
    tela de login por um instante e sumir).
- **Hook `onRequest` global** em `backend/src/server.ts`, registrado antes das
  rotas de negócio: valida o cookie em toda rota `/api/*`, **exceto**
  `/api/health` (monitoramento externo sem login) e `/api/auth/login`. Sem
  cookie válido → `401`.
- **Cookie cross-origin**: como o frontend (Vercel) e o backend (EasyPanel)
  ficam em domínios diferentes, o cookie precisa de
  `SameSite=None; Secure; HttpOnly` (exige HTTPS nos dois lados — o EasyPanel
  já dá HTTPS automático via Traefik, e a Vercel também), e o `@fastify/cors`
  precisa de `credentials: true` com uma origem explícita (não pode ser
  wildcard `*` quando `credentials: true`).

### 4.2 Ponto técnico que nenhum dos dois planos anteriores cobriu: SSE + autenticação

`frontend/src/hooks/useWhatsAppStatus.ts:14` usa
`new EventSource("/api/whatsapp/events")` — o navegador **não permite** enviar
headers customizados num `EventSource`. Com cookie httpOnly isso resolve
sozinho, desde que o `EventSource` seja criado com a opção
`{ withCredentials: true }` (suportada nativamente) e o CORS do backend tenha
`credentials: true` com origem explícita — **nenhuma mudança de header
manual é necessária**, é exatamente por isso que cookie (e não um token tipo
`Authorization: Bearer`) foi escolhido em vez do `API_AUTH_TOKEN` original.

### 4.3 Frontend

- Novo componente `frontend/src/components/LoginPage.tsx` — formulário simples
  usuário/senha, chama `POST /api/auth/login`.
- `frontend/src/App.tsx` — antes de renderizar `MainApp`, checa
  `GET /api/auth/me`; se não autenticado, renderiza `LoginPage` em vez do
  painel.
- `frontend/src/api/client.ts:18` — `fetch(path, init)` precisa passar
  `credentials: "include"` (hoje não passa nada) pra mandar/receber o cookie
  em requisições cross-origin.
- Tratar `401` de forma centralizada em `request()` (`client.ts`) — se
  qualquer chamada devolver 401, jogar o usuário de volta pra tela de login
  (sessão expirou).

### 4.4 Dependências novas (backend)

- `bcrypt` (ou `bcryptjs`, sem binário nativo — mais simples de empacotar no
  Docker do EasyPanel) — hash/verificação de senha.
- `@fastify/cookie` — parse/assinatura de cookie.
- `jsonwebtoken` (se optar por JWT dentro do cookie) **ou** `@fastify/session`
  (se preferir sessão com store — para um usuário só, JWT assinado é mais
  simples e não precisa de tabela/nova dependência de storage).

**Recomendação**: `bcryptjs` + `@fastify/cookie` + `jsonwebtoken`, cookie
guardando o JWT assinado, expiração curta-média (ex. 12h) com renovação
silenciosa via `GET /api/auth/me` — dá pra ajustar depois.

---

## 5. Ordem de execução consolidada (os 4 pontos juntos)

A ordem importa porque autenticação e CORS precisam existir **antes** de a
API sair de `127.0.0.1`, e a remoção do Supabase/Sheets é a mudança mais
isolada e segura pra fazer primeiro (destrava o resto sem risco).

1. **Remover Supabase + Google Sheets** (seção 1) — isolado, sem dependência
   de mais nada, reduz superfície antes de mexer no resto.
2. **Autenticação** (seção 4) — login/senha, cookie, hook `onRequest`,
   `LoginPage`. Nesta fase o backend **ainda roda em `127.0.0.1`** (Rota A),
   então dá pra testar login/logout localmente sem já depender do EasyPanel.
3. **CORS condicional + `VITE_API_BASE_URL`** (seção 3.1) — preparar o código
   pra rodar cross-origin, ainda testando localmente (`CORS_ALLOWED_ORIGIN`
   apontando pra `http://localhost:5173`, por exemplo).
4. **Relatório em planilha HTML + imagem PNG** (seção 2) — independente dos
   itens 2 e 3, mas fica mais fácil de validar já com a aba "Planilha" atrás
   de login funcionando.
5. **Deploy real**: subir o backend no EasyPanel (volume persistente
   primeiro!) e o frontend na Vercel, configurar `AUTH_*`,
   `CORS_ALLOWED_ORIGIN`, `VITE_API_BASE_URL` de produção, e só então testar
   ponta a ponta: login funcionando cross-origin, cookie persistindo, SSE do
   WhatsApp funcionando com `withCredentials`, job manual disparando,
   relatório com imagem chegando no WhatsApp de teste.

## 6. Decisões que ainda ficam abertas pra você confirmar

1. **Duração da sessão/cookie de login** (sugeri 12h acima — pode ser mais
   curto ou mais longo, ou "sem expiração até logout manual").
2. **Nome do usuário admin** e a senha em si (não vai pro `.env.example`, só
   pro `.env` real de cada ambiente — preciso saber se é você mesmo quem vai
   gerar o hash bcrypt ou se quero deixar um script pronto tipo
   `scripts/generate-password-hash.ts` pra isso).
3. **Provedor da VPS** pro EasyPanel (ainda não escolhido, conforme já listado
   em `plano-deploy-easypanel-vercel.md` seção 5).
4. Confirmar que o `docs/plano-integracao-supabase-planilha.md` pode ser
   **apagado** do repo (em vez de só marcado como obsoleto) — prefiro
   perguntar antes de apagar histórico de planejamento sem pedido explícito.
