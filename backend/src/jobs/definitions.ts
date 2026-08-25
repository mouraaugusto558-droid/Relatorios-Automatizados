import type { Logger } from "pino";
import type { JobDefinition } from "./scheduler";
import { runDailyReport } from "../services/reports";

export function createJobDefinitions(_logger: Logger): JobDefinition[] {
  return [
    {
      id: "relatorio-diario",
      name: "Relatório diário 08:00",
      cronExpression: "0 8 * * *",
      run: runDailyReport
    }
  ];
}
