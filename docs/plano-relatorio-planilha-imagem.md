# Plano — Relatório em formato de planilha (HTML) + imagem tipo "print"

Documento de planejamento (sem código). Objetivo: em vez de sincronizar os dados
dos tanques com Supabase e Google Sheets (ver `docs/plano-integracao-supabase-planilha.md`),
montar o relatório em **HTML no visual de planilha** (estilo Excel/Google Sheets:
cabeçalho, linhas zebradas, bordas, células coloridas por status) e gerar a partir
dele uma **imagem (PNG)**, para ser enviada pelo WhatsApp como print da planilha —
em vez do texto corrido que `buildDailyReportText` gera hoje.

Baseado no estado real do projeto em `2026-08-23`.

---

## 1. Contexto que muda a decisão técnica

Este projeto roda em produção numa **Windows Server 2012 R2, 2 vCPU, 2 GB RAM**,
sem Docker, com prioridade explícita "Compatibilidade > Estabilidade > Baixo
consumo > Simplicidade > Novidade" (ver `Kickoff — Sistema Node.js + React +
Baileys...md`, seção 20). Isso restringe bastante *como* podemos ir de
"HTML" → "imagem", porque a forma mais óbvia (abrir o HTML num navegador headless
e tirar print) é justamente a mais pesada e a mais arriscada nesse ambiente.

Pesquisei as opções antes de propor o caminho — resumo abaixo.

## 2. Por que **não** Puppeteer/Playwright (headless Chrome) na VPS

Essa seria a abordagem "óbvia" (renderizar o HTML de verdade num Chromium e tirar
screenshot — literalmente o "print do HTML" que a ideia original sugere). Descartada
para rodar **na VPS em produção** por dois motivos concretos:

1. **Incompatibilidade confirmada com Windows Server 2012 R2**: builds recentes do
   Chrome for Testing/Chromium (o que Puppeteer e Playwright baixam por padrão) não
   iniciam nesse SO — há relato documentado de Puppeteer + Chrome for Testing
   115.0.5790.102 falhando no Server 2012 R2 (mesma versão funcionando normalmente
   no Server 2016), num issue aberto no repositório oficial
   `GoogleChromeLabs/chrome-for-testing`. O Chromium moderno assume APIs de
   Windows 10+.
2. **Custo de memória incompatível com 2 GB de RAM total**: um processo Chromium
   headless soma facilmente 200–500 MB, na mesma máquina que já roda Node, a sessão
   Baileys/WhatsApp, SQLite e o scheduler. Além disso o instalador do Puppeteer
   baixa ~280 MB de Chromium para Windows só para existir no disco.

Conclusão: Puppeteer/Playwright podem continuar úteis **só como ferramenta de
desenvolvimento no Windows 11** (ex.: gerar uma prévia manual localmente), mas
**não podem ser o motor de geração de imagem que roda todo dia às 08:00 na VPS.**

## 3. Abordagem recomendada: separar "ver como planilha" de "gerar imagem"

Ideia central: não existe uma dependência real entre "ter um HTML" e "tirar um
print dele" — são dois problemas diferentes, e cada um tem uma solução mais leve
quando resolvido separadamente:

```
                         devices: OtodataDevice[]  (já vem da Otodata, já usado
                                     │                pelo relatório de hoje)
                                     │
                    (mesmas funções de filtro/ordenação
                     que dailyReport.ts já tem: alarmes,
                     abastecimentos, severidade)
                                     │
              ┌──────────────────────┴───────────────────────┐
              ▼                                               ▼
   HTML real (<table>) ──► frontend (nova aba/visão      Canvas 2D (desenhado
   servido pelo backend    "Planilha"), aberto no          programaticamente,
   ou gerado junto do      navegador via RDP; também       mesma paleta/colunas)
   .txt do relatório       serve para exportar CSV          │
                                                             ▼
                                                    imagem PNG (buffer)
                                                             │
                                                             ▼
                                              WhatsApp: sendImage(jid, buffer, caption)
                                              (método já existe, ver seção 5)
