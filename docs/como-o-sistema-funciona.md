# Como o sistema funciona

Documento explicando, de forma simples, as principais peças do projeto: como o WhatsApp conecta, como o relatório diário é montado e enviado, e como o frontend mostra tudo isso.

## Visão geral em uma frase

Todo dia às 08:00, o backend busca os tanques na API da Otodata, monta um texto de relatório + duas imagens de planilha (alarmes e abastecimentos) e manda tudo pelo WhatsApp (via Baileys) para um número fixo configurado no `.env`; o frontend (atrás de login) é uma vitrine que consulta essas informações pela API do backend.

```
Otodata API ──► buildDailyReportText() ──► arquivo .txt salvo ──► WhatsApp (Baileys) ──► número configurado
      │                                           │                      ▲
      │                                           ▼                      │
      └──► buildAlarmsSpreadsheet()/buildFillsSpreadsheet()   SQLite (tabela reports)
                        │                                            │
                        ▼                                            ▼
           renderSpreadsheetImage() (PNG) ──────────────► sendImage()   Frontend (React, com login)
                                                                        exibe via /api/reports e /api/reports/spreadsheet
```

---

## 1. WhatsApp (conexão)

Arquivo: `backend/src/services/whatsapp/whatsappManager.ts`

- Quem faz a conexão de verdade é a lib **Baileys** (`@whiskeysockets/baileys`) — ela imita o WhatsApp Web, sem precisar de API paga do WhatsApp Business.
- Ao iniciar, o backend chama `connect()`. A biblioteca gera um **QR Code** que precisa ser escaneado uma vez pelo WhatsApp do celular (Aparelhos conectados → escanear).
- Depois de escaneado, as credenciais da sessão ficam salvas em disco (pasta `storage/whatsapp/auth`), então nas próximas vezes que o servidor ligar **não precisa escanear de novo**.
- Se a conexão cair (internet, WhatsApp reiniciou, etc.), ele tenta **reconectar sozinho** automaticamente, esperando um pouco mais a cada tentativa (1s, 2s, 4s... até 30s).
- Se a sessão for **desconectada pelo celular** (deslogado manualmente), as credenciais salvas são apagadas e um novo QR Code passa a ser exigido.
- O status da conexão pode ser: `disconnected`, `connecting`, `qr` (esperando leitura do QR) ou `connected`.

## 2. Lógica de geração do relatório diário

Arquivos: `backend/src/services/reports/dailyReport.ts` (monta o texto), `deviceSelectors.ts` (filtros/ordenação/cores compartilhados), `spreadsheetView.ts` (linhas/colunas paginadas), `renderSpreadsheetImage.ts` (desenha o PNG) e `index.ts` (orquestra tudo).

Passo a passo do job `relatorio-diario`:

1. Busca todos os tanques na API da Otodata (`getOtodataClient().getDevices()`).
2. Monta o texto do relatório (`buildDailyReportText`), separado em 3 blocos:
   - **🚨 Alarmes ativos** — tanques com algum problema (vazio, transbordando, nível baixo/alto, consumo anormal, falha de comunicação), ordenados do mais grave pro menos grave.
   - **⛽ Abastecimentos detectados** — tanques que foram reabastecidos recentemente.
   - **📈 Resumo geral** — contagem de quantos tanques estão em cada status.
3. Salva esse texto em um arquivo `.txt` dentro de `storage/reports/`, com nome tipo `relatorio-diario-2026-08-23T08-00-00-000Z.txt`.
4. Grava um registro na tabela `reports` do SQLite com status `generated`.
5. Tenta enviar o texto pelo WhatsApp para o número em `REPORT_RECIPIENT_NUMBER`.
   - Se enviar com sucesso → status vira `sent`.
   - Se falhar (WhatsApp desconectado, por exemplo) → status vira `error` e o erro é lançado (fica registrado no log do job).
6. Com o texto já enviado, monta as imagens de planilha (`buildAlarmsSpreadsheet`/`buildFillsSpreadsheet`, paginadas a cada 50 linhas) e envia cada página como imagem PNG (`renderSpreadsheetImage` + `sendImage`). Falha ao enviar uma imagem só gera um log de erro — não derruba o relatório, que já foi enviado no passo 5.

> Os "status" possíveis de um relatório na tela são: `pending`, `generated`, `sent`, `error`. Esse status reflete só o texto — o envio das imagens não é rastreado na tabela `reports`.

## 3. Como o relatório é enviado no WhatsApp

Arquivo: `backend/src/services/reports/index.ts`.

