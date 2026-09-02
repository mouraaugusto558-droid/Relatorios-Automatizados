# Plano — log de eventos persistente

> Status: **planejado, não implementado**. Escrito em 2026-09-02, logo depois da
> investigação que levou o dia inteiro por falta exatamente disto.

## Por que

O problema não é falta de detalhe no log — é **retenção** e **ausência de rastro
do que dá certo**. Três fatos concretos, todos verificados em 2026-09-02:

1. **A Fly guarda ~15 minutos de log.** Às 15:00 a falha das 08:00 já era
   irrecuperável. A única forma de diagnosticar foi pedir para o usuário
   reproduzir enquanto um `fly logs` rodava ao vivo.
2. **O logger de serviço roda em nível `warn`** (`backend/src/utils/logger.ts`).
   Execução bem-sucedida não deixa rastro: é impossível distinguir "o job de
   alertas rodou e não havia nada para enviar" de "o job não rodou".
3. **Mudança de estado da conexão do WhatsApp não é gravada em lugar nenhum.**
   O `stream:error 401 / conflict device_removed` das 15:48 — a causa raiz do
   dia — só apareceu porque havia um tail aberto no segundo exato.

O SQLite já vive em `/data` (volume `app_data`, 1 GB, hoje quase vazio) e
sobrevive a deploy. É o lugar certo para isso.

## Schema

Em `backend/src/database/index.ts`, dentro de `runMigrations`:

```sql
CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  level TEXT NOT NULL,      -- 'info' | 'warn' | 'error'
  source TEXT NOT NULL,     -- 'whatsapp' | 'job' | 'send' | 'otodata'
  message TEXT NOT NULL,
  detail TEXT               -- JSON opcional (msgId, jid, statusCode, duração...)
);
CREATE INDEX IF NOT EXISTS idx_event_log_at ON event_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_source ON event_log (source, at DESC);
```

Gravar `at` com `strftime('%Y-%m-%dT%H:%M:%fZ','now')`, nunca `datetime('now')` —
o segundo grava UTC sem sufixo e o navegador interpreta como hora local. Já
existe migração corrigindo esse erro em `reports`/`job_runs`; não repetir.

## Retenção

Sem limpeza, o `send` sozinho gera ~1.100 linhas/dia. Podar no boot e uma vez por
dia: `DELETE FROM event_log WHERE at < <hoje - 30 dias>`, e um teto duro por
contagem (ex.: 50 mil linhas, apagando as mais antigas) para o caso de um loop de
erro inundar a tabela. Rodar `PRAGMA wal_checkpoint(TRUNCATE)` depois da poda.

## O que instrumentar

Escolhido pelo que realmente quebrou, não genericamente. Ordem de prioridade:

1. **Conexão do WhatsApp** — `backend/src/services/whatsapp/whatsappManager.ts`,
   dentro do handler de `connection.update` e no `dropDeadSocket`. Gravar toda
   transição (`connecting`/`qr`/`connected`/`disconnected`), com `statusCode` do
   `lastDisconnect` e o motivo (`loggedOut`, `device_removed`, `restartRequired`).
   **É o item mais importante da lista** — teria transformado a investigação de
   hoje em uma consulta de 30 segundos.
2. **Cada envio** — no `sendWithAck`. Gravar destino (jid), tipo (texto/imagem/
   documento), `msgId`, e o desfecho: ACK recebido (com a latência) ou timeout.
3. **Cada execução de job** — `backend/src/jobs/scheduler.ts`, no `executeJob`.
   Início, fim, duração, erro, e se foi disparo agendado ou manual. Inclui o caso
   "rodou e não havia nada para enviar", que hoje é silencioso.
4. **Otodata** — `backend/src/services/reports/monitoredScope.ts`. Falha de
   consulta e queda para o cache local (hoje isso é um `console.warn` solto).

Criar `backend/src/services/eventLog/` com um `logEvent(level, source, message,
detail?)` que **nunca lança** — um erro ao gravar log não pode derrubar um envio.
Envolver em try/catch e, no pior caso, cair para o logger do pino.

## API

`GET /api/logs` (autenticada, como as demais), com query params:
`level`, `source`, `q` (busca no `message`), `limit` (padrão 100, teto 1000) e
`cursor`/`before` para paginação por `id`. Rota em `backend/src/routes/logs.ts`,
registrada no `server.ts`.

## Frontend

Aba nova **Logs** em `frontend/src/App.tsx` (o padrão de abas é um `activeTab`
com render condicional — seguir o mesmo). Componente `LogsPanel.tsx` com:

- filtro por nível e por origem, campo de busca, e "carregar mais";
- linha expansível mostrando o JSON de `detail`;
- botão de copiar (já existe `useCopyToClipboard`);
- auto-refresh só quando a aba está aberta, para não competir com o polling
  que o painel já faz.

Reusar `useSearchAndFilter`, que já resolve busca + filtro nas outras abas.

## Testes

Seguir o padrão `node:test` + `createInMemoryDatabase`:

- repositório: insere, lista com filtro por nível/origem, pagina por cursor;
- poda: remove o que passou da janela e respeita o teto por contagem;
- `logEvent` engole erro de escrita sem propagar (o teste mais importante:
  garante que o log nunca derruba um envio);
- formato de `at`: termina em `Z`.

## Decisões já tomadas (não relitigar)

- **SQLite, não arquivo em disco nem serviço externo.** O banco já está no volume,
  já tem backup implícito junto do resto, e a consulta com filtro sai de graça.
- **Não subir o nível global do pino para `info`.** Resolveria pouco: a Fly
  continua descartando tudo em ~15 min. A tabela é que resolve.
- **Não adicionar serviço de observabilidade externo** (Datadog, Sentry, etc.).
  Uma máquina, um volume, um usuário — não justifica a dependência nem o custo.

## Melhoria relacionada, fora deste escopo

Avisar ativamente quando a sessão do WhatsApp cair, por um canal que não seja o
próprio WhatsApp que acabou de morrer. Hoje, se a sessão cair às 3h, ninguém sabe
até o relatório das 08:00 falhar. O log resolve o "descobrir o que houve"; não
resolve o "descobrir a tempo".
