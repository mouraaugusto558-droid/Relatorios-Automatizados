# Plano — Integração com Supabase e Google Sheets

Documento de planejamento (sem código). Objetivo: persistir os dados da API Otodata
também no Supabase (Postgres gerenciado) e numa planilha Google, além de expor no
dashboard a última execução dessa sincronização.

Baseado no estado real do projeto em `2026-08-22`:
- Persistência local hoje é `node:sqlite` puro (sem ORM), com repositórios manuais
  (`backend/src/database/repositories/*`) e migrações em `backend/src/database/index.ts`.
- Já existe um mecanismo genérico de jobs com histórico de execução
  (`jobsRepository` + `jobRunsRepository`, `backend/src/jobs/scheduler.ts`,
  `backend/src/jobs/definitions.ts`) e o frontend **já** exibe "Última execução" por
  job em `frontend/src/components/JobsPanel.tsx`, lendo de `/api/jobs`.
- Isso importa muito para o requisito de "última execução visível no front": **não
  precisamos inventar nada novo** para isso — basta registrar a sincronização como
  mais um job e o painel existente já mostra status/hora/erro automaticamente.

---

## 1. Visão geral da arquitetura proposta

```
Otodata API
    │
    ▼
fetch único de devices (por ciclo de sincronização)
    │
    ├──► Supabase (Postgres)   — tabela "current state" + tabela de histórico leve
    │
    └──► Google Sheets          — aba "snapshot atual" (sobrescrita) + aba "histórico diário" (append)
```

Dois novos jobs (mesmo padrão do `relatorio-diario` já existente), **independentes**
do envio de WhatsApp:

- `sincronizacao-supabase`
- `sincronizacao-planilha`

Por que **não** acoplar ao job `relatorio-diario` existente: se o WhatsApp cair ou o
Supabase/Sheets estiver fora do ar, um não pode travar o outro. Isso já é garantido
hoje pelo isolamento de erro em `executeJob()` — cada job registrado roda e falha de
forma independente. Manter jobs separados preserva essa garantia.

Considerar (ver seção 6, "decisão em aberto") se os dois sinks (Supabase + Sheets)
devem virar **um único job** `sincronizacao-dados` que busca a Otodata **uma vez** e
grava nos dois destinos, para não duplicar a chamada externa à API Otodata a cada
ciclo — a API já é consultada 1x/dia pelo relatório; adicionar mais consultas
redundantes aumenta risco de rate-limit.

---

## 2. Supabase

### 2.1 Por que Supabase aqui (e não só SQLite local)
- SQLite local vive dentro de `C:\app\storage` no Windows Server — ótimo para o app,
  mas isolado: ninguém fora do servidor consegue consultar os dados sem passar pela
  API do backend.
- Supabase dá um Postgres gerenciado com acesso via API/SQL de qualquer lugar,
  útil para BI, dashboards externos, ou terceiros que só precisam ler dados.

### 2.2 Modelagem de dados (evitar tabela infinita)
Gravar um snapshot completo de ~1012 tanques a cada ciclo, se for muito frequente,
cresce rápido (1012 linhas × ciclos/dia). Padrão recomendado (estado atual +
histórico leve, evita a tabela de histórico virar gigante sem necessidade):

- **`tank_current_readings`** (estado atual, 1 linha por tanque, `UPSERT` por
  `otodata_device_id` a cada ciclo): reflete a última leitura conhecida de cada
  tanque. É a tabela que qualquer dashboard/BI externo vai consultar na prática.
- **`tank_reading_events`** (somente `INSERT`, cresce ao longo do tempo): 1 linha
  por tanque **apenas quando o `Status` muda** em relação à leitura anterior (ex.:
  saiu de `OK` para `CRITICAL LOW ALARM`), ou como fallback 1 snapshot completo por
  dia. Isso dá histórico/auditoria sem gravar milhares de linhas redundantes a cada
  ciclo.

Campos por linha (mapeados de `OtodataDevice`, ver `backend/src/services/otodata/client.ts`):
`otodata_device_id`, `name`, `city`, `region`, `product`, `status`, `last_level`,
`inventory`, `capacity`, `hours_to_empty`, `last_fill`, `last_read`,
`battery_alarm`, `signal_strength`, `tank_name`, `tank_number`, `synced_at`.

### 2.3 Segurança / chaves
- Backend usa a **service role key** (nunca a `anon key`) — ela ignora RLS e só deve
  existir no servidor, nunca no bundle do frontend.