- O número de destino vem da variável `REPORT_RECIPIENT_NUMBER` no `.env` (formato só com DDI+DDD+número, sem símbolos).
- Esse número é transformado no formato que o WhatsApp usa internamente: `"5511999999999@s.whatsapp.net"`.
- O texto é enviado com `getWhatsAppManager().sendMessage(jid, textoDoRelatorio)`; as imagens da planilha com `getWhatsAppManager().sendImage(jid, buffer, legenda)` — ambos usam `socket.sendMessage()` do Baileys por baixo.
- Se o WhatsApp não estiver com status `connected` no momento do disparo, o envio falha na hora (`"WhatsApp não está conectado"`) — por isso é importante manter a sessão ativa.
- A imagem usa fonte padrão do sistema (sem TTF customizada) — por isso o título/cabeçalho da imagem não leva emoji (o glyph não existe nessa fonte e viraria uma caixa vazia); o texto do WhatsApp continua com os emojis normalmente.

## 4. Quando isso roda automaticamente

Arquivos: `backend/src/jobs/definitions.ts` e `backend/src/jobs/scheduler.ts`.

- O agendamento usa a lib **croner**, rodando **dentro do processo Node** (não é tarefa do Windows nem cron do sistema operacional).
- Jobs configurados:
  | Job | Quando roda | O que faz |
  |---|---|---|
  | `relatorio-diario` | todo dia às 08:00 | gera e envia o relatório diário |
  | `automacao-meio-dia` | todo dia às 12:00 | ainda não implementado |

  > O job `sincronizacao-dados` (Supabase/Google Sheets) existiu até
  > `2026-08-24` e foi removido — ver seção 5.
- **Importante:** isso só dispara se o processo do backend estiver rodando naquele horário. Se o servidor estiver desligado às 08:00, aquele disparo é perdido (não há "reprocessamento" automático depois).
- Pela tela de **Jobs**, dá pra ativar/desativar cada job e rodar manualmente (`Rodar agora`) sem esperar o horário programado.

## 5. Sincronização de dados (Supabase / Google Sheets) — removida em 2026-08-24

O sistema sincronizava os tanques da Otodata com Supabase e/ou Google Sheets a
cada hora (job `sincronizacao-dados`). Essa integração foi **removida** do
código ativo em `2026-08-24`, substituída pela ideia de gerar o relatório
como HTML estilo planilha + imagem PNG (ver
`docs/plano-execucao-planilha-easypanel-vercel-auth.md`).

O código não foi apagado — está preservado, fora do build/lint/testes, em
`backend/_archive/legacy-integrations/` (com um `README.md` explicando como
reativar, se um dia fizer sentido).

## 6. Como a página de Relatórios busca os dados

Arquivos: `backend/src/routes/reports.ts` (API) e `frontend/src/hooks/useReports.ts` + `frontend/src/components/ReportsPanel.tsx` (tela).

- O backend expõe uma rota simples: `GET /api/reports`, que devolve a lista de relatórios salva no SQLite (tabela `reports`).
- O frontend, ao abrir a aba "Relatórios", chama esse endpoint uma vez (`useReports`) e guarda a lista em estado do React.
- Na tela dá pra: buscar por nome/caminho do arquivo, filtrar por status, copiar o caminho do arquivo `.txt` gerado, e clicar em "Atualizar" pra buscar de novo (não tem atualização automática em tempo real — só quando o usuário clica ou entra na página).
- Cada linha mostra: nome do arquivo, data de criação, status (badge colorido) e o caminho completo onde o `.txt` ficou salvo em disco.

## 6.1 Aba "Planilha"

Arquivos: `backend/src/routes/reports.ts` (`GET /api/reports/spreadsheet`) e `frontend/src/hooks/useSpreadsheet.ts` + `frontend/src/components/SpreadsheetPanel.tsx`.

- Mostra em HTML (`<table>`) a mesma listagem que vira imagem no relatório diário — busca os tanques na Otodata **na hora** (não fica salva no banco) e monta as mesmas tabelas paginadas de `buildAlarmsSpreadsheet`/`buildFillsSpreadsheet`.
- Cada linha tem uma bolinha colorida (mesma cor usada na imagem do WhatsApp, vinda de `STATUS_META`) indicando a gravidade do status.
- Botão "Atualizar" refaz a consulta à Otodata (pode demorar alguns segundos — é a mesma API usada pelo relatório diário).

## 7. Autenticação (login e senha)

Arquivos: `backend/src/services/auth/`, `backend/src/routes/auth.ts`, `backend/src/server.ts` (hook global) e `frontend/src/context/AuthContext.tsx` + `frontend/src/components/LoginPage.tsx`.

