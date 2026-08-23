# Plano de Refatoração — Clean Code / DRY / KISS / YAGNI

> Documento de planejamento. Nenhum código foi alterado ao produzi-lo. Serve como spec para as fases de implementação que virão depois, cada uma sob aprovação própria.

## 1. Contexto

O projeto é um monólito modular (Fastify + SQLite no backend, React + Vite no frontend, Baileys para WhatsApp) rodando em dev no Windows 11 e em produção num Windows Server 2012 R2 com 2 vCPU / 2GB RAM — um ambiente de recursos limitados, sem Docker, sem PM2 (usa NSSM). Isso importa para o plano: qualquer refatoração precisa continuar cabendo nesse alvo de deploy, sem introduzir processos extras, containers, filas ou dependências pesadas.

O código já é, no geral, bem escrito: funções puras, factories em vez de classes, comentários que explicam o "porquê" (não o "o quê"), sem abstrações fantasiosas. O objetivo desta refatoração **não é reescrever a arquitetura**, é:

1. Eliminar as duplicações reais que existem hoje (principalmente no frontend).
2. Remover código morto/especulativo (violações de YAGNI).
3. Consertar promessas de tooling quebradas (lint).
4. Deixar padrões hoje inconsistentes (ex.: só alguns componentes extraem um `StatusBadge`) uniformes em todo o projeto.
5. **Não** adicionar estrutura nova que o tamanho atual do projeto não justifica.

Decisões de escopo já confirmadas com o usuário (ver seção 6 para o que fica de fora):

- Os repositórios `settings` / `whatsapp_metadata` / `application_state` (nunca usados, previstos no Kickoff original mas nunca implementados) serão **removidos**, não implementados nem mantidos como scaffolding.
- ESLint + Prettier serão **configurados** (hoje `npm run lint` existe no `package.json` mas não há config nem dependência instalada — o comando falha).
- **Não** será criado um workspace `packages/shared-types` — os poucos tipos de payload duplicados entre backend/frontend continuam duplicados (KISS).
- Os estilos inline (`style={{...}}`) do frontend **serão migrados** para classes CSS do design system já existente em `index.css`.

## 2. Diagnóstico

### 2.1 Backend (`backend/src`) — nota geral: bom, ajustes pontuais

O que está bom e deve ser preservado como padrão:
- Factories (`createX(...)`) em vez de classes — manter.
- Repositórios com prepared statements + mapeamento `snake_case → camelCase` (`jobsRepository.ts`, `jobRunsRepository.ts`, `reportsRepository.ts`) — manter o padrão, é consistente e não vale generalizar (5 tabelas não justificam um mapper genérico).
- `env.ts` como único ponto de leitura de variáveis de ambiente — manter.
- Comentários "por quê" (ex. `whatsappManager.ts` explicando por que limpa credenciais em `loggedOut`) — manter esse estilo.

Problemas encontrados:

| # | Achado | Onde | Tipo |
|---|--------|------|------|
| B1 | 3 repositórios + 3 tabelas SQLite nunca usados em nenhuma rota/serviço (`settingsRepository.ts`, `applicationStateRepository.ts`, `whatsappMetadataRepository.ts`, tabelas `settings`/`whatsapp_metadata`/`application_state` em `database/index.ts`) | `backend/src/database/repositories/*`, `backend/src/database/index.ts` | YAGNI |
| B2 | Logger criado ad-hoc em dois lugares com `pino({ level: "warn" })` hardcoded, em vez de reusar `loggerOptions`/logger da app | `services/whatsapp/whatsappManager.ts:34`, `jobs/index.ts:12` | DRY |
| B3 | Cada arquivo de rota que precisa do banco repete `getDatabase()` + `createXRepository(...)` na sua própria função de registro (`jobsRoutes`, `reportsRoutes`) — duplica a fiação de dependências | `routes/jobs.ts`, `routes/reports.ts` | DRY (menor) |
| B4 | `npm run lint` (`eslint src --ext .ts`) não tem ESLint instalado nem config — comando falha hoje | `backend/package.json`, `frontend/package.json` | Tooling quebrado |
| B5 | Sem validação de startup para env vars obrigatórias por feature (hoje cada serviço confere on-demand, ex. `isSupabaseConfigured()`, `getOtodataClient()`) — funciona, mas falha só na hora do job rodar, não no boot | `config/env.ts` e usos espalhados | Observação, não bloqueante |

