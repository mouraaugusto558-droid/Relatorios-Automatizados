import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { SpreadsheetTable } from "./spreadsheetView";

const CANVAS_WIDTH = 900;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 40;
const TITLE_HEIGHT = 44;
const PADDING = 16;
// "DejaVu Sans" é instalada no container de produção (ver Dockerfile, pacote
// fonts-dejavu-core). O fallback genérico "sans-serif" cobre ambientes onde
// ela não existe (ex.: Windows/macOS em desenvolvimento local).
const FONT_FAMILY = "'DejaVu Sans', sans-serif";

const COLOR_TITLE_BG = "#1e293b";
const COLOR_TITLE_TEXT = "#f8fafc";
const COLOR_HEADER_BG = "#334155";
const COLOR_HEADER_TEXT = "#f1f5f9";
const COLOR_ROW_EVEN = "#ffffff";
const COLOR_ROW_ODD = "#f8fafc";
const COLOR_BORDER = "#e2e8f0";
const COLOR_TEXT = "#1e293b";
const COLOR_EMPTY_TEXT = "#64748b";

function columnWidths(table: SpreadsheetTable, availableWidth: number): number[] {
  const totalWeight = table.columns.reduce((sum, column) => sum + column.width, 0);
  return table.columns.map((column) => (column.width / totalWeight) * availableWidth);
}

// A fonte padrão do sistema usada aqui (sans-serif genérico, ver decisão #6 em
// docs/plano-execucao-planilha-easypanel-vercel-auth.md) não tem glyphs de
// emoji coloridos — sem isso o emoji vira uma caixa vazia ("tofu") na imagem.
// O texto do WhatsApp continua com os emojis originais (STATUS_META); aqui,
// só na hora de desenhar no canvas, eles são removidos.
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️]/gu;

function textForCanvas(text: string): string {
  return text.replace(EMOJI_PATTERN, "").trim();
}

/** `ctx.fillText(text, x, y, maxWidth)` não trunca — ele *espreme*
 * horizontalmente o texto pra caber em `maxWidth`, o que deixa nomes longos
 * ilegíveis. Aqui cortamos o texto e adicionamos reticências antes de
 * desenhar, então nunca passamos `maxWidth` pro fillText. */
function truncateToWidth(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

function drawStatusDot(ctx: SKRSContext2D, x: number, y: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Renderiza uma `SpreadsheetTable` (já paginada — ver `spreadsheetView.ts`)
 * como PNG, para envio como imagem no WhatsApp. Usa fonte padrão do sistema
 * (sem TTF customizada) e a mesma paleta de cores de `STATUS_META`. */
export function renderSpreadsheetImage(table: SpreadsheetTable): Buffer {
  const availableWidth = CANVAS_WIDTH - PADDING * 2;
  const widths = columnWidths(table, availableWidth);
  const bodyHeight = table.rows.length === 0 ? ROW_HEIGHT : table.rows.length * ROW_HEIGHT;
  const height = TITLE_HEIGHT + HEADER_HEIGHT + bodyHeight + PADDING * 2;

  const canvas = createCanvas(CANVAS_WIDTH, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_WIDTH, height);

  ctx.fillStyle = COLOR_TITLE_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, TITLE_HEIGHT);
  ctx.fillStyle = COLOR_TITLE_TEXT;
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";
  ctx.fillText(truncateToWidth(ctx, textForCanvas(table.title), availableWidth), PADDING, TITLE_HEIGHT / 2);

  let y = TITLE_HEIGHT;

  ctx.fillStyle = COLOR_HEADER_BG;
  ctx.fillRect(0, y, CANVAS_WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = COLOR_HEADER_TEXT;
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  let x = PADDING;
  for (let i = 0; i < table.columns.length; i++) {
    ctx.fillText(table.columns[i].header, x, y + HEADER_HEIGHT / 2);
    x += widths[i];
  }
  y += HEADER_HEIGHT;

  ctx.font = `13px ${FONT_FAMILY}`;
  if (table.rows.length === 0) {
    ctx.fillStyle = COLOR_ROW_EVEN;
    ctx.fillRect(0, y, CANVAS_WIDTH, ROW_HEIGHT);
    ctx.fillStyle = COLOR_EMPTY_TEXT;
    ctx.fillText("Nenhum registro.", PADDING, y + ROW_HEIGHT / 2);
    y += ROW_HEIGHT;
  } else {
    table.rows.forEach((row, rowIndex) => {
      ctx.fillStyle = rowIndex % 2 === 0 ? COLOR_ROW_EVEN : COLOR_ROW_ODD;
      ctx.fillRect(0, y, CANVAS_WIDTH, ROW_HEIGHT);

      x = PADDING;
      drawStatusDot(ctx, x - 8, y + ROW_HEIGHT / 2, row.color);

      ctx.fillStyle = COLOR_TEXT;
      row.cells.forEach((cell, cellIndex) => {
        const cellWidth = widths[cellIndex] - 8;
        ctx.fillText(truncateToWidth(ctx, cell, cellWidth), x, y + ROW_HEIGHT / 2);
        x += widths[cellIndex];
      });

      y += ROW_HEIGHT;
    });
  }

  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, CANVAS_WIDTH - 1, height - 1);

  return canvas.toBuffer("image/png");
}
