import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env";
import { getDatabase } from "../../database";
import { createReportsRepository } from "../../database/repositories/reportsRepository";
import { createSettingsRepository, REPORT_RECIPIENT_KEY } from "../../database/repositories/settingsRepository";
import { createServiceLogger } from "../../utils/logger";
import { getWhatsAppManager } from "../whatsapp";
import { parseRecipient, buildRecipientJid } from "../whatsapp/recipient";
import { buildDailyReportText } from "./dailyReport";
import { buildAlarmsSpreadsheet, buildFillsSpreadsheet, type SpreadsheetTable } from "./spreadsheetView";
import { renderSpreadsheetImage } from "./renderSpreadsheetImage";
import { getMonitoredDevices } from "./monitoredScope";

const logger = createServiceLogger();

export async function sendSpreadsheetImages(jid: string, tables: SpreadsheetTable[]): Promise<void> {
  for (const table of tables) {
    try {
      const image = renderSpreadsheetImage(table);
      await getWhatsAppManager().sendImage(jid, image, table.title);
    } catch (error) {
      // A imagem é um complemento ao texto do relatório (que já foi enviado com
      // sucesso nesse ponto) — uma falha aqui não deve derrubar o job inteiro.
      logger.error(error, `falha ao enviar imagem da planilha "${table.title}"`);
    }
  }
}

export async function runDailyReport(): Promise<void> {
  const settingsRepository = createSettingsRepository(getDatabase());
  const recipient =
    parseRecipient(settingsRepository.get(REPORT_RECIPIENT_KEY)) ??
    (env.reportRecipientNumber ? { type: "individual" as const, number: env.reportRecipientNumber } : null);
  if (!recipient) {
    throw new Error("Número de destino dos relatórios não configurado");
  }

  const devices = await getMonitoredDevices();

  const reportText = buildDailyReportText(devices);

  fs.mkdirSync(env.reportsPath, { recursive: true });
  const fileName = `relatorio-diario-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  const filePath = path.join(env.reportsPath, fileName);
  fs.writeFileSync(filePath, reportText, "utf8");

  const reportsRepository = createReportsRepository(getDatabase());
  const reportId = reportsRepository.create(fileName, filePath, "generated");

  const jid = buildRecipientJid(recipient);
  try {
    // "sent" aqui significa que o servidor do WhatsApp aceitou a mensagem — o
    // `sendMessage` do manager só retorna depois disso (ou lança se o socket
    // estiver caído). A entrega ao destinatário fica por conta do WhatsApp.
    await getWhatsAppManager().sendMessage(jid, reportText);
    reportsRepository.updateStatus(reportId, "sent");
  } catch (error) {
    reportsRepository.updateStatus(reportId, "error", error instanceof Error ? error.message : String(error));
    throw error;
  }

  await sendSpreadsheetImages(jid, buildAlarmsSpreadsheet(devices));
  await sendSpreadsheetImages(jid, buildFillsSpreadsheet(devices));
}