Nada encontrado que indique over-engineering pesado no backend (sem DI container, sem ORM, sem camadas fantasmas) — o backend está mais perto do alvo do que do problema.

### 2.2 Frontend (`frontend/src`) — nota geral: principal foco da refatoração

Problemas encontrados:

| # | Achado | Onde | Tipo |
|---|--------|------|------|
| F1 | Toda ação (`connect`, `disconnect`, `reconnect`, `run`, `toggle`, `refresh`) repete o mesmo bloco `setPending → fetch → if(res.ok) toast.success else toast.error → catch toast.error → finally setPending(false)` | `JobsPanel.tsx`, `WhatsAppPanel.tsx`, `DashboardPanel.tsx`, `ReportsPanel.tsx` | DRY (maior duplicação do projeto) |
| F2 | Hooks de dados (`useJobs`, `useReports`, `useHealth`) repetem `fetch` + `await res.json()` + cast sem client HTTP nem tratamento de erro padronizado (`useReports`/`useJobs` nem tratam `res.ok`) | `hooks/*.ts` | DRY + bug latente (erro HTTP não tratado nesses dois) |
| F3 | Centenas de `style={{...}}` inline, embora exista um design system completo (995 linhas de `index.css` com `.card`, `.pill`, `.stats-*`, variáveis `--*`) já usado parcialmente | quase todos os componentes | DRY/Consistência |
| F4 | Lógica de busca+filtro por status duplicada quase idêntica | `JobsPanel.tsx` (`filteredJobs`) e `ReportsPanel.tsx` (`filteredReports`) | DRY |
| F5 | Badge de status renderizado de 3 formas diferentes: componente dedicado (`ReportStatusBadge` em `ReportsPanel.tsx`), função local (`getWhatsAppPill` em `Navbar.tsx`), e ternários inline repetidos (`JobsPanel.tsx`, `DashboardPanel.tsx`) | vários | Inconsistência de padrão |
| F6 | `useHealth`, `useJobs`, `useWhatsAppStatus` são chamados de forma independente em múltiplos componentes ao mesmo tempo (`Navbar` e `DashboardPanel` chamam `useHealth`/`useWhatsAppStatus` cada um; `App` e `DashboardPanel` chamam `useJobs` cada um) → múltiplos pollings/EventSources concorrentes buscando os mesmos dados | `App.tsx`, `Navbar.tsx`, `DashboardPanel.tsx` | Ineficiência / estado duplicado |
| F7 | Componentes grandes demais, misturando fetch + regra de negócio + apresentação (`JobsPanel.tsx` ~320 linhas, `WhatsAppPanel.tsx` ~374 linhas, `DashboardPanel.tsx` ~460 linhas) | idem | SRP |
| F8 | `window.confirm` usado para confirmação destrutiva (`WhatsAppPanel.tsx:49`) — funcional, mas foge do design system (toasts/modal já existem) | `WhatsAppPanel.tsx` | Consistência (menor, opcional) |

Nada no frontend indica biblioteca de estado desnecessária, CSS-in-JS, ou qualquer dependência de peso — as duas dependências de runtime são só `react`/`react-dom`/`lucide-react`. O problema é 100% duplicação e inconsistência de padrão dentro do próprio código, não over-engineering de dependências.

### 2.3 Tooling / repo

- `.gitignore` já correto (`dist/`, `releases/`, `storage/**` com `.gitkeep`) — nada a mudar aqui.
- Sem ESLint/Prettier configurados apesar dos scripts existirem (ver B4).
- Sem CI (não faz parte deste plano — fora de escopo, não foi pedido).

## 3. Princípios orientadores

