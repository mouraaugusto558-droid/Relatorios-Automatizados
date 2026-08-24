import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env";
import { getDatabase } from "../../database";
import { createReportsRepository } from "../../database/repositories/reportsRepository";
import { createServiceLogger } from "../../utils/logger";
import { getOtodataClient } from "../otodata";
import { getWhatsAppManager } from "../whatsapp";
import { buildDailyReportText } from "./dailyReport";
import { buildAlarmsSpreadsheet, buildFillsSpreadsheet, type SpreadsheetTable } from "./spreadsheetView";
import { renderSpreadsheetImage } from "./renderSpreadsheetImage";

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
  if (!env.reportRecipientNumber) {
    throw new Error("REPORT_RECIPIENT_NUMBER não configurado");
  }

  const devices = await getOtodataClient().getDevices();
  if (!Array.isArray(devices)) {
    throw new Error("Resposta inesperada da API Otodata (esperava uma lista de dispositivos)");
  }

  const reportText = buildDailyReportText(devices);

  fs.mkdirSync(env.reportsPath, { recursive: true });
  const fileName = `relatorio-diario-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  const filePath = path.join(env.reportsPath, fileName);
  fs.writeFileSync(filePath, reportText, "utf8");

  const reportsRepository = createReportsRepository(getDatabase());
  const reportId = reportsRepository.create(fileName, filePath, "generated");

  const jid = `${env.reportRecipientNumber}@s.whatsapp.net`;
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
