# Plano de Desenvolvimento — Sistema Node.js + React + Baileys

Baseado no documento de kickoff. Este arquivo é o plano vivo do projeto: decisões de stack,
fases, riscos e status. Atualizar conforme o projeto avança.

## 1. Decisão de stack (Seção 36 do kickoff)

Critério de prioridade usado em toda decisão: **Compatibilidade > Estabilidade > Baixo consumo > Simplicidade > Novidade**.

| Item | Escolha | Motivo |
|---|---|---|
| Node.js | **24.x LTS** (Active LTS até ~04/2028; máquina local já tem v24.19.0) | Baileys exige Node ≥ 20. Node oficialmente **deixou de suportar Windows Server 2012 R2 a partir da v18** (rebaixado para "não suportado"), mas na prática continua funcionando em builds recentes desde que o Windows tenha o Universal C Runtime (UCRT) instalado via **KB2999226** (update de abril/2014). Node 22 (Maintenance LTS, EOL ~04/2027) é alternativa mais conservadora, mas Node 24 (Active LTS até 2028) dá mais tempo de vida útil sem exigir upgrade no meio do projeto. **Risco #1 do projeto — ver seção 3.** |
| npm | O que vem empacotado com Node 24 (11.x) | Sem necessidade de fixar separadamente. |
| TypeScript | 5.7+ (mais recente estável) | Só roda em dev/build; não afeta runtime da VPS (compila para JS puro). |
| React | **18.3.x** (não React 19) | O navegador que renderiza a SPA roda **dentro do próprio Windows Server 2012 R2** (acesso via RDP → browser local no servidor, seção 16). Não sabemos que browser existirá lá por padrão (IE11 não serve). React 18 é mais maduro/conservador; evitar features de ponta desnecessárias. **Ação necessária:** instalar um browser moderno (Firefox ESR ou Chrome/Chromium ainda compatível com Server 2012 R2) na VPS — ver seção 3. |
| Vite | 5.x (build only) | Ferramenta só de build; não é executada em produção. |
| Baileys | **`@whiskeysockets/baileys@6.7.24`** (tag `legacy`, fixar exata) — decisão revisada após auditoria de dependências | Auditado via `npm view`: a linha `latest` (7.0.0-rc14) depende de `whatsapp-rust-bridge` (Rust compilado para **WebAssembly**, não um `.node` nativo por SO/arquitetura — sem `dependencies` própria, ~2MB, roda no motor WASM já embutido no V8/Node, então o risco é bem menor do que "módulo nativo" clássico). Ainda assim, a tag `legacy` (6.7.24) **não tem nenhuma dependência nativa/WASM** — só JS puro (`ws`, `pino`, `axios`, `protobufjs`, `libsignal-node` do fork WhiskeySockets, que por sua vez só depende de `protobufjs` + `curve25519-js`, também puro JS). `legacy` foi publicada no mesmo dia que a `7.0.0-rc14` (2026-07-29), ou seja, é mantida ativamente em paralelo, não uma tag abandonada. Mesmo requisito de Node (`>=20.0.0`). Escolhida por remover de vez a única dependência não-100%-JS do projeto — reavaliar periodicamente se `legacy` continuar recebendo updates de protocolo do WhatsApp. Processamento de imagem: usar **jimp** (puro JS) em vez de `sharp` (nativo) como peer dependency de thumbnails. |
| SQLite | **`node:sqlite`** (built-in do Node, `DatabaseSync`) — decisão revisada na Fase 0 | Tentativa inicial foi `better-sqlite3`, mas falhou na prática: sem binário prebuilt para Node 24.19 no Windows e sem Visual Studio Build Tools instalado na máquina de dev para compilar via node-gyp. Trocar para `node:sqlite` elimina inteiramente a categoria de risco "módulo nativo externo" para o banco — SQLite vem compilado dentro do próprio binário do Node, então se o Node roda no Server 2012 R2 (risco #1), o banco roda junto, sem passo de instalação/compilação separado. Custo aceito: API ainda é *release candidate* no Node 24 (estabiliza no Node 26), mas como fixamos a versão exata do Node em dev e produção, a superfície não muda sob nós durante o projeto. API confirmada compatível com o padrão usado (`exec`, `prepare().run/get/all`). |
| HTTP framework | **Fastify** | Mais leve em memória/CPU que Express, schema validation nativo, bom suporte a streaming (necessário para SSE). |
| Scheduler | **croner** | Zero dependências, puro JS, mais preciso que `node-cron` (lida melhor com DST), pegada mínima de memória. |
| WebSocket/SSE (QR code e status) | **SSE (Server-Sent Events)** nativo via stream do Fastify, sem lib extra | Único cliente local via RDP — não precisa de canal bidirecional nem da complexidade/memória de um servidor WS. HTTP puro simplifica o proxy/firewall também. |
| Serviço Windows | **NSSM (Non-Sucking Service Manager)** | Binário único, minúsculo, décadas de uso comprovado em Windows Server antigos, reinício automático em crash, sem dependências Node adicionais (mais leve que `pm2`/`node-windows`). |
| Estratégia de build | `tsc` (backend → CommonJS) + `vite build` (frontend → `frontend/dist`) | CommonJS no backend evita qualquer aresta de interop ESM/`require()` — hoje o backend não tem nenhum módulo nativo (`node:sqlite` é built-in, Baileys `legacy` é JS puro), mas mantém a opção simples caso isso mude. |
| Estratégia de deploy | `releases/<timestamp>/` + junction `current` (`mklink /J`, funciona sem privilégio especial no Server 2012 R2) apontando para o release ativo; `storage/` fora do diretório de release, nunca sobrescrito | Permite rollback trocando o junction; nunca apaga sessão do WhatsApp nem o banco. |

## 1.1 Fonte de dados dos relatórios — Otodata Nee-Vo API v29

Documento `GUIA - API.pdf` (na raiz do projeto) analisado. É a API que alimenta o módulo de
**relatórios** (seção 13 do kickoff, Fase 5) — não tem relação com Baileys/WhatsApp, é uma API
REST/WCF de terceiros para monitores remotos de nível de tanque (propano/diesel/etc.).

- **Base URLs:** primária `https://neevo.otodata.ca/public/api/v1/DataService.svc` (ou
  `https://telematics.otodatanetwork.com:4431/v1.0/DataService.svc`), com uma **secundária**
  equivalente (`neevo2`/`telematics02`) para failover — o cliente HTTP deve tentar a secundária se a
  primária falhar.
- **Auth:** API key própria do cliente Otodata (não é a nossa, é gerada no portal Nee-Vo), via
  `?k=API_KEY` na URL ou header `Authorization: Bearer API_KEY`. HTTPS obrigatório. Guardar a key na
  tabela `settings` (já existe), nunca no `.env` versionado.
- **Formato:** XML por padrão; pedir JSON com header `Accept: application/json; charset=utf-8` (e
  `Accept-Encoding: gzip` para reduzir banda).
- **Endpoints relevantes para relatório de níveis de tanque:**
  - `GetDevices` — lista todos os tanques/dispositivos da conta (suporta `lastDateUtc` para trazer só
    o que mudou).
  - `GetDevice` / `GetSampleDevice` — um dispositivo específico / um "dummy" para testes sem gastar
    quota.
  - `GetTankLevels` / `GetDeviceTankLevels` — leituras históricas por período (`startDateUtc`/
    `endDateUtc` obrigatórios), **paginado em blocos de até 10000 leituras** — o cliente precisa
    iterar `page` até `Count < 10000`.
  - `DownloadReport` — a própria Otodata já gera um relatório pronto (Excel/CSV/`SuburbanSoftware`)
    como stream de bytes; pode ser uma alternativa mais simples que montar o relatório na mão a
    partir de `GetTankLevels`, a avaliar na Fase 5.
  - `GetGasMeters` — equivalente para medidores de gás, se aplicável ao negócio.
- **Modelo `Device`** tem os campos que provavelmente compõem o relatório: `Inventory`, `LastLevel`
  (0.0–1.0), `LastRead`/`LastFill` (UTC, atenção: `1900-01-01` = "sem leitura"), `Status` (texto:
  `OK`, `LOW ALARM`, `CRITICAL LOW ALARM`, `COMM TROUBLE`, etc.), `HoursToEmpty`, consumo
  (`Last24hr`/`Last48hr`/`Last72hr`/`LastWeek`), `BatteryAlarm`/`BatteryLevel`, `SignalStrength`,
  coordenadas GPS, `Product`, `TankFormType`.
- **Sem HTTP client novo:** `fetch` global do Node 24 é suficiente, zero dependência nova.
- Isso muda o desenho da Fase 5: vai existir um `services/otodata/` (cliente HTTP com failover
  primário/secundário + paginação) separado de `services/reports/` (que consome os dados e monta o
  relatório/envia por WhatsApp). Ainda não implementado — é conhecimento para quando chegarmos lá.

## 2. Estrutura do projeto (adaptada da seção 30)

```text
MeuNovoProjeto/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/{whatsapp,reports,automation,settings}/
│   │   ├── jobs/
│   │   ├── database/
│   │   ├── utils/
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── storage/            (git-ignored: whatsapp/, reports/, temp/, logs/, database.sqlite)
├── scripts/            (build-release, install-service, backup)
├── docs/               (decisões e runbooks)
├── package.json        (workspaces root)
├── .env.example
└── planejamento         (este arquivo)
```

## 3. Riscos e itens de validação (ANTES de investir mais engenharia)

1. **[CRÍTICO] Node 24 rodar de fato no Windows Server 2012 R2.** Não é mais "oficialmente suportado" desde a v18. Cadeia de pré-requisitos identificada (confirmar números exatos de KB na página oficial da Microsoft no momento do deploy — fontes variaram entre `KB2919442`/`KB2919355`/`KB2999226`): (a) update de pré-requisito → (b) rollup de abril/2014 → só então (c) o **Visual C++ Redistributable 2015–2022 (x64)** instala sem o erro `0x80240017` → (d) instalar Node 24 x64. Sem essa cadeia, Node falha com `api-ms-win-crt-runtime-l1-1-0.dll is missing`. Ação: assim que houver acesso à VPS, seguir essa cadeia, rodar `node -v` e `node -e "require('node:sqlite')"`, e depois copiar o build da Fase 0 e rodar `NODE_ENV=production node backend/dist/server.js` — deve responder `/api/health` igual local. Isso é só um smoke test do runtime, não é "desenvolver na VPS" — pode/deve ser feito cedo, em paralelo ao desenvolvimento local.
2. **Baileys.** Reavaliado (ver seção 1): optamos pela tag `legacy` (6.7.24), 100% JS, sem binário/WASM. Risco rebaixado de crítico para baixo. Ainda assim, testar cedo na Fase 2 (conectar de verdade, ver QR Code, persistir sessão).
3. **Browser na VPS.** Server 2012 R2 tem IE11 por padrão, incompatível com bundle do Vite/React moderno (Vite mira browsers com suporte a ES modules nativos). Providenciar instalação de Firefox ESR ou navegador Chromium compatível.
4. ~~better-sqlite3 nativo~~ — **resolvido na Fase 0** trocando para `node:sqlite` (built-in), que remove esse risco por completo (ver seção 1 da tabela de stack).
5. **`@fastify/static` precisa da major certa.** `^7.x` só suporta Fastify 4; com Fastify 5 é preciso `^8.x` (descoberto e corrigido na Fase 0 — servidor não subia por `FST_ERR_PLUGIN_VERSION_MISMATCH`).
6. **[Encontrado na revisão pré-Fase 2] Baileys `6.7.24` é ESM puro (`"type": "module"`), backend é CommonJS.** `require('@whiskeysockets/baileys')` quebraria com `ERR_REQUIRE_ESM`. Correção: trocar `"module"` do `tsconfig.json` do backend de `CommonJS` para `NodeNext` (mantendo `package.json` do backend em `"type": "commonjs"`) — assim o TypeScript preserva `import()` dinâmico como import real do Node em vez de rebaixar para `require()` (o que aconteceria com `"module": "CommonJS"`). Só o módulo que carrega o Baileys usa `await import(...)`; o resto do backend continua CJS normal.
7. **[Encontrado na revisão pré-Fase 2] `sharp` é peer dependency não-opcional do Baileys `6.7.24`** (`peerDependenciesMeta` só marca `jimp`, `audio-decode` e `link-preview-js` como opcionais — `sharp` fica de fora). Como npm 7+ auto-instala peer dependencies não-opcionais quando ausentes, isso poderia reintroduzir sem querer uma dependência nativa (`sharp`/`libvips`) que decidimos evitar. Mitigação: instalar `jimp` explicitamente como dependência direta do backend (Baileys prefere `sharp` só se presente, cai para `jimp` automaticamente) e confirmar no `npm install` real que `sharp` não entrou no `node_modules`.

## 4. Fases de execução

- **Fase 0 — Fundação (hoje):** estrutura de pastas, workspaces, tsconfig, lint/format, git init, `.env.example`, backend mínimo com `/api/health`, frontend mínimo servido pelo backend. *(Em execução agora.)*
- **Fase 1 — Banco de dados:** camada de acesso desacoplada (repositórios) sobre better-sqlite3; tabelas `settings`, `jobs`, `job_runs`, `reports`, `whatsapp_metadata`, `application_state`.
- **Fase 2 — WhatsAppManager + Baileys:** instância única persistente, `connect/disconnect/getStatus/getQRCode/sendMessage/...`, persistência de sessão em `storage/whatsapp/auth`, teste de reconexão. Validar o risco nº2 aqui.
- **Fase 3 — QR Code via SSE:** endpoint de eventos, tela de conexão no frontend.
- **Fase 4 — Scheduler + Jobs:** `croner`, tabela `job_runs`, idempotência.
- **Fase 5 — Relatórios:** geração HTML/CSV/TXT, envio via WhatsApp.
- **Fase 6 — Dashboard completo:** as 4 telas da seção 29.
- **Fase 7 — Build de produção e teste local "como se fosse VPS":** `npm run build`, rodar com `NODE_ENV=production` localmente, checklist da seção 23.
- **Fase 8 — Empacotamento e deploy:** script de release, NSSM, junctions, rollback, backup (seções 27, 32–34).
- **Fase 9 — Deploy real na VPS** (somente depois de tudo acima validado localmente).

## 5. Status atual

- [x] Kickoff lido e analisado.
- [x] Stack decidida e documentada (com riscos explícitos).
- [x] **Fase 0 concluída:** estrutura de pastas, workspaces npm, backend Fastify (`/api/health`, banco `node:sqlite` com schema inicial, serviço de arquivos estáticos), frontend React/Vite mínimo consumindo `/api/health`. Build de produção (`npm run build`) e execução com `NODE_ENV=production` testados localmente com sucesso: banco criado em `storage/database.sqlite`, health check respondendo `{"status":"ok","database":"ok"}`, frontend servido pelo próprio backend. Commit inicial em `066b681`.
- [x] **Auditoria de riscos críticos concluída** (Baileys + compatibilidade de produção). Resultado: Baileys trocado de `latest` (7.0.0-rc, WASM) para `legacy` (6.7.24, 100% JS); checklist concreto de pré-requisitos de VPS documentado na seção 3, item 1.
- [x] **Fase 1 concluída:** camada de repositórios desacoplada sobre `node:sqlite` (`backend/src/database/`):
  - `keyValueRepository` genérico (reaproveitado por `settings`, `whatsapp_metadata`, `application_state`, com allow-list de tabelas contra SQL injection via nome de tabela).
  - `jobsRepository` (upsert/list/findById/setEnabled).
  - `jobRunsRepository` (start/finish/isRunning/getLast/listRecent — base para a idempotência exigida na seção 12 do kickoff).
  - `reportsRepository` (create/updateStatus/getById/list).
  - Nenhum repositório importa o singleton do banco diretamente — todos recebem a instância via parâmetro (`DatabaseSync`), o que permitiu testá-los com banco `:memory:` e mantém a porta aberta para trocar o driver no futuro (seção 11 do kickoff).
  - 15 testes automatizados com `node:test` (nativo, zero dependência) cobrindo os 4 repositórios — `npm run test --workspace backend`.
  - **Bug real encontrado e corrigido durante os testes:** ordenar por `created_at`/`started_at` (resolução de 1s do `datetime('now')` do SQLite) é instável quando há múltiplos inserts no mesmo segundo — trocado para `ORDER BY id DESC` em `reportsRepository` e `jobRunsRepository`.
  - **Problema de build encontrado e corrigido:** `tsconfig.json` incluía `*.test.ts` no build de produção (arquivos de teste vazavam para `backend/dist/`). Separado em `tsconfig.build.json` (exclui testes, usado pelo `build`) mantendo `tsconfig.json` base cobrindo os testes no `typecheck`.
  - Build de produção completo (`npm run build` + `NODE_ENV=production node backend/dist/server.js`) revalidado do zero após as mudanças: health check OK, banco recriado do zero com sucesso.
- [x] **Fase 2 concluída (com validação real, não só typecheck):** `WhatsAppManager` (`backend/src/services/whatsapp/`) sobre `@whiskeysockets/baileys@6.7.24`.
  - Interface: `connect/disconnect/getStatus/getQRCode/sendMessage/sendImage/sendDocument`. `getChats`/`getContacts` da seção 8 do kickoff **deliberadamente adiados** — nada no app ainda consome lista de chats/contatos, e Baileys não tem uma API de "pull" simples para isso (exigiria manter um store próprio alimentado por eventos); implementar quando algo precisar.
  - Sessão persistida via `useMultiFileAuthState` em `storage/whatsapp/auth` (seção 10 do kickoff). Reconexão automática em queda de conexão que não seja logout explícito (`DisconnectReason.loggedOut`); `disconnect()` chama `sock.logout()` de propósito (desvincula o dispositivo, não é só fechar o socket).
  - Instância única via singleton (`services/whatsapp/index.ts`, mesmo padrão do `getDatabase()`), conectada automaticamente no boot do servidor (`server.ts`), status real exposto em `/api/health`.
  - Resolvido o risco nº6 (ESM puro do Baileys): `tsconfig.json` do backend trocado de `"module": "CommonJS"` para `"NodeNext"` — confirmado no `.js` compilado que o `import()` dinâmico permanece um import real (não vira `require()`, que quebraria com `ERR_REQUIRE_ESM`).
  - Resolvido o risco nº7 (`sharp` como peer dependency não-opcional): `.npmrc` na raiz com `omit=peer` — reinstalação do zero confirmada sem `sharp` em `node_modules`, com `jimp` presente como dependência direta.
  - **Validação real feita (não só compilar):** rodei o `WhatsAppManager` de verdade contra os servidores do WhatsApp — conectou e recebeu um QR Code genuíno (string de 237 caracteres) em poucos segundos. Isso confirma que o `import()` dinâmico funciona em runtime E que a conectividade de rede funciona a partir da máquina de dev.
  - **Limite conhecido e não contornável por mim:** parear de fato (escanear o QR com um celular) e validar a recuperação de sessão após reiniciar o Node exige uma ação manual do usuário — não dá para automatizar sem um celular real. Fica como próximo passo manual antes de avançar para produção.
  - Build de produção revalidado do zero: `/api/health` mostra `whatsapp: "connecting"` logo após o boot e `whatsapp: "qr"` poucos segundos depois — a transição de estado está correta (bug pego e corrigido: `status` só virava `"connecting"` depois do `import()`+`useMultiFileAuthState`, deixando uma janela em que uma consulta de status logo após `connect()` mostrava `"disconnected"` errado).
- [x] **Fase 3 concluída:** QR Code via SSE + tela de conexão no frontend.
  - `WhatsAppManager` ganhou `onChange(listener)` (EventEmitter interno, `node:events`, zero dependência nova) — emite toda vez que status/QR/número mudam.
  - Rotas novas: `GET /api/whatsapp/status`, `POST /api/whatsapp/connect`, `POST /api/whatsapp/disconnect`, `GET /api/whatsapp/events` (SSE via `reply.hijack()` + `reply.raw`, manda o status atual na conexão e depois cada mudança).
  - QR renderizado como imagem: pacote `qrcode` (puro JS, sem dependência nativa) converte a string crua do Baileys em `data:image/png;base64,...` no backend — o frontend só recebe uma URL de imagem pronta, sem precisar de nenhuma lib de QR no bundle do React.
  - Frontend: hook `useWhatsAppStatus` (`EventSource`) + componente `WhatsAppPanel` (status, imagem do QR, número conectado, botões conectar/desconectar), integrado em `App.tsx`.
  - **Validado de verdade via API:** subi o servidor em produção, consultei `/api/whatsapp/status` (retornou `"connecting"`) e fiz streaming real de `/api/whatsapp/events`, recebendo um evento com `qrDataUrl` de um QR genuíno gerado a partir da conexão real com o WhatsApp.
  - **Não validado (limite desta sessão):** a extensão Claude in Chrome não foi conectada (você optou por continuar sem ferramentas de navegador), então não consegui abrir `http://127.0.0.1:3000` num browser de verdade para confirmar visualmente o layout/imagem renderizando. A API por trás está confirmada funcionando; falta a confirmação visual — pode ser feita rodando `npm run build && NODE_ENV=production npm run start --workspace backend` e abrindo o navegador manualmente.
- [x] **Revisão de robustez do `WhatsAppManager` (antes da Fase 4):** encontrado ponto frágil real — em queda de conexão que não fosse logout/desconexão manual, o manager tentava reconectar imediatamente e sem limite (`void connectInternal()` direto no handler), o que criaria um loop apertado de tentativas em caso de falha persistente (risco de rate-limit/bloqueio pelo WhatsApp) e deixava uma promise rejeitada sem tratamento em caso de erro no próprio `connectInternal()`. Corrigido com backoff exponencial (1s → 30s de teto, resetado a zero em reconexão bem-sucedida), agendado via `setTimeout` e com `catch` que reagenda em vez de deixar a rejeição sem dono. `disconnect()` agora também cancela qualquer reconexão pendente. Revalidado com typecheck + 15 testes existentes, sem regressão.
- [x] **Fase 4 concluída:** Scheduler + Jobs sobre `croner` (`backend/src/jobs/`).
  - `scheduler.ts`: `createScheduler(definitions, jobsRepository, jobRunsRepository, logger)` — genérico, não sabe nada de relatório/automação, só orquestra `JobDefinition[]` (`id`, `name`, `cronExpression`, `run()`).
  - Idempotência/anti-duplicação (seção 12 do kickoff): antes de rodar, verifica `jobRunsRepository.isRunning(jobId)` — se já houver uma execução em andamento (disparo manual ou de outro tick), a nova é ignorada e logada como aviso, nunca roda em paralelo consigo mesma.
  - Toda execução passa por `start()`/`finish()` do `jobRunsRepository` (já existia desde a Fase 1) — início/fim, status `success`/`error`, mensagem de erro e duração ficam sempre registrados.
  - `start()` faz *seed* das definições na tabela `jobs` (só na primeira vez — se o registro já existe, respeita o `cron_expression`/`enabled` que estiver salvo no banco, permitindo edição futura via dashboard).
  - `setEnabled(jobId, enabled)` liga/desliga a tarefa **ao vivo** (cria ou para a instância do `Cron`), não só grava a flag no banco — evita o bug de "desabilitei mas o job continua habilitado até reiniciar o processo".
  - `definitions.ts`: 3 jobs placeholder, batendo com o exemplo da seção 12 do kickoff (`relatorio-manha` 08:00, `automacao-meio-dia` 12:00, `relatorio-noite` 18:00) — `run()` hoje só loga "ainda não implementado"; lógica real entra na Fase 5 (relatórios) e depois automação.
  - Rotas novas (`backend/src/routes/jobs.ts`): `GET /api/jobs` (lista + `isRunning` + último run), `GET /api/jobs/:id/runs` (histórico), `POST /api/jobs/:id/run` (disparo manual, ignora o cron), `POST /api/jobs/:id/toggle` (liga/desliga).
  - Scheduler iniciado no boot do servidor (`server.ts`, depois do `whatsapp.connect()`).
  - **6 novos testes** (`backend/src/jobs/scheduler.test.ts`, `node:test`) cobrindo: seed, sucesso, erro com mensagem, anti-sobreposição (dois `runNow()` concorrentes no mesmo job → só 1 run gravado), id desconhecido rejeita, `setEnabled` liga/desliga de verdade. Suíte completa do backend: **21/21 passando**.
  - **Validado em build de produção real** (não só typecheck): subi o servidor, chamei `/api/jobs` (3 jobs seedados), `/api/jobs/relatorio-manha/run` (executou e gravou o run), `/api/jobs/relatorio-manha/runs` (histórico correto), `/api/jobs/relatorio-manha/toggle` com `enabled:false` (persistiu) e `/api/jobs/naoexiste/run` (404 correto).
- [x] **Fase 5 concluída (v1): Relatório diário via API Otodata + WhatsApp.**
  - Chaves reais recebidas do usuário (Otodata Nee-Vo e OpenAI) e configuradas em `.env` local (nunca commitado — confirmado via `git check-ignore`). `.env.example` atualizado só com os nomes das variáveis (`OTODATA_API_KEY`, `OPENAI_API_KEY`, `REPORT_RECIPIENT_NUMBER`, `REPORTS_PATH`). OpenAI **não** tem nenhuma feature construída ainda — só a variável está pronta, por pedido explícito do usuário.
  - **Bug real encontrado na própria documentação:** o guia (lido via extração de texto simples) sugeria o endpoint `GetDevices`, mas o caminho HTTP correto documentado nos exemplos é `/devices` (minúsculo, sem "Get"). `GetDevices` retornava 404 "Endpoint not found" (erro WCF). Corrigido após reler o PDF com o parser completo. **Chave validada com uma chamada real:** 1012 dispositivos retornados, dados de clientes reais (tanques de GLP no Brasil).
  - `services/otodata/client.ts`: cliente HTTP simples (`fetch` nativo do Node 24, zero dependência nova) com failover primária (`neevo.otodata.ca`) → secundária (`neevo2.otodata.ca`) — se a primária falhar (erro de rede ou não-2xx), tenta a secundária antes de desistir.
  - `services/reports/dailyReport.ts`: função pura `buildDailyReportText(devices, referenceDate)` que separa os tanques em **alarmes ativos** (`LOW ALARM`, `CRITICAL LOW ALARM`, `OVERFILL ALARM`, `EMPTY ALARM`, `RAPID DRAW`, `COMM TROUBLE`, `HIGH ALARM`), **abastecimentos detectados** (`FILL DETECTION`) e um **resumo geral** por status — formatado em texto com marcação do próprio WhatsApp (`*negrito*`), sem depender de HTML/PDF por enquanto. Escopo combinado com o usuário: 1 relatório por dia (não 2), decisão de filtro pode ser revisada depois.
  - `services/reports/index.ts` (`runDailyReport`): busca os dispositivos, gera o texto, salva uma cópia em `storage/reports/relatorio-diario-<data>.txt`, registra na tabela `reports` (`generated` → `sent`/`error`), e envia via `WhatsAppManager.sendMessage` para `REPORT_RECIPIENT_NUMBER` (número do próprio usuário por enquanto, em desenvolvimento — ele já avisou que isso muda depois).
  - `jobs/definitions.ts` consolidado: removidos os dois placeholders de relatório (08h/18h) do exemplo original do kickoff, substituídos por um único job `relatorio-diario` (08:00) que chama `runDailyReport` de verdade. `automacao-meio-dia` mantido como placeholder (fora de escopo desta fase).
  - **6 novos testes** (`dailyReport.test.ts`, cobrindo separação de alarmes/abastecimentos e o caso "sem eventos"). Suíte completa do backend: **23/23 passando**.
  - **Validado em produção real, ponta a ponta:** build de produção, `POST /api/jobs/relatorio-diario/run` disparou uma chamada real à API Otodata (1012 dispositivos, ~3.3s), gerou o arquivo `.txt` com dados reais de clientes (ex.: Carrefour, Clube Atlético Mineiro com níveis/alarmes reais), tentou enviar via WhatsApp e falhou corretamente com `"WhatsApp não está conectado"` (esperado — o número ainda não foi pareado nesta sessão) — o erro ficou visível em `GET /api/jobs/relatorio-diario/runs`, confirmando que a Fase 4 (anti-duplicação, registro de erro) funciona de ponta a ponta com um job real. Arquivo de teste gerado (com dados reais de clientes) foi apagado do disco após a validação — está git-ignorado (`storage/**`), nunca seria commitado de qualquer forma.
- [x] **Pareamento real do WhatsApp validado pelo usuário.** Número conectado com sucesso pela interface. Corrigido no processo: o Baileys usa por padrão a assinatura de dispositivo `Browsers.ubuntu('Chrome')` (hardcoded no `Defaults` da lib), por isso aparecia "Ubuntu" na lista de aparelhos conectados do WhatsApp — trocado para um tuple customizado `["Painel de Relatórios", "Chrome", "1.0.0"]` em `makeWASocket()`, para o dispositivo aparecer identificável na lista.
- [x] **Fase 6 concluída: as 4 telas do dashboard (seção 29 do kickoff).**
  - **Dashboard**: status do WhatsApp, número conectado, último job (nome/status/data), próximo job (calculado via `Scheduler.getNextRun()`, novo método que expõe `task.nextRun()` do `croner`), último relatório, lista de erros recentes (agrega jobs com `lastRun.status === "error"` e reports com `status === "error"`) — tudo componível a partir dos endpoints já existentes, sem endpoint agregador novo.
  - **WhatsApp**: adicionado `lastEventAt` ao `WhatsAppStatus` (timestamp de toda mudança de status, exigido pela seção 29 como "último evento") e um botão **Reconectar** explícito (desconecta + conecta em sequência) — antes só existiam Conectar/Desconectar.
  - **Jobs**: nova rota `GET /api/jobs` passou a incluir `nextRun`; tela lista nome/status/próxima execução/última execução/último erro, com botões "Rodar agora" e "Ativar/Desativar", atualizando por polling a cada 5s.
  - **Relatórios**: nova rota `GET /api/reports` (reaproveita `reportsRepository.list()`); tela lista nome/data/status/arquivo.
  - Navegação simples por abas em `App.tsx` (sem lib de rotas — desnecessária pro tamanho do projeto, mantém o bundle mínimo).
  - Validado com typecheck (frontend + backend), suíte de testes (23/23) e build de produção completo.
- [x] **Teste real de ponta a ponta com o usuário:** parear → disparo manual do job `relatorio-diario` → relatório real gerado a partir de 1012 dispositivos da Otodata → enviado de verdade via WhatsApp pro número configurado (`REPORT_RECIPIENT_NUMBER`) → usuário confirmou recebimento. `job_runs` e `reports` gravados como `success`/`sent`.
- [ ] Ação pendente do usuário: assim que houver acesso à VPS, rodar o smoke test do risco #1 (seção 3) — cadeia de updates + VC++ Redist + Node 24 + `node:sqlite`.
- [ ] **Decisão adiada (o usuário pediu para revisar depois):** o filtro de "alarmes ativos" hoje usa o `Status` atual (snapshot de `GetDevices`), não um histórico real de eventos das últimas 24h (a API não tem um endpoint de "log de eventos" — teria que ser reconstruído via `GetTankLevels` por tanque, custoso para 1000+ dispositivos). Revisar se esse critério é suficiente ou se precisa de algo mais sofisticado.
- [ ] **Ação pendente do usuário:** trocar `REPORT_RECIPIENT_NUMBER` no `.env` quando o número de destino definitivo (não o do desenvolvedor) for decidido.
- [x] **Disparo 100% automático validado (sem trigger manual) + recuperação de sessão após restart.**
  - Reiniciei o servidor depois do pareamento: WhatsApp reconectou sozinho (`status: "connected"`, mesmo número) sem pedir QR novo — confirma a seção 10 do kickoff (persistência de sessão via `useMultiFileAuthState`).
  - Reagendei temporariamente `relatorio-diario` para poucos minutos no futuro (editando `cron_expression` direto na tabela `jobs`, sem tocar código) só para não esperar até 08:00 real, reiniciei o servidor e fiquei monitorando `GET /api/jobs/relatorio-diario/runs` sem chamar `/run` manualmente. **O job disparou sozinho no segundo exato agendado**, buscou os dados reais, gerou e enviou o relatório via WhatsApp — usuário confirmou recebimento. Cron devolvido para `"0 8 * * *"` (08:00 real) depois do teste.
  - Isso fecha a validação de ponta a ponta do pipeline automático: Baileys conectado → scheduler dispara sem intervenção → Otodata → WhatsApp, tudo persistindo corretamente em `jobs`/`job_runs`/`reports`.
- [x] **Revisão de robustez pedida pelo usuário ("a automação não deve quebrar por erro interno") — 4 problemas reais encontrados e corrigidos:**
  1. **Bug real, encontrado pelo usuário:** nome do arquivo do relatório era só `relatorio-diario-<data>.txt` — duas execuções no mesmo dia (o teste manual de disparo automático, seção acima) sobrescreviam o arquivo uma da outra, mesmo cada uma tendo sua própria linha em `reports`. Corrigido usando timestamp completo (até milissegundo) no nome do arquivo. Confirmado rodando o job duas vezes em sequência: dois arquivos distintos, ambos preservados.
  2. `services/reports/index.ts`: adicionado `Array.isArray(devices)` antes de processar a resposta da Otodata — se a API um dia devolver algo inesperado (erro silencioso, corpo vazio), falha com mensagem clara em vez de estourar `.filter is not a function` sem contexto.
  3. **`jobs/scheduler.ts` — o mais crítico:** `executeJob` só protegia com `try/catch` o `definition.run()`; uma falha no próprio `jobRunsRepository.isRunning()`/`.start()` (ex.: banco momentaneamente indisponível) escaparia como rejeição não tratada de uma Promise dentro do callback do `Cron` (chamado sem `await`) — que por padrão **derruba o processo Node inteiro** a partir do Node 15. Envolvido o corpo inteiro da função num `try/catch` externo.
  4. `routes/whatsapp.ts`: o envio de cada evento SSE (`send`) não tinha tratamento de erro — se o navegador fechasse a aba no instante exato de uma mudança de status, o `write` no socket já fechado rejeitaria sem handler. Agora todo envio (inicial e por mudança) passa por `.catch()` que só loga.
  5. **Rede de segurança final em `server.ts`:** `process.on("unhandledRejection"/"uncaughtException", ...)` registrados logo na criação do `app`, só logando via pino — nunca chamando `process.exit()`. Decisão deliberada: para um serviço de longa duração com scheduler diário, é preferível logar um erro raro e continuar vivo a perder a automação do dia inteiro até alguém notar e reiniciar manualmente na VPS.
  - Revalidado: typecheck + 23/23 testes, build de produção, restart com sessão do WhatsApp preservada, e duas execuções seguidas do job real confirmando arquivos distintos.
- [x] **Fase 7 concluída: auditoria de dependências + separação dev/produção mais estrita.**
  - `pino-pretty` movido de `dependencies` para `devDependencies` — só é usado quando `NODE_ENV !== "production"` (transport fica `undefined` em produção), não deveria nunca ir pra VPS.
  - `npm audit` encontrado com 3 vulnerabilidades: `@fastify/static` (alta severidade — path traversal / bypass de autorização, afeta produção de verdade) e `esbuild`/`vite` (moderada/alta, mas só do dev server do Vite, nunca vai pra VPS). Corrigido `@fastify/static` de `^8.0.3` para `^10.1.3` (major bump, mas sem breaking change observado no nosso uso — revalidado com toda a suíte + build + servidor real servindo o frontend/SPA fallback). `esbuild`/`vite` deixados como estão por serem risco só de dev local (não exposto — dev roda em localhost no Windows 11) e o fix exigir um major bump do Vite (5→8) sem necessidade clara.
  - Checklist da seção 22 do kickoff revisado: todos os itens já haviam sido validados de verdade ao longo da sessão (API, React, SQLite, Baileys, QR, persistência de sessão, reconexão, scheduler, relatórios, restart do Node, recuperação de sessão, build de produção) — único item não exercitado é "testar envio de documentos" (`sendDocument`/`sendImage` do `WhatsAppManager` existem pra atender a interface conceitual do kickoff, seção 8, mas nenhuma feature atual os usa — o relatório é só texto). Deixado como gap conhecido, não bloqueante.
- [x] **Fase 8 concluída: scripts de empacotamento e deploy (`scripts/`).**
  - **Decisão de arquitetura de instalação:** cada release é autocontido (`backend/dist` + `backend/package.json` + `backend/package-lock.json` + `backend/.npmrc` + `frontend/dist`), SEM depender de workspaces npm em produção — `npm ci` roda direto dentro de `backend/`, e o Node resolve `backend/node_modules` naturalmente ao rodar `backend/dist/server.js` (resolução de módulos sobe a árvore de diretórios). Isso evita toda a complexidade de tentar replicar workspaces na VPS.
  - **`scripts/update-backend-lockfile.ps1`**: gera `backend/package-lock.json` isolado (fora da árvore do workspace — rodar `npm install` dentro de `backend/` diretamente é interpretado como parte do workspace raiz e não gera lockfile próprio). Rodar sempre que `backend/package.json` mudar.
  - **Bug real encontrado e corrigido durante a validação:** `npm ci --omit=dev` (só isso) **reinstala o `sharp`** mesmo com `.npmrc` (`omit=peer`) presente — confirmado na prática gerando um release de teste completo e rodando `npm ls sharp`. Causa: passar `--omit=dev` explícito na linha de comando **sobrescreve** (não soma com) o `omit=peer` do `.npmrc` — é preciso passar os dois: `npm ci --omit=dev --omit=peer`. Documentado em comentário no `.npmrc`, no cabeçalho do `build-release.ps1` e nas instruções impressas pelo script. Sem essa descoberta, o deploy real teria silenciosamente reintroduzido a dependência nativa que decidimos evitar desde a Fase 2.
  - **`scripts/build-release.ps1`**: roda testes → build → monta `releases/<timestamp>_<commit-hash>/` autocontido, com `RELEASE_INFO.txt` (commit + timestamp) para rastreio/rollback. Não toca na VPS — só prepara o pacote local, a cópia é manual (passo 5 do processo de deploy da seção 32 do kickoff).
  - **`scripts/switch-release.ps1`**: troca o junction `current` para uma release específica via `mklink /J`, usando `cmd /c rmdir` (nunca `Remove-Item -Recurse`) para remover o junction antigo sem apagar o conteúdo real da release por trás dele — testado explicitamente: apagar o junction preserva os arquivos da release apontada.
  - **`scripts/backup.ps1`**: zipa `database.sqlite` (+ `-wal`/`-shm` se existirem, pra não arriscar snapshot inconsistente do modo WAL), `whatsapp/auth/` e `reports/`; mantém só os últimos N backups (padrão 14) pra não crescer infinitamente no disco de 2GB.
  - **`scripts/install-service.ps1`**: registra o serviço via NSSM com restart automático em crash (`AppExit Default Restart`) e rotação de log **pelo próprio NSSM** (`AppRotateFiles`/`AppRotateBytes`, 10MB) — resolve o requisito de "rotação de logs" da seção 25 do kickoff sem precisar de nenhuma dependência nova no Node.
  - **Validação real completa do pipeline de deploy** (sem VPS, mas simulando a estrutura exata): gerei um release de verdade, rodei `npm ci --omit=dev --omit=peer` dentro dele (confirmado: zero `sharp`, zero ferramentas de dev), montei uma estrutura `app/` simulada (`current` via junction real + `storage/` + `.env` fora do release) e subi o servidor de lá — health check OK, frontend servido através do junction, banco criado em `storage/` (fora do release, nunca dentro do build), WhatsApp tentou conectar de verdade e gerou QR. Tudo consistente com as seções 33/34 do kickoff (separação código/dados, rollback sem apagar storage).
  - **Nota operacional:** o repositório de dev vive dentro de uma pasta sincronizada pelo OneDrive — gerar um release com `node_modules` (200+ pacotes) ali dispara sincronização que trava a exclusão da pasta por um tempo depois. Não afeta a VPS (lá não há OneDrive), só atrapalha limpar pastas de teste localmente. Recomendação: excluir `releases/` do sync do OneDrive, ou aceitar que a limpeza pode precisar esperar alguns segundos/minutos.