- **DRY** (Fowler: *Extract Function*, *Extract Class*) — cada bloco de lógica repetido 2+ vezes com a mesma forma vira uma função/hook/componente único.
- **KISS** — a solução mais simples que resolve a duplicação real observada, não a mais genérica possível. Nada de abstrair "para o caso de precisar no futuro".
- **YAGNI** — remover o que não é usado (achados B1). Não construir o que ainda não foi pedido (shared-types, DI container, settings feature).
- **SRP leve** — componentes React grandes viram: 1 componente de dados (fetch/hook) + 1 ou mais componentes de apresentação puros. Sem forçar um componente por elemento.
- **Fowler — Refactoring catalog** aplicado pontualmente: *Extract Function* (handlers de ação), *Extract Component* (badges/pills), *Introduce Parameter Object* (props de `StatsCard` já segue isso, manter), *Remove Dead Code* (B1), *Consolidate Duplicate Conditional Fragments* (filtros de `JobsPanel`/`ReportsPanel`).
- **Convenção sobre configuração**: os padrões que já existem e funcionam bem (factories no backend, prepared statements, `pill`/`card` no CSS) são a referência — a refatoração estende esses padrões para onde eles ainda não chegaram, em vez de inventar novos.

## 4. Spec detalhada por trabalho

### 4.1 Backend

**B1 — Remover scaffolding não usado**
- Deletar `backend/src/database/repositories/settingsRepository.ts`, `applicationStateRepository.ts`, `whatsappMetadataRepository.ts` e seus respectivos `.test.ts` se existirem (confirmar antes; hoje só `keyValueRepository.test.ts` cobre o genérico).
- Remover as tabelas `settings`, `whatsapp_metadata`, `application_state` de `runMigrations()` em `database/index.ts`. **Atenção**: isso é uma mudança de schema — como as tabelas nunca têm dados gravados (nenhum código escreve nelas), não há migração de dados a fazer, mas vale confirmar em produção (`storage/database.sqlite`) que estão de fato vazias antes de aplicar, com um `SELECT count(*) FROM settings`/etc.
- Se `keyValueRepository.ts` ficar sem nenhuma tabela em `ALLOWED_TABLES`, removê-lo também (hoje ele só existe para servir os 3 repositórios acima).
- Atualizar `Kickoff — ....md` ou o novo `docs/plano-refatoracao-clean-code.md` — **não** apagar a menção original no Kickoff (é um documento histórico), mas deixar claro aqui que a feature de "settings" foi descontinuada do escopo atual.

**B2 — Logger único**
- `jobs/index.ts` e `services/whatsapp/index.ts` (que hoje instancia `whatsappManager` sem logger algum, enquanto `whatsappManager.ts` cria o seu próprio) devem receber um logger compartilhado em vez de cada módulo instanciar `pino({ level: "warn" })`.
- Criar `backend/src/utils/logger.ts` → exportar também `createSilentServiceLogger()` (ou reaproveitar uma instância única criada em `server.ts` e passada para `getWhatsAppManager(logger)` / `getScheduler(logger)` via parâmetro).
- Isso implica mudar a assinatura de `getWhatsAppManager()` e `getScheduler()` para aceitarem o logger da app (injeção simples via parâmetro, não DI framework) — chamada uma vez em `server.ts`, com fallback interno só para os testes que hoje instanciam sem logger.

**B3 — Reduzir fiação repetida nas rotas**
- Mudança pequena e opcional: criar um objeto de repositórios montado uma vez (`createRepositories(database)` retornando `{ jobs, jobRuns, reports }`) e passar para as funções de rota, em vez de cada `routesX.ts` chamar `getDatabase()` de novo. Evita 2 linhas repetidas por rota — baixo risco, baixo ganho, mas alinhado ao padrão que o próprio projeto já usa (`getScheduler()`, `getWhatsAppManager()` como pontos únicos de composição).

**B4 — ESLint + Prettier**
- Adicionar `eslint` (flat config, `eslint.config.js` na raiz ou um por workspace), `@typescript-eslint/*`, `eslint-plugin-react-hooks` (frontend), `prettier` + `eslint-config-prettier`.
- Alinhar as regras ao estilo já em uso no código (aspas duplas, ponto e vírgula, 2 espaços, `strict` do TS já ligado em ambos `tsconfig.json`) — não introduzir um estilo novo, só formalizar o que já existe.
- Scripts `lint` já existem nos `package.json` — só vão passar a funcionar.

### 4.2 Frontend

