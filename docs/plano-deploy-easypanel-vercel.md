# Plano — Deploy alternativo: backend em VPS/EasyPanel + frontend na Vercel

Documento de planejamento (sem código). Objetivo: registrar uma **rota de deploy
alternativa** ao Windows Server 2012 R2 descrito no
`Kickoff — Sistema Node.js + React + Baileys...md` — backend rodando numa VPS
comum gerenciada por EasyPanel (Linux + Docker), frontend publicado na Vercel —
**sem descartar** a rota Windows Server 2012 R2, que continua sendo o plano
principal por enquanto.

Decisão registrada em `2026-08-23`: as duas rotas devem ser **viáveis a partir
do mesmo código-fonte**, diferenciadas só por variáveis de ambiente/configuração
de build — não por dois forks de código ou branches divergentes.

---

## 1. As duas rotas, lado a lado

| | **Rota A — Windows Server 2012 R2** (Kickoff atual) | **Rota B — EasyPanel + Vercel** (esta ideia) |
|---|---|---|
| Backend roda em | Windows Server 2012 R2, processo Node nativo (serviço via NSSM) | Container Docker (Linux) gerenciado pelo EasyPanel |
| Frontend | Build estático servido **pelo próprio backend** (`@fastify/static`, mesma origem) | Build estático publicado na **Vercel** (origem diferente do backend) |
| Rede | API só em `127.0.0.1`, acesso via RDP + browser local | API exposta publicamente (domínio HTTPS automático do EasyPanel/Traefik), consumida pela Vercel pela internet |
| Docker | Proibido no Kickoff | É a própria base do EasyPanel |
| Maior risco técnico | Compatibilidade de binários nativos com um SO antigo (Chromium, node-gyp, etc. — ver `docs/plano-relatorio-planilha-imagem.md` seção 2) | Persistência de dados sobrevivendo a redeploys de container (seção 3) e exposição pública de uma API hoje sem autenticação (seção 4) |
| Operação | Você administra o Windows Server inteiro (serviço, backup, updates) | EasyPanel/Vercel cuidam de deploy, HTTPS, restart automático — menos operação manual |

Nenhuma das duas é "mais certa" — são trade-offs diferentes (controle total vs.
menos operação manual). O ponto deste documento é deixar claro **o que
precisa mudar no código** para a Rota B funcionar sem quebrar a Rota A.

## 2. O que **não muda** entre as duas rotas

Vale registrar isso porque é fácil superestimar o tamanho da mudança:

- **SQLite**: o projeto já usa `node:sqlite` (`backend/src/database/index.ts`),
  o módulo nativo embutido no próprio Node — não é um binário externo
  compilado por plataforma (tipo `better-sqlite3`), então roda igual em
  Windows e Linux sem nenhuma preocupação extra de compatibilidade.
- **Baileys**: Linux é, na prática, o ambiente mais comum e mais testado para
  rodar Baileys — se algo, a Rota B é **menos** arriscada nesse ponto do que a
  Rota A.
- **Toda a lógica de negócio** (`backend/src/services/*`, `backend/src/jobs/*`,
  os repositórios em `backend/src/database/repositories/*`): nada disso
  depende de Windows ou Linux, nem muda entre as rotas.
- **`@napi-rs/canvas`** (proposto em `docs/plano-relatorio-planilha-imagem.md`):
  tem binário pré-compilado tanto para `win32-x64-msvc` quanto para
  `linux-x64-gnu`, então a decisão de gerar a imagem da planilha sem navegador
  headless continua valendo nas duas rotas.

## 3. O que muda de verdade — e onde entra no código

### 3.1 Persistência sobrevivendo a redeploy (infra, não código)

