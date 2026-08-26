import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env";
import { getDatabase } from "../../database";
import { createReportsRepository } from "../../database/repositories/reportsRepository";
import {
  createSettingsRepository,
  REPORT_RECIPIENT_KEY,
  REPORT_FILTER_CRITERIA_KEY
} from "../../database/repositories/settingsRepository";
import { createExcludedDevicesRepository } from "../../database/repositories/excludedDevicesRepository";
import { createServiceLogger } from "../../utils/logger";
import { getOtodataClient } from "../otodata";
import { getWhatsAppManager } from "../whatsapp";
import { buildDailyReportText } from "./dailyReport";
import { buildAlarmsSpreadsheet, buildFillsSpreadsheet, type SpreadsheetTable } from "./spreadsheetView";
import { renderSpreadsheetImage } from "./renderSpreadsheetImage";
import { filterDevices, sanitizeCriteria } from "./deviceFilters";

const logger = createServiceLogger();

async function sendSpreadsheetImages(jid: string, tables: SpreadsheetTable[]): Promise<void> {
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
  const recipientNumber = settingsRepository.get(REPORT_RECIPIENT_KEY) ?? env.reportRecipientNumber;
  if (!recipientNumber) {
    throw new Error("Número de destino dos relatórios não configurado");
  }

  const allDevices = await getOtodataClient().getDevices();
  if (!Array.isArray(allDevices)) {
    throw new Error("Resposta inesperada da API Otodata (esperava uma lista de dispositivos)");
  }

  const excludedIds = createExcludedDevicesRepository(getDatabase()).getExcludedIds();
  const activeDevices = allDevices.filter((device) => !excludedIds.has(device.Id));

  const savedFilterRaw = settingsRepository.get(REPORT_FILTER_CRITERIA_KEY);
  const filterCriteria = sanitizeCriteria(savedFilterRaw ? JSON.parse(savedFilterRaw) : {});
  const devices = filterDevices(activeDevices, filterCriteria);

  const reportText = buildDailyReportText(devices);

  fs.mkdirSync(env.reportsPath, { recursive: true });
  const fileName = `relatorio-diario-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  const filePath = path.join(env.reportsPath, fileName);
  fs.writeFileSync(filePath, reportText, "utf8");

  const reportsRepository = createReportsRepository(getDatabase());
  const reportId = reportsRepository.create(fileName, filePath, "generated");

  const jid = `${recipientNumber}@s.whatsapp.net`;
  try {
    await getWhatsAppManager().sendMessage(jid, reportText);
    reportsRepository.updateStatus(reportId, "sent");
  } catch (error) {
    reportsRepository.updateStatus(reportId, "error");
    throw error;
  }

  await sendSpreadsheetImages(jid, buildAlarmsSpreadsheet(devices));
  await sendSpreadsheetImages(jid, buildFillsSpreadsheet(devices));
}