```

- O **HTML** resolve "ver a planilha" — vive no navegador (dashboard, via RDP,
  seguindo a regra de acesso do projeto), pode ser filtrado/ordenado/copiado, e o
  usuário pode inclusive usar `Ctrl+P → Salvar como PDF` do próprio navegador se
  quiser um PDF de vez em quando — sem precisar de nenhuma lib nova pra isso.
- A **imagem** que vai pro WhatsApp não precisa ser literalmente "o HTML
  fotografado" — precisa **parecer** uma planilha. Gerar essa imagem desenhando
  diretamente (grade, cabeçalho, cores) com uma lib de canvas é mais leve, mais
  previsível e roda sem navegador nenhum.

### 3.1 Lib recomendada para desenhar a imagem: `@napi-rs/canvas`

| Critério | `@napi-rs/canvas` | Puppeteer/Playwright | `wkhtmltoimage` | Satori + resvg |
|---|---|---|---|---|
| Precisa de navegador/processo externo | Não | Sim (Chromium) | Sim (binário WebKit à parte) | Não |
| Binário pré-compilado p/ Windows x64 | Sim (`@napi-rs/canvas-win32-x64-msvc`, via N-API, 0 deps de sistema) | Sim, mas exige Chromium moderno | Sim, mas projeto **abandonado** (repo arquivado em jan/2023, sem mais atualizações/patches de segurança) | Sim (WASM) |
| Compatível com Windows Server 2012 R2 | Alta (só precisa do runtime VC++ redistributável, muito mais tolerante que exigir Windows 10+) | Confirmado incompatível em builds recentes (seção 2) | Provavelmente sim (tecnologia antiga), mas sem suporte/manutenção | Não testado especificamente, mas leve o suficiente |
| Controle sobre grade/bordas/cores de "planilha" | Total (API Canvas 2D: `fillRect`, `strokeRect`, `fillText`, `textAlign`...) | Total (é HTML/CSS de verdade) | Bom, mas CSS antigo (equivalente a WebKit ~2015) | Parcial — sem `<table>`, precisa simular grade com `flexbox` |
| Uso de memória típico | Baixo (processo nativo leve, sem DOM/layout engine) | Alto | Médio | Baixo |
| Já existe dependência parecida no projeto | `jimp` já está no `backend/package.json` mas não é usado em lugar nenhum do `src` hoje — dá pra ver como candidato a sair caso `@napi-rs/canvas` entre, ou manter só para pós-processamento (ex.: adicionar um logo) | — | — | — |

`@napi-rs/canvas` vence por ser a única opção que é **ao mesmo tempo** leve,
sem processo externo, com binário Windows pronto (sem exigir Visual Studio Build
Tools na VPS, ao contrário do `node-canvas` clássico baseado em `node-gyp` +
Cairo) e com controle total sobre o desenho — exatamente o que uma grade de
planilha precisa (linhas, colunas, texto alinhado, células com cor de fundo por
status).

## 4. Dados: nada novo para buscar

A imagem/planilha usa **o mesmo `OtodataDevice[]`** que `runDailyReport` já busca
via `getOtodataClient().getDevices()` — nenhuma chamada extra à API da Otodata.
Reaproveitar também a lógica já pronta em `backend/src/services/reports/dailyReport.ts`:

- `ALARM_STATUSES` + `sortBySeverity` → linhas da seção "alarmes".
- Filtro `Status === "FILL DETECTION"` → linhas da seção "abastecimentos".
- `STATUS_META` (emoji, label, severidade) → cor de fundo da célula de status na
  planilha (ex.: vermelho para `CRITICAL LOW ALARM`, laranja para `LOW ALARM`,
  cinza para `COMM TROUBLE`), no lugar do emoji.

Colunas sugeridas por linha (todas já existem em `OtodataDevice`, ver
`backend/src/services/otodata/client.ts`): Tanque/Cliente (`Name` + `TankName`),
Cidade (`City`), Status (badge colorido, de `Status`), Nível % (`LastLevel`),
Estoque (`Inventory`), Capacidade (`Capacity`), Horas até vazio
(`HoursToEmpty`), Última leitura (`LastRead`), Último abastecimento (`LastFill`),
Sinal (`SignalStrength`), Bateria fraca (`BatteryAlarm`).

### 4.1 Importante: **não** renderizar os ~1012 tanques numa imagem só

O relatório de texto de hoje já não lista os 1012 tanques — só os que importam
(68 alarmes + 8 abastecimentos no exemplo real de `storage/reports/relatorio-diario-2026-08-22T18-49-15-853Z.txt`).
A imagem deve seguir a mesma regra: uma planilha com 1012 linhas vira uma imagem
gigante e ilegível em qualquer zoom de celular. Gerar imagem só para os
subconjuntos relevantes (alarmes, abastecimentos), e deixar a listagem completa
dos 1012 tanques só na visão HTML do dashboard (com paginação/scroll, que o
navegador resolve de graça) e, se quiser, um botão "exportar CSV" ali — não como
imagem.

Se a lista de alarmes um dia crescer muito (ex.: > 40–50 linhas), definir um
limite de linhas por imagem e paginar em várias imagens (`1/2`, `2/2`) em vez de
espremer a fonte até ficar ilegível.

## 5. Onde entra no código (sem escrever ainda, só localização)

- `backend/src/services/reports/spreadsheetView.ts` (novo) — funções puras que
  recebem `OtodataDevice[]` e devolvem uma estrutura de linhas/colunas já
  filtrada e formatada (reaproveitando os helpers de `dailyReport.ts`; vale
  extrair os filtros de alarme/abastecimento para um módulo compartilhado em vez
  de duplicá-los).
- `backend/src/services/reports/renderSpreadsheetImage.ts` (novo) — recebe a
  estrutura de linhas/colunas e desenha com `@napi-rs/canvas`, devolve um
  `Buffer` PNG. Função pura o suficiente para testar sem rede (dado um array de
  linhas fixo, comparar dimensões/formato do buffer, não pixel a pixel).
- `backend/src/services/reports/index.ts` (`runDailyReport`) — depois de montar
  `reportText`, gerar também a imagem e enviar com
  `getWhatsAppManager().sendImage(jid, buffer, caption)` — **esse método já
  existe** na interface `WhatsAppManager` (`backend/src/services/whatsapp/whatsappManager.ts:26,176`),
  implementado mas hoje sem nenhum chamador no projeto. Ou seja, a parte de
  "como mandar imagem pelo WhatsApp" já está pronta — falta só gerar o buffer e
  chamar.
- `backend/src/routes/reports.ts` — endpoint novo opcional, ex.
  `GET /api/reports/:id/spreadsheet` devolvendo o HTML (ou o PNG) para o
  frontend exibir/baixar sob demanda, sem precisar reprocessar o `.txt`.
- `frontend/src/components/ReportsPanel.tsx` (ou uma nova aba "Planilha") —
  renderiza a mesma estrutura de linhas/colunas como uma `<table>` HTML real de
  verdade (não uma imagem embutida), com CSS próprio no estilo planilha
  (`frontend/src/index.css` ou um módulo CSS dedicado): cabeçalho fixo, zebra,
  células de status coloridas — reaproveitando visualmente as mesmas cores que
  a imagem PNG usa (ideal manter uma tabela de cores por status em **um só
  lugar**, ex. `frontend/src/utils/statusColors.ts` espelhando `STATUS_META`,
  para HTML e imagem não divergirem visualmente com o tempo).

## 6. Onde essa imagem é entregue

- **WhatsApp**: no lugar (ou além) do texto atual, `runDailyReport` passa a
  chamar `sendImage` com a planilha de alarmes como PNG e uma legenda curta
  (`caption`) com o resumo geral (contagens) — decisão em aberto se mantém o
  texto também, ver seção 8.
- **Dashboard**: nova aba/visão "Planilha" no frontend mostrando a tabela HTML
  ao vivo (dados de `/api/reports` ou de um novo endpoint), sem esperar o
  próximo relatório às 08:00 — pode inclusive ter um botão "gerar/atualizar
  agora" chamando o mesmo endpoint de rodar job manualmente que já existe
  (`/api/jobs/:id/run`, citado em `docs/plano-integracao-supabase-planilha.md`).

## 7. Memória e desempenho (VPS de 2 GB RAM)

- `@napi-rs/canvas` desenha em memória e descarta o canvas ao terminar — nenhum
  processo persistente fica rodando entre execuções (ao contrário de um
  navegador headless, que ficaria de pé consumindo RAM ou teria que ser
  iniciado/fechado a cada relatório, ambos ruins).
- Gerar a imagem só sob demanda: no job diário (uma vez ao dia) e, opcionalmente,
  quando alguém abrir a aba "Planilha" no dashboard (sob demanda, não em
  polling) — mesmo espírito de "evitar polling agressivo/processamento
  desnecessário" já registrado no Kickoff (seção 26).
- Não guardar a imagem gerada em memória entre requisições; se quiser cache em
  disco, salvar o PNG do dia em `storage/reports/` junto do `.txt` (mesmo padrão
  de armazenamento já usado, mesmo mecanismo de backup em `scripts/backup.ps1`).

## 8. Segurança / segredos

Vantagem direta desta abordagem sobre o plano de Supabase + Google Sheets: **zero
credenciais novas**. Não precisa de `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
Service Account do Google nem arquivo de chave JSON — tudo roda com os dados que
já estão em memória no processo do backend, sem nenhum serviço externo novo. Isso
também elimina a superfície de risco descrita na seção 2 do plano de Supabase
(chave vazando, RLS mal configurado, etc.) simplesmente por não existir mais
transporte de dados para fora do servidor.

