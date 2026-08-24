import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import { getOtodataClient } from "../services/otodata";
import { buildAlarmsSpreadsheet, buildFillsSpreadsheet } from "../services/reports/spreadsheetView";

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  const { reports: reportsRepository } = createRepositories(getDatabase());

  app.get("/api/reports", async () => reportsRepository.list());

  app.get("/api/reports/:id/download", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const report = reportsRepository.getById(id);
    if (!report || !fs.existsSync(report.filePath)) {
      return reply.code(404).send({ error: "not_found" });
    }

    reply.header("Content-Disposition", `attachment; filename="${report.name}"`);
    reply.type("text/markdown; charset=utf-8");
    return reply.send(fs.createReadStream(report.filePath));
  });

  app.get("/api/reports/spreadsheet", async () => {
    const devices = await getOtodataClient().getDevices();
    return {
      generatedAt: new Date().toISOString(),
      alarms: buildAlarmsSpreadsheet(devices),
      fills: buildFillsSpreadsheet(devices)
    };
  });
}
