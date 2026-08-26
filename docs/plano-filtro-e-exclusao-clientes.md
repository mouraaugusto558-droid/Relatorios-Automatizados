# Plano — Filtro de envio por status/nível + exclusão de clientes por ID

> **Implementado em 2026-08-26** — ver `docs/como-o-sistema-funciona.md`
> (seções 6.1 e 6.2) para como as duas features funcionam hoje. A exclusão
> acabou ficando numa **aba nova e dedicada** ("Excluir Clientes"), não
> dentro da aba Planilha como rascunhado originalmente na seção 2 abaixo —
> mudança pedida pelo usuário depois deste rascunho. O resto das decisões de
> design abaixo (ID como identificador, reversibilidade, persistência no
> banco) foi seguido como estava.

Documento de planejamento original (registro das ideias discutidas em
`2026-08-25`), mantido como histórico do raciocínio por trás das decisões de
design.

Pedido original do cliente (mensagem repassada pelo usuário):

> A ideia era adicionar um filtro pra enviar clientes de acordo com os
> "status" e o "nível" (ambas variáveis encontradas na API). Exemplo: Enviar
> clientes com os filtros (ao mesmo tempo): status = "nível alto" e Nível
> acima de "90".

Depois o usuário pediu pra deixar esse filtro **mais abrangente** (não travado
só em status+nível) e trouxe uma segunda ideia: excluir clientes específicos
do relatório permanentemente, via ID, com o fluxo de exclusão vivendo dentro
da aba **Planilha** (a que já busca os dados em tempo real da Otodata).

---

## 1. Filtro de envio (status + nível, ampliado)

Viável sem integração nova — `Status` e `LastLevel` já vêm prontos em cada
device da API Otodata e já são usados hoje em
`backend/src/services/reports/deviceSelectors.ts` (`STATUS_META`,
`formatLevel`). O exemplo do cliente (`status = "Nível alto"` E `nível > 90`)
não é redundante: o `Status` é a classificação que a própria Otodata calcula
com o critério interno dela (pode marcar "HIGH ALARM" bem antes de 90%), então
"E" combinado com um limite numérico nosso é um filtro mais rígido que os dois
critérios separados.

**Ampliar o filtro** além do pedido original, já que os campos existem de
graça no mesmo objeto `OtodataDevice`:

- `Status` — multi-select com os labels de `STATUS_META` (Nível alto, Nível
  baixo, Tanque vazio, Abastecimento detectado, Falha de comunicação, etc.),
  não só um valor único.
- `LastLevel` — faixa min/max (não só "acima de X").
- `City` / `Region` — filtro geográfico, útil pra rotas.
- `Product` — caso o cliente tenha mais de um tipo de produto monitorado.
- Busca livre por `Name` — pra achar um cliente específico rápido.

Endpoints planejados (ver conversa anterior, resumo):
`GET /api/devices` (lista crua, hoje só existe a versão já agregada em
`/api/reports/spreadsheet`) + `POST /api/reports/send-filtered` (recebe os
critérios, filtra, gera e envia só pro subconjunto).

## 2. Exclusão de clientes por ID — via aba Planilha

### Por que ID e não nome

Cada device tem `Id: number` estável vindo da própria Otodata — é o
identificador oficial (o próprio código já usa `Tanque #${device.Id}` como
fallback de nome). Nome pode duplicar, ter acento/erro de digitação vindo da
API; ID não. **Confirmado com dado real de produção em 2026-08-25**: puxei os
1012 devices reais da API e o campo `Id` é numérico e único por device (ex.:
`27084378`, `27086941`).

### Onde a ideia do usuário resolve um buraco real do código

Hoje o `Id` do device **não chega no frontend** — `SpreadsheetRow` (backend,
`backend/src/services/reports/spreadsheetView.ts:12-16`) só carrega
`cells: string[]` e `color`, sem o `Id` do device que gerou aquela linha.
`SpreadsheetPanel.tsx` (frontend) só sabe renderizar essas células soltas —
não tem como saber "essa linha é o device tal" pra oferecer um botão de
excluir. A ideia do usuário fecha esse buraco:

1. **Adicionar `deviceId: number` em `SpreadsheetRow`**, populado em
   `buildAlarmsSpreadsheet`/`buildFillsSpreadsheet` (já têm o `device.Id` em
   mãos no map, é só carregar no objeto).
2. **Coluna "ID" na tabela da Planilha** (`SpreadsheetPanel.tsx`), com um
   botão de copiar ao lado de cada ID.
3. **Campo de exclusão**: um input onde o usuário cola o ID (ou vários) e
   confirma — aquele device passa a ser ignorado em qualquer geração de
   relatório futura, até ser restaurado.

### Boas práticas levantadas pra esse fluxo

- **Reaproveitar o padrão de copiar que já existe no projeto** — o
  `DashboardPanel.tsx` (`copyErrorMessage`, linhas 104-109) já implementa
  copiar-para-área-de-transferência com `navigator.clipboard.writeText` +
  ícone que vira `Check` por ~2.5s + toast de confirmação. Não inventar um
  segundo padrão — extrair isso pra um hook/componente pequeno reutilizável
  (`useCopyToClipboard` ou um `<CopyButton value={...} />`) usado tanto no
  Dashboard quanto na nova coluna da Planilha.
- **Validar o ID colado contra a lista de devices carregada na hora**, antes
  de confirmar a exclusão — mostrar o nome/cidade do tanque como prévia
  ("Excluir: Restaurante Sabor Norte — Ananindeua?") em vez de aceitar
  qualquer número cego. Evita excluir o cliente errado por erro de
  digitação/cópia.
- **Aceitar colar vários IDs de uma vez** (separados por vírgula, espaço ou
  quebra de linha) — é comum copiar uma lista inteira de uma planilha externa
  de uma vez só; obrigar um-por-um é fricção desnecessária.
- **Exclusão é reversível e visível**: manter uma lista separada "Clientes
  excluídos" (nome + cidade + data da exclusão, guardados como retrato no
  banco) com botão "Restaurar" por item — nunca deletar em definitivo sem essa
  lista, já que é fácil clicar errado.
- **Persistir no banco, não no localStorage** — a exclusão precisa valer pro
  job `relatorio-diario` das 08:00 rodando sozinho no servidor, não só
  enquanto alguém está com a aba aberta no navegador. Mesma tabela
  `excluded_devices` já desenhada na conversa anterior
  (`device_id INTEGER PRIMARY KEY, name TEXT, city TEXT, excluded_at TEXT`).
- **Acessibilidade do botão de copiar**: `aria-label` descrevendo a ação
  ("Copiar ID do tanque"), estado de foco visível (`:focus-visible`, já é
  padrão no `.btn-icon` do `index.css`), e o feedback de sucesso não pode
  depender só de cor (usar o ícone `Check` + toast, como já é feito).

### Onde aplicar o filtro de exclusão

Mesmo ponto já identificado antes: em `runDailyReport()`
(`backend/src/services/reports/index.ts:36`), logo depois de
`getOtodataClient().getDevices()`, filtrar fora qualquer device cujo `Id`
esteja em `excludedDevicesRepository.getExcludedIds()` — antes de
`buildDailyReportText`/`buildAlarmsSpreadsheet`/`buildFillsSpreadsheet`. Isso
cobre tanto o relatório automático das 08:00 quanto o envio filtrado da seção
1 (mesmo ponto de entrada, mesma lista de exclusão).

---

## 3. Nada disso está implementado ainda

Este documento é só o registro da ideia + decisões de design já discutidas.
Quando o usuário pedir pra implementar, o próximo passo é decidir qual das
duas entra primeiro (a exclusão sozinha já resolve metade do pedido do
cliente e é mais simples; o filtro de envio ad-hoc pode vir depois reusando a
mesma infraestrutura de exclusão).