## 9. Testes

- Testes unitários (`node:test`, mesmo padrão de `dailyReport.test.ts`) para
  `spreadsheetView.ts`: dado um array fixo de `OtodataDevice`, checar que a
  função devolve as linhas certas, na ordem certa, sem depender de rede nem de
  `@napi-rs/canvas`.
- Teste do `renderSpreadsheetImage.ts`: verificar que o buffer devolvido é um
  PNG válido (assinatura de bytes `89 50 4E 47...`) e tem as dimensões
  esperadas para N linhas — sem comparar pixel a pixel (frágil, quebra a cada
  ajuste visual).
- Teste manual ponta a ponta: rodar o job manualmente (`/api/jobs/:id/run`,
  já existe) e conferir a imagem recebida no WhatsApp de teste — mesma validação
  já usada para o teste real do relatório de texto.

## 10. Decisões em aberto (para alinhar antes de implementar)

1. **Enviar imagem no lugar do texto, ou os dois?** O texto atual é pesquisável/
   copiável no WhatsApp; a imagem é mais visual mas não dá pra copiar um nome de
   cliente dela. Pode mandar os dois (texto + imagem) sem grande custo extra.
2. **Uma imagem só (alarmes) ou duas (alarmes + abastecimentos separados)?**
3. **O plano de Supabase (`docs/plano-integracao-supabase-planilha.md`) fica
   totalmente descartado, ou só a parte de Google Sheets sai (porque a planilha
   HTML/imagem já cobre a necessidade visual) e o Supabase continua de pé para
   quem precisar consultar os dados via SQL/BI externo?**
