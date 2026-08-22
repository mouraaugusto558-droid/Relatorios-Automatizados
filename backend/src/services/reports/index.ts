import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env";
import { getDatabase } from "../../database";
import { createReportsRepository } from "../../database/repositories/reportsRepository";
import { getOtodataClient } from "../otodata";
import { getWhatsAppManager } from "../whatsapp";
import { buildDailyReportText } from "./dailyReport";

export async function runDailyReport(): Promise<void> {
  if (!env.reportRecipientNumber) {
    throw new Error("REPORT_RECIPIENT_NUMBER não configurado");
  }

  const devices = await getOtodataClient().getDevices();
  const reportText = buildDailyReportText(devices);

  fs.mkdirSync(env.reportsPath, { recursive: true });
  const fileName = `relatorio-diario-${new Date().toISOString().slice(0, 10)}.txt`;
  const filePath = path.join(env.reportsPath, fileName);
  fs.writeFileSync(filePath, reportText, "utf8");

  const reportsRepository = createReportsRepository(getDatabase());
  const reportId = reportsRepository.create(fileName, filePath, "generated");

  try {
    const jid = `${env.reportRecipientNumber}@s.whatsapp.net`;
    await getWhatsAppManager().sendMessage(jid, reportText);
    reportsRepository.updateStatus(reportId, "sent");
  } catch (error) {
    reportsRepository.updateStatus(reportId, "error");
    throw error;
  }
}