**F1 + F2 — Client HTTP + hook de ação únicos**
- Criar `frontend/src/api/client.ts`: um wrapper fino sobre `fetch` (`apiGet<T>(path)`, `apiPost<T>(path, body?)`) que centraliza `res.ok` → throw com mensagem consistente, e parse de JSON. Sem biblioteca externa (axios, react-query) — é `fetch` + 15 linhas, KISS.
- Criar `frontend/src/hooks/useApiAction.ts`: hook genérico que recebe uma função assíncrona e mensagens de toast (pending/success/error), devolve `{ run, isPending }`. Substitui o bloco repetido do achado F1 em `JobsPanel` (2 handlers), `WhatsAppPanel` (3 handlers), `DashboardPanel` (1 handler), `ReportsPanel` (1 handler).
- Reescrever `useJobs`, `useReports`, `useHealth` para usar `apiGet` (corrige de brinde o bug de F2 onde `useJobs`/`useReports` não checam `res.ok`).

**F3 — Eliminar estilos inline**
- Auditar `index.css` (995 linhas) e mapear cada padrão de `style={{...}}` repetido para uma classe existente ou uma nova classe utilitária pequena (ex.: `.flex-between`, `.chip`, `.section-divider`) seguindo a nomenclatura já usada (`kebab-case`, variáveis `--*` existentes).
- Migrar componente por componente (ordem sugerida: `StatsCard` e `Navbar` primeiro, por serem os mais simples e mais reusados; depois `JobsPanel`/`ReportsPanel`/`DashboardPanel`/`WhatsAppPanel`/`JobHistoryModal`).
- Critério de aceite por componente: nenhum `style={{ ... }}` remanescente exceto valores genuinamente dinâmicos calculados em runtime (ex. cor calculada a partir de uma variável — hoje a maioria dos "dinâmicos" são na verdade só 2-3 estados possíveis, viram classes condicionais `pill-success`/`pill-error` etc., já é o padrão usado em outros lugares do mesmo arquivo).

**F4 — `useFilteredList` (ou hook local equivalente)**
- Extrair a lógica de busca-texto + filtro-por-status de `JobsPanel`/`ReportsPanel` para um hook `useSearchAndFilter<T>(items, { searchFields, filterFn })` ou, se ficar mais simples e legível, duas funções puras testáveis (`filterJobs`, `filterReports`) fora do componente. Preferir a opção mais simples que remova a duplicação sem esconder a lógica de negócio (KISS > DRY aqui — não force um hook genérico se 2 funções puras já resolvem).

**F5 — Um único componente de badge de status**
- Consolidar em `frontend/src/components/StatusPill.tsx` (nome novo, ou reaproveitar a classe `.pill` já existente) as variantes hoje espalhadas: `ReportStatusBadge`, `getWhatsAppPill`, os ternários de status de job. Um componente `<StatusPill tone="success|warning|error|neutral|info" icon={...}>label</StatusPill>` cobre os 4 usos atuais.

**F6 — Fonte única de dados para polling**
- Levantar `useJobs`, `useHealth`, `useWhatsAppStatus` para serem chamados uma única vez em `App.tsx` (ou em providers de contexto dedicados, seguindo o padrão que `ThemeContext`/`ToastContext` já estabelecem) e distribuídos via props/contexto para `Navbar`, `DashboardPanel`, `JobsPanel`, `WhatsAppPanel`. Isso elimina EventSources e intervalos de polling duplicados rodando ao mesmo tempo para o mesmo dado.
- Abordagem recomendada, coerente com o que já existe: criar `AppDataContext` (mesmo molde de `ToastContext.tsx`) só para os 3 hooks de dados globais (`jobs`, `health`, `whatsapp`) — não recriar um Redux/Zustand, é só levantar o estado um nível.

**F7 — Decompor os 4 componentes grandes**
- Consequência natural de F1+F5+F3: depois de extrair `useApiAction`, `StatusPill` e mover os estilos para CSS, `JobsPanel`/`WhatsAppPanel`/`DashboardPanel`/`ReportsPanel` encolhem sozinhos. Onde ainda sobrar tamanho, extrair só o que tem identidade própria e reuso claro (ex.: `JobsTable`, `JobRow` dentro de `JobsPanel` — não quebrar em 10 arquivos sem necessidade).

**F8 — `window.confirm`**
- Trocar a confirmação de desconectar WhatsApp por um modal simples reaproveitando o padrão de `JobHistoryModal.tsx` (`.modal-overlay`/`.modal-content` já existem no CSS), para consistência visual. Baixa prioridade, incluir só se sobrar tempo/risco aceitável — não é bug, é polimento.