- Mesmo assim, habilitar RLS nas tabelas (boa prática defensiva: se a service key
  vazar ela ainda ignora RLS, mas protege contra uso acidental da anon key).
- O frontend **não fala direto com o Supabase** — continua passando pelo backend,
  igual ao resto do projeto hoje (`/api/reports`, `/api/jobs`, etc.). Se no futuro
  quisermos leitura direta do dashboard, aí sim usar a `anon key` + RLS restritiva
  (read-only). Não é necessário agora.

### 2.4 Onde entra no código (sem escrever ainda, só localização)
- `backend/src/services/supabase/client.ts` — singleton `createClient`, mesmo
  padrão de `getOtodataClient()` em `backend/src/services/otodata/index.ts`.
- `backend/src/services/supabase/syncDevices.ts` — transforma `OtodataDevice[]` em
  linhas e faz upsert em lote (lotes de ~500 registros por chamada — evita payload
  gigante numa única requisição PostgREST).
- Novo job em `backend/src/jobs/definitions.ts`, reaproveitando `runDailyReport`
  como referência de formato (`{ id, name, cronExpression, run }`).
- Migração de schema do Supabase é **separada** da migração local
  (`runMigrations` em `backend/src/database/index.ts` continua só cuidando do
  SQLite). Guardar o SQL das tabelas Supabase em `supabase/migrations/` no repo
  (convenção do Supabase CLI), aplicado via CLI/dashboard — não pelo `node:sqlite`.

### 2.5 Variáveis de ambiente novas
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — seguem o padrão do `.env.example`
atual (adicionar lá, preencher só no `.env` real e em `C:\app\.env` na próxima
implantação, nunca commitar).

---

## 3. Google Sheets

### 3.1 Autenticação
Service Account (JSON key), não OAuth2 de usuário — é automação server-to-server
sem humano no loop, mesmo raciocínio de confiança do service role key do Supabase.
Passos: criar Service Account no Google Cloud Console, baixar a chave JSON,
compartilhar a planilha de destino com o e-mail da service account
(`...@...iam.gserviceaccount.com`) como Editor.

### 3.2 Estrutura da planilha (evitar estourar quota/linhas)
- Aba **"Snapshot Atual"**: sobrescrita completa a cada ciclo via
  `spreadsheets.values.update` num range fixo (ex.: `Snapshot!A2:P1013`) — mesmas
  colunas da tabela `tank_current_readings`. Isso equivale ao estado atual, sempre
  1013 linhas (cabeçalho + 1012 tanques), sem crescimento.
- Aba **"Histórico Diário"**: `append` de **1 linha por dia** com os contadores
  agregados (mesmos totais que já aparecem no `📈 RESUMO GERAL` do relatório de
  WhatsApp — ver `backend/src/services/reports/dailyReport.ts`): total de tanques,
  críticos, baixos, altos, falha de comunicação, abastecimentos, normais. Cresce
  ~365 linhas/ano — inofensivo para os limites do Sheets (~10M células por planilha).
- **Não** fazer append de 1 linha por tanque por ciclo — 1012 linhas × N ciclos/dia
  estoura rápido e não traz benefício sobre o que já existe no Supabase.

### 3.3 Quota e forma de chamada
Limite documentado: 60 requisições de escrita por minuto por usuário. Rodando no
máximo de hora em hora, está longe do limite. Ainda assim, usar **uma chamada por
sincronização** (`values.update` ou `spreadsheets.batchUpdate` para múltiplos
ranges de uma vez), nunca uma chamada por linha/tanque.

### 3.4 Onde entra no código
- `backend/src/services/googleSheets/client.ts` — `google.auth.GoogleAuth` +
  `sheets({version: "v4", auth})`.
- `backend/src/services/googleSheets/syncDevices.ts` — monta a matriz de valores a
  partir de `OtodataDevice[]` e chama update/batchUpdate.
- Mesmo job (`sincronizacao-planilha` ou combinado, ver seção 6).

