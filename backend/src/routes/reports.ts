import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import { getOtodataClient } from "../services/otodata";
import { buildAlarmsSpreadsheet, buildFillsSpreadsheet } from "../services/reports/spreadsheetView";

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  const { reports: reportsRepository } = createRepositories(getDatabase());

  app.get("/api/reports", async () => reportsRepository.list());

  app.get("/api/reports/spreadsheet", async () => {
    const devices = await getOtodataClient().getDevices();
    return {
      generatedAt: new Date().toISOString(),
      alarms: buildAlarmsSpreadsheet(devices),
      fills: buildFillsSpreadsheet(devices)
    };
  });
}