- Login único (sem cadastro, sem "esqueci minha senha"): usuário e hash bcrypt da senha ficam em `AUTH_USERNAME`/`AUTH_PASSWORD_HASH` no `.env`. Para gerar o hash: `npm run generate-password-hash --workspace backend -- "sua-senha"`.
- `POST /api/auth/login` verifica as credenciais e, se corretas, seta um cookie `session` **httpOnly** com um JWT assinado por `AUTH_SESSION_SECRET` (validade de 12h). `POST /api/auth/logout` limpa o cookie. `GET /api/auth/me` diz se a sessão atual é válida — é o que o frontend chama ao abrir a página pra decidir entre mostrar `LoginPage` ou o painel.
- Um hook `onRequest` global (`server.ts`) bloqueia com `401` qualquer rota `/api/*` sem cookie válido, **exceto** `/api/health` e as três rotas de `/api/auth/*` (senão ninguém conseguiria logar).
- O frontend manda `credentials: "include"` em todo `fetch` (`api/client.ts`) e trata `401` de forma centralizada — qualquer chamada que devolva 401 joga o usuário de volta pra tela de login (`AuthContext` + `onUnauthorized`).
- O SSE de status do WhatsApp (`EventSource`) também precisa do cookie: é criado com `{ withCredentials: true }` em `useWhatsAppStatus.ts`, porque `EventSource` não deixa mandar headers customizados.
- Quando front e back ficam em domínios diferentes (Vercel + EasyPanel), o cookie precisa de `SameSite=None; Secure`, e o CORS do backend precisa de `credentials: true` com uma origem explícita em `CORS_ALLOWED_ORIGIN` (nunca `*`) — ver `backend/src/server.ts`. Em dev local (mesma origem), isso fica desligado por padrão.

## 8. Como o Dashboard (visão geral) é montado

Arquivo: `frontend/src/components/DashboardPanel.tsx`.

O Dashboard combina 4 fontes diferentes, cada uma com seu próprio hook:

| Fonte | Hook | Como atualiza |
|---|---|---|
| Status do WhatsApp | `useWhatsAppStatus` | **tempo real**, via `EventSource` (SSE) no endpoint `/api/whatsapp/events` — o backend empurra atualização toda vez que o status muda |
| Jobs & agendamentos | `useJobs` | busca `/api/jobs` |
| Relatórios | `useReports` | busca `/api/reports` |
| Saúde do servidor | `useHealth` | busca `/api/health` |

Com esses dados ele monta: cartão de status do WhatsApp, quantos jobs estão ativos/rodando, quantos relatórios foram enviados, uptime do servidor, e uma lista de "erros recentes" (jobs ou relatórios que falharam), com botão pra copiar a mensagem de erro.

## 9. Estrutura geral de pastas (resumo)

```
backend/src/
  config/env.ts          → lê o .env e aplica valores padrão
  jobs/                  → agendador (croner) + definição dos jobs
  services/
    auth/                  → checagem de credenciais + emissão/verificação do JWT de sessão
    whatsapp/             → conexão Baileys (QR, envio de mensagens/imagens)
    reports/               → texto, planilha (linhas/colunas), imagem PNG e orquestração do relatório diário
    otodata/                → cliente da API Otodata (busca os tanques)
  routes/                → endpoints Fastify (/api/health, /api/auth/*, /api/whatsapp/*, /api/jobs, /api/reports)
  database/               → SQLite (tabelas jobs, job_runs, reports)

frontend/src/
  components/             → telas (Login, Dashboard, WhatsApp, Jobs, Relatórios, Planilha)
  context/                → AuthContext (sessão), ThemeContext, ToastContext, AppDataContext
  hooks/                  → busca de dados de cada tela (fetch ou SSE)
```

## 10. Coisas que exigem atenção manual

- **QR Code do WhatsApp**: se a sessão cair e não reconectar (ex.: deslogado no celular), alguém precisa entrar na aba WhatsApp e escanear de novo.
- **Servidor sempre ligado**: o agendamento só funciona com o processo `node dist/server.js` rodando continuamente (ver seção 4). Em produção isso normalmente é resolvido com um serviço do Windows (NSSM) ou pelo próprio EasyPanel, não com o `npm run dev`.
- **Variáveis de ambiente**: sem `REPORT_RECIPIENT_NUMBER` preenchido, o job de relatório falha direto (erro lançado antes de buscar qualquer dado). Sem `AUTH_USERNAME`/`AUTH_PASSWORD_HASH`/`AUTH_SESSION_SECRET`, nenhuma rota de login funciona (erro lançado na primeira tentativa).