### 3.5 Segredos e armazenamento da chave
A chave JSON da service account é um segredo persistente, mesmo raciocínio que a
sessão do WhatsApp hoje (`storage/whatsapp/auth`): guardar em
`storage/google/service-account.json`, fora do diretório versionado
(`C:\app\current` → `releases/<versão>`), no `.gitignore`, incluída no backup já
existente (`scripts/backup.ps1`). Caminho resolvido pelo mesmo padrão
`resolveFromRoot` que já existe em `backend/src/config/env.ts`. Variável nova:
`GOOGLE_APPLICATION_CREDENTIALS` (ou `GOOGLE_SHEETS_SPREADSHEET_ID` +
`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` direto no
`.env`, se preferir não ter um arquivo JSON separado — ver decisão em aberto).

---

## 4. "Última execução" visível no frontend

Não precisa de tela nova nem endpoint novo para o mínimo pedido: ao registrar
`sincronizacao-supabase` (e/ou `sincronizacao-planilha`) em
`backend/src/jobs/definitions.ts` do mesmo jeito que `relatorio-diario`, o
`JobsPanel.tsx` já existente automaticamente ganha uma linha na tabela mostrando
nome, status, próxima execução, última execução (data + status) e último erro —
porque ele já itera `jobs` vindo de `/api/jobs` de forma genérica, sem hardcode de
nomes de job.

Fase opcional (não bloqueia o pedido original): um card dedicado
"Última sincronização com Supabase" no `DashboardPanel.tsx`, com contagem de linhas
gravadas — exigiria um pequeno campo extra no resultado do job (hoje
`jobRunsRepository` só guarda status/erro/duração, não uma métrica customizada tipo
"1012 linhas sincronizadas"). Se quiser esse detalhe, precisamos decidir se vale
estender o schema de `job_runs` com uma coluna `detail`/`metadata`, ou logar isso
separadamente. Fica marcado como decisão em aberto (seção 6).

---

## 5. Resiliência e testes

- Otodata, Supabase e Google Sheets são três serviços externos independentes — cada
  chamada precisa de try/catch próprio com 2–3 retries e backoff exponencial em
  erros transitórios (429/5xx), no mesmo espírito do fallback primário/secundário
  já implementado em `backend/src/services/otodata/client.ts`.
- Testes unitários (`node:test`, mesmo padrão de `dailyReport.test.ts`) para as
  funções puras de transformação: `OtodataDevice[] → linhas Supabase` e
  `OtodataDevice[] → matriz de valores do Sheets` — sem precisar de rede.
- Teste manual real: projeto Supabase de teste + planilha de teste, disparar o job
  manualmente via `/api/jobs/:id/run` (endpoint que já existe) e conferir os dados
  gravados — mesma validação ponta a ponta já usada para o teste real do WhatsApp
  nesta sessão.

---

## 6. Decisões em aberto (para alinhar antes de começar a implementar)

1. **Cadência**: sincronizar 1x/dia (junto do horário do relatório) ou de hora em
   hora (dado mais fresco no Supabase/Sheets, custo extra de chamadas à Otodata)?
2. **Um job combinado ou dois separados** para Supabase e Sheets? Combinado evita
   consultar a Otodata duas vezes por ciclo; separado dá "última execução"
   independente por destino (ex.: Sheets caiu mas Supabase seguiu ok).
3. **Estrutura da chave do Google**: arquivo JSON em `storage/google/` vs. variáveis
   de ambiente soltas no `.env` (mais simples de configurar, mas chave privada
   multilinha em `.env` é mais chato de escapar corretamente).
4. **Projeto Supabase**: criar um novo projeto dedicado, ou já existe algum projeto
   Supabase do usuário para reaproveitar?
5. **Métrica de "linhas sincronizadas" no painel**: vale estender `job_runs` com
   um campo de detalhe, ou o status/erro genérico já é suficiente por enquanto?

---

## 7. Ordem de implementação sugerida

1. Supabase: schema (`tank_current_readings` + `tank_reading_events`) + serviço de
   sync + job registrado + testes unitários — validar via disparo manual do job e
   inspeção no dashboard do Supabase.
2. Nada de frontend extra necessário aqui — `JobsPanel.tsx` já mostra a última
   execução assim que o job existe (item 4 resolvido de graça).
3. Google Sheets: serviço de sync (aba snapshot + aba histórico) + job registrado
   (mesmo job do passo 1 ou separado, conforme decisão 2) + testes — validar abrindo
   a planilha real.
4. (Opcional/futuro) Endpoint de leitura no backend para o dashboard consultar os
   dados sincronizados no Supabase diretamente (gráficos, filtros históricos) — não
   é necessário para o pedido atual, fica como próximo passo natural.
