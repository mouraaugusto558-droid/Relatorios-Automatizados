# Integrações arquivadas: Supabase + Google Sheets

Código movido pra cá em `2026-08-24`, quando o projeto decidiu abandonar a
sincronização com Supabase e Google Sheets em favor do relatório em HTML
estilo planilha + imagem PNG (ver
`docs/plano-execucao-planilha-easypanel-vercel-auth.md`). **Não é código
morto por engano** — foi removido de `backend/src` de propósito, pra:

- Não ser compilado (`tsconfig.json` só inclui `src`, então nada aqui entra
  em `dist/`).
- Não ser lintado (`npm run lint --workspace backend` roda `eslint --cache
  src`, só olha `src`).
- Não ser testado (`npm test --workspace backend` roda
  `tsx --test src/**/*.test.ts`, os `.test.ts` daqui não entram).
- Continuar existindo no histórico do git e no disco, caso um dia faça
  sentido reaproveitar (ex.: alguém pedir consulta via SQL/BI externo, ou
  voltar a usar Google Sheets por algum motivo específico).

## O que tem aqui

- `dataSync/index.ts` — `runDataSync()`, orquestrador que buscava os
  `OtodataDevice[]` e gravava nos dois destinos, cada um falhando de forma
  independente.
- `supabase/` — cliente Supabase (`client.ts`), mapeamento de
  `OtodataDevice` pras colunas da tabela (`mapDevice.ts` + teste), e
  `syncDevices.ts` (upsert em lote).
- `googleSheets/` — cliente Google Sheets via Service Account (`client.ts`),
  montagem das linhas da planilha (`buildRows.ts` + teste), e
  `syncDevices.ts` (grava os valores na aba configurada).

## Como reativar, se precisar

1. Mover as três pastas de volta para `backend/src/services/`.
2. Reinstalar as dependências (foram removidas do `package.json` em
   `2026-08-24`):
   ```
   npm install @supabase/supabase-js@^2.112.3 googleapis@^176.0.0 --workspace backend
   ```
3. Restaurar em `backend/src/config/env.ts` os campos removidos:
   `supabaseUrl`, `supabaseServiceRoleKey`, `googleSheetsSpreadsheetId`,
   `googleServiceAccountEmail`, `googleServiceAccountPrivateKey` (lidos de
   `process.env.SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — a chave privada precisa do
   `.replace(/\\n/g, "\n")`, ver histórico do git em `env.ts` antes de
   `2026-08-24` pro trecho exato).
4. Restaurar as mesmas variáveis em `.env.example` (ver histórico do git).
5. Em `backend/src/jobs/definitions.ts`, importar `runDataSync` de novo e
   voltar a entrada do job:
   ```ts
   {
     id: "sincronizacao-dados",
     name: "Sincronização Supabase + Planilha",
     cronExpression: "0 * * * *",
     run: runDataSync
   }
   ```
6. Preencher as variáveis reais no `.env` (URL/chave do Supabase e/ou
   ID da planilha + credenciais da Service Account do Google).

Tudo isso é reversível olhando o commit que fez essa remoção
(`git log --follow` num dos arquivos aqui dentro mostra o histórico
completo de antes da mudança).