Um container Docker é descartável por padrão: a cada novo deploy no EasyPanel,
o filesystem do container é recriado do zero. Isso é o equivalente Linux do
princípio que já está registrado no Kickoff (seção 34, "separação entre código
e dados") — só que lá a separação é entre `releases/` e `storage/` em disco; no
EasyPanel, a separação é feita configurando um **volume persistente** montado
em `storage/` (contendo `database.sqlite`, `whatsapp/auth/` e `reports/`).
**Sem esse volume, a sessão do WhatsApp e o banco inteiro são apagados no
próximo deploy** — é o erro mais comum e mais fácil de esquecer nesse tipo de
plataforma. Isso é configuração no painel do EasyPanel, não uma mudança de
código.

### 3.2 API deixa de ser só localhost — precisa de CORS

Hoje o frontend e o backend são **sempre a mesma origem** (o backend serve o
build do React, ver `backend/src/server.ts:33-48`), então CORS nunca foi
necessário e não existe `@fastify/cors` no projeto. Na Rota B, a Vercel serve o
frontend num domínio e o backend responde em outro — isso é cross-origin por
definição.

Proposta: adicionar `@fastify/cors`, registrado **condicionalmente** — só
ativa uma origem permitida quando uma variável nova (ex.
`CORS_ALLOWED_ORIGIN`) estiver definida no `.env`. Na Rota A esse valor fica
vazio (nenhuma mudança de comportamento); na Rota B, aponta para o domínio da
Vercel. Mesmo padrão condicional que o projeto já usa para Supabase/Google
Sheets em `backend/src/services/dataSync/index.ts` (só ativa se as variáveis
de ambiente daquele serviço existirem).

### 3.3 API pública sem nenhuma autenticação hoje — ponto de atenção real

Verifiquei as rotas existentes (`backend/src/routes/health.ts`, `whatsapp.ts`,
`jobs.ts`, `reports.ts`): **nenhuma delas exige autenticação**. Isso é seguro
hoje porque a única forma de alcançá-las é `127.0.0.1` + RDP (Rota A). Na Rota
B, a API fica num domínio público — sem autenticação, qualquer pessoa na
internet que descobrir a URL conseguiria: ver/gerar o QR Code do WhatsApp,
conectar/desconectar a sessão, disparar jobs manualmente
(`/api/jobs/:id/run`), ler a lista de relatórios.

Proposta mínima: um token compartilhado simples (variável nova, ex.
`API_AUTH_TOKEN`), checado num hook `onRequest` do Fastify contra o header
`Authorization`, aplicado só quando a variável estiver definida — de novo,
zero impacto na Rota A (onde a variável fica vazia e a checagem nem roda), e
obrigatório de configurar antes de expor a Rota B publicamente. O
`/api/health` pode ficar de fora da checagem (é comum liberar health check
sem auth para monitoramento externo).

### 3.4 Frontend hoje assume "mesma origem" — precisa de uma base URL configurável

Dois pontos do frontend hoje chamam a API com caminho relativo, assumindo que
front e back estão no mesmo domínio:

- `frontend/src/api/client.ts:18` — `fetch(path, init)`, onde `path` é sempre
  algo como `/api/reports`.
- `frontend/src/hooks/useWhatsAppStatus.ts:14` —
  `new EventSource("/api/whatsapp/events")`, mesmo caso para o stream SSE.

Isso funciona perfeitamente na Rota A (mesma origem) mas quebra na Rota B (a
Vercel não tem `/api/*` — quem tem é o domínio do backend no EasyPanel).
Proposta: introduzir uma variável de build do Vite (ex. `VITE_API_BASE_URL`),
prefixada nos dois lugares acima. Com a variável vazia (default, e é isso que
o build da Rota A usa), o comportamento continua idêntico a hoje (caminho
relativo). Só o build feito especificamente para a Vercel define essa
variável apontando para a URL pública do backend no EasyPanel.

### 3.5 `@fastify/static` servindo o frontend — pode continuar existindo

O trecho em `backend/src/server.ts:33-48` que serve `frontend/dist` **não
precisa ser removido** para a Rota B funcionar — ele já lida bem com a
ausência do build (`fs.existsSync`, loga um aviso e segue). No deploy via
EasyPanel, simplesmente não se envia `frontend/dist` para o backend (ou, se
for enviado, fica sem uso, servindo só de fallback silencioso) — quem
realmente serve o frontend é a Vercel.

## 4. Passo a passo da Rota B (visão geral, sem comandos específicos ainda)

1. Configurar variáveis de ambiente do backend no EasyPanel (mesmas do
   `.env.example` hoje, mais `CORS_ALLOWED_ORIGIN`, `API_AUTH_TOKEN`, e
   `HOST=0.0.0.0` — a Rota A escuta em `127.0.0.1`, a Rota B **precisa**
   escutar em `0.0.0.0` para o Docker expor a porta para fora do container).
2. Configurar o volume persistente apontando para `storage/` (seção 3.1) antes
   do primeiro deploy — nunca depois, para não arriscar perder uma sessão do
   WhatsApp já escaneada.
3. Deploy do backend no EasyPanel a partir do repositório (build do
   `backend/` gerando `dist/`, mesmo `npm run build --workspace backend` já
   existente).
4. Deploy do frontend na Vercel apontando para `frontend/` como raiz do
   projeto, com `VITE_API_BASE_URL` configurada nas variáveis de ambiente de
   build da Vercel, valor = domínio público que o EasyPanel deu ao backend.
5. Testar CORS e autenticação de ponta a ponta antes de considerar
   "em produção": abrir o frontend da Vercel, confirmar que os cards do
   Dashboard carregam (prova que CORS está correto) e que rotas de ação
   (conectar WhatsApp, rodar job manual) respondem 401 sem o token e 200 com
   ele.

## 5. Decisões em aberto

1. **Qual VPS/provedor** vai hospedar o EasyPanel (isso muda specs de
   CPU/RAM disponíveis — vale registrar aqui quando decidido, para revisar se
   os mesmos cuidados de baixo consumo do Kickoff ainda se aplicam ou se há
   folga de recursos).
2. **Domínio**: usar um domínio próprio para o backend (mais fácil de
   lembrar/whitelistar no CORS) ou o subdomínio gratuito que o EasyPanel
   fornece?
3. **Nome e forma do token de autenticação** (`API_AUTH_TOKEN` simples via
   header, ou algo um pouco mais estruturado tipo JWT — para o tamanho atual
   do projeto, um token simples já resolve; JWT seria over-engineering aqui).
4. **A Rota A continua sendo testada/mantida na prática**, ou vira só
   documentação histórica a partir do momento em que a Rota B for pra
   produção? (Afeta se vale a pena manter os scripts em `scripts/*.ps1` e o
   fluxo de release em `releases/` atualizados.)
5. Se a Rota B virar a rota real de produção, revisar se a recomendação de
   `docs/plano-relatorio-planilha-imagem.md` (evitar Puppeteer por causa do
   Windows Server 2012 R2) ainda é necessária — num Linux comum via EasyPanel,
   headless Chrome volta a ser uma opção viável, embora `@napi-rs/canvas`
   continue sendo a opção mais leve nas duas rotas.

## 6. Ordem de implementação sugerida

1. `@fastify/cors` condicional (`CORS_ALLOWED_ORIGIN`) — mudança pequena e
   isolada, zero risco pra Rota A.
2. Hook de autenticação condicional (`API_AUTH_TOKEN`) nas rotas que alteram
   estado (`whatsapp`, `jobs`) — manter `/api/health` público.
3. `VITE_API_BASE_URL` no `frontend/src/api/client.ts` e
   `useWhatsAppStatus.ts`, com default vazio.
4. Validar a Rota A continua idêntica (build Windows local, sem nenhuma das
   variáveis novas setadas) antes de tentar a Rota B pela primeira vez.
5. Só então configurar EasyPanel (volume + variáveis) e Vercel, e testar o
   passo a passo da seção 4.
