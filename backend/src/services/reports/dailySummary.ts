import { getDatabase } from "../../database";
import {
  createSettingsRepository,
  REPORT_RECIPIENT_KEY,
  ALERT_RECIPIENT_KEY,
  DAILY_SUMMARY_HIGH_CRITERIA_KEY,
  DAILY_SUMMARY_LOW_CRITERIA_KEY
} from "../../database/repositories/settingsRepository";
import { getWhatsAppManager } from "../whatsapp";
import { parseRecipient, buildRecipientJid } from "../whatsapp/recipient";
import { filterDevices, sanitizeCriteria, type DeviceFilterCriteria } from "./deviceFilters";
import { buildLevelSummarySpreadsheet } from "./spreadsheetView";
import { formatDateTime } from "./dailyReport";
import { getMonitoredDevices } from "./monitoredScope";
import { sendSpreadsheetImages } from "./index";

/** Valores do próprio cliente — usados enquanto ninguém salvar um critério próprio. */
export const DEFAULT_HIGH_CRITERIA: DeviceFilterCriteria = { statuses: ["HIGH ALARM"], levelMin: 90 };
export const DEFAULT_LOW_CRITERIA: DeviceFilterCriteria = { statuses: ["CRITICAL LOW ALARM"], levelMax: 15 };

export function buildSummaryGreeting(highCount: number, lowCount: number, referenceDate: Date = new Date()): string {
  return [
    "☀️ *Bom dia!*",
    "Segue os casos de nível alto e nível baixo de hoje.",
    `📅 ${formatDateTime(referenceDate)}`,
    "",
    `🔴 Nível alto: ${highCount}`,
    `🟠 Crítico baixo: ${lowCount}`
  ].join("\n");
}

/**
 * Resumo diário (08:00, ver `jobs/definitions.ts`) em duas tabelas separadas
 * — nível alto (ex.: status "Nível alto" + nível ≥ 90%) e crítico baixo (ex.:
 * "Nível criticamente baixo" + nível ≤ 15%) — distinto do relatório diário
 * (`runDailyReport`, que mostra todos os alarmes combinados) e dos Alertas
 * de 10 em 10 min (`checkForCriticalUpdates`, que são avisos pontuais sem
 * tabela). Mesmo escopo (exclusão + filtro salvo) e mesmo destinatário dos
 * Alertas — cai no destinatário do relatório se o de alerta nunca foi salvo.
 */
export async function runCriticalLevelsSummary(): Promise<void> {
  const settingsRepository = createSettingsRepository(getDatabase());

  const recipient =
    parseRecipient(settingsRepository.get(ALERT_RECIPIENT_KEY)) ??
    parseRecipient(settingsRepository.get(REPORT_RECIPIENT_KEY));
  if (!recipient) {
    throw new Error("Nenhum destinatário configurado para o resumo diário");
  }

  const scopedDevices = await getMonitoredDevices();

  const highCriteriaRaw = settingsRepository.get(DAILY_SUMMARY_HIGH_CRITERIA_KEY);
  const highCriteria = highCriteriaRaw ? sanitizeCriteria(JSON.parse(highCriteriaRaw)) : DEFAULT_HIGH_CRITERIA;
  const lowCriteriaRaw = settingsRepository.get(DAILY_SUMMARY_LOW_CRITERIA_KEY);
  const lowCriteria = lowCriteriaRaw ? sanitizeCriteria(JSON.parse(lowCriteriaRaw)) : DEFAULT_LOW_CRITERIA;

  const highDevices = filterDevices(scopedDevices, highCriteria);
  const lowDevices = filterDevices(scopedDevices, lowCriteria);

  const jid = buildRecipientJid(recipient);
  await getWhatsAppManager().sendMessage(jid, buildSummaryGreeting(highDevices.length, lowDevices.length));

  await sendSpreadsheetImages(jid, buildLevelSummarySpreadsheet(highDevices, `🔴 Nível alto (${highDevices.length})`));
  await sendSpreadsheetImages(jid, buildLevelSummarySpreadsheet(lowDevices, `🟠 Crítico baixo (${lowDevices.length})`));
}
