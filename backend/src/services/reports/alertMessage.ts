import { statusMeta, formatLevel, deviceLabel, sortBySeverity } from "./deviceSelectors";
import { formatDateTime } from "./dailyReport";
import type { TransitionResult } from "./deviceTransitions";

const DIVIDER = "──────────────────";

function sectionHeader(title: string): string[] {
  return [DIVIDER, title, DIVIDER];
}

/**
 * Mensagem de texto puro (sem imagem, por pedido explícito) com só as
 * seções que tiverem conteúdo — quem chama já garante que pelo menos uma
 * lista não está vazia antes de mandar pro WhatsApp.
 */
export function buildAlertMessage(result: TransitionResult, referenceDate: Date = new Date()): string {
  const { entered, resolved, filled } = result;
  if (entered.length === 0 && resolved.length === 0 && filled.length === 0) return "";

  const lines: string[] = [];
  lines.push("🚨 *ALERTA — ATUALIZAÇÃO DE TANQUES*");
  lines.push(`📅 ${formatDateTime(referenceDate)}`);
  lines.push("");

  if (entered.length > 0) {
    lines.push(...sectionHeader(`🚨 *NOVOS CASOS CRÍTICOS* (${entered.length})`));
    for (const device of sortBySeverity(entered)) {
      const meta = statusMeta(device.Status);
      lines.push(`${meta.emoji} *${deviceLabel(device)}*`);
      lines.push(`   ${meta.label} · nível ${formatLevel(device.LastLevel)}`);
    }
    lines.push("");
  }

  if (filled.length > 0) {
    lines.push(...sectionHeader(`⛽ *NOVOS ABASTECIMENTOS* (${filled.length})`));
    for (const device of filled) {
      lines.push(`⛽ *${deviceLabel(device)}* — nível ${formatLevel(device.LastLevel)}`);
    }
    lines.push("");
  }

  if (resolved.length > 0) {
    lines.push(...sectionHeader(`✅ *RESOLVIDOS* (${resolved.length})`));
    for (const device of resolved) {
      lines.push(`✅ *${deviceLabel(device)}* — nível ${formatLevel(device.LastLevel)}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/** Resumo curto usado como rótulo no histórico de alertas da aba nova. */
export function summarizeTransitions(result: TransitionResult): string {
  const parts: string[] = [];
  if (result.entered.length > 0) parts.push(`${result.entered.length} novo(s) caso(s) crítico(s)`);
  if (result.filled.length > 0) parts.push(`${result.filled.length} abastecimento(s)`);
  if (result.resolved.length > 0) parts.push(`${result.resolved.length} resolvido(s)`);
  return parts.length > 0 ? parts.join(", ") : "Nenhuma atualização";
}