## 5. Ordem de execução proposta

Fases pensadas para serem independentes e revertíveis, cada uma com sua própria aprovação antes de codar:

1. **Fase 0 — Tooling**: ESLint + Prettier (B4). Não toca lógica, só configura; roda em cima do código atual e já denuncia parte dos achados acima automaticamente.
2. **Fase 1 — Backend cleanup**: B1 (remover settings/whatsapp_metadata/application_state), B2 (logger único), B3 (fiação de rotas). Risco baixo, sem mudança de comportamento visível.
3. **Fase 2 — Frontend: camada de dados**: F1 (api client + `useApiAction`), F2 (hooks corrigidos), F6 (contexto de dados único). Base para as fases seguintes.
4. **Fase 3 — Frontend: componentes de apresentação**: F5 (`StatusPill`), F4 (filtro único), F8 (modal de confirmação).
5. **Fase 4 — Frontend: CSS**: F3 (migração de inline styles → classes), componente por componente, testando visualmente cada um (`/run` no navegador) antes de passar pro próximo.
6. **Fase 5 — Frontend: decomposição final**: F7, só onde ainda fizer sentido depois das fases 2-4.

## 6. Fora de escopo (decisão deliberada, não esquecimento)

Para não reintroduzir over-engineering enquanto removemos o existente:

- **Não** criar `packages/shared-types` — tipos de payload continuam duplicados entre backend/frontend (poucos, pequenos, baixo custo de manter sincronizados manualmente).
- **Não** adicionar ORM (Prisma/Drizzle) — `node:sqlite` + prepared statements já é simples e suficiente para 5 tabelas.
- **Não** adicionar container de DI (Awilix/InversifyJS) — os `getX()` singletons via closure já cumprem o papel para este tamanho de app.
- **Não** adicionar Redux/Zustand/Context genérico de estado global — o `AppDataContext` da Fase 2 é deliberadamente estreito (só os 3 hooks de polling), não um store genérico.
- **Não** adicionar CSS-in-JS/Tailwind — o design system já existente em `index.css` é suficiente; o problema era não usá-lo, não a ferramenta.
- **Não** reimplementar a feature "settings" do Kickoff — decisão confirmada: remover o scaffolding, não completá-lo.
- **Não** mexer no fluxo de negócio dos serviços (`dailyReport`, `dataSync`, `whatsappManager`, integrações Otodata/Supabase/Google Sheets) além do que B2/B3 exigem — esses módulos já seguem os padrões desejados.

## 7. Critérios de validação (por fase)

- Fase 0: `npm run lint` roda e termina sem erro de configuração (pode reportar findings — ok, viram itens das fases seguintes).
- Fase 1: `npm run typecheck` (backend) + `npm run test --workspace backend` continuam passando; `npm run dev:backend` sobe normalmente; testar manualmente `/api/jobs`, `/api/reports`, `/api/whatsapp/status` continuam respondendo.
- Fase 2-3: `npm run typecheck` (frontend) sem erros; testar manualmente no navegador (`npm run dev:frontend`) os 4 fluxos: rodar job, alternar job, conectar/desconectar WhatsApp, listar relatórios — comparar comportamento antes/depois.
- Fase 4: revisão visual manual de cada tela em light/dark mode (o `ThemeContext` já suporta os dois) — nenhuma regressão visual.
- Fase 5: `npm run build` completo (frontend + backend) sem erros, igual ao fluxo de deploy real descrito no `README.md`.

## 8. Riscos

- **Remoção das tabelas (B1)** é a única mudança com efeito irreversível em dados — mitigar confirmando que as 3 tabelas estão vazias em `storage/database.sqlite` antes de rodar a migração, e fazendo backup do arquivo `.sqlite` antes (já existe `scripts/backup.ps1`).
- **Migração de CSS (F3)** é mecânica mas tem volume alto (praticamente todo componente) — maior risco de regressão visual sutil; mitigar migrando um componente por vez com validação visual manual antes do próximo, em vez de um commit único.
- **Contexto de dados único (F6)** muda o timing de quando os componentes recebem atualizações — mitigar testando os cenários de reconexão de WhatsApp e execução de job em tempo real depois da mudança, não só a montagem inicial.