4. **Limite de linhas por imagem** antes de paginar em várias (sugestão inicial:
   40–50 linhas por imagem, ajustável depois de ver o resultado real).
5. **Remover a dependência `jimp`** do `backend/package.json` (hoje instalada e
   não usada em nenhum arquivo de `src`) ou mantê-la para eventual
   pós-processamento da imagem (logo, marca d'água)?
6. **Fonte usada no canvas**: `@napi-rs/canvas` permite registrar fontes TTF
   customizadas (`GlobalFonts.registerFromPath`) para a imagem ficar com a
   mesma tipografia do dashboard, ou usa-se a fonte padrão do sistema (mais
   simples, zero arquivo extra pra versionar)?

## 11. Ordem de implementação sugerida

1. Extrair os filtros/ordenação de alarme e abastecimento de `dailyReport.ts`
   para um módulo compartilhado (reaproveitado tanto pelo texto quanto pela
   planilha) — pequeno refactor, sem mudar comportamento do relatório atual.
2. Criar `spreadsheetView.ts` (linhas/colunas) + testes unitários.
3. Adicionar `@napi-rs/canvas` como dependência de produção, criar
   `renderSpreadsheetImage.ts` + testes de formato do buffer.
4. Ligar ao `runDailyReport`: gerar o PNG e chamar `sendImage` (método já
   existente) — validar manualmente via disparo do job e conferência no
   WhatsApp de teste.
5. Frontend: nova visão "Planilha" com `<table>` HTML real, reaproveitando as
   mesmas cores de status (extraídas para um módulo único, ver seção 5).
6. (Opcional) Endpoint de exportação CSV da listagem completa dos 1012 tanques,
   a partir do HTML da visão "Planilha" — não da imagem.
