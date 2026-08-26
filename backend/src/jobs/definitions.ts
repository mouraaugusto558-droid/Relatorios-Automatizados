import type { Logger } from "pino";
import type { JobDefinition } from "./scheduler";
import { runDailyReport } from "../services/reports";
import { checkForCriticalUpdates } from "../services/reports/monitor";

export function createJobDefinitions(_logger: Logger): JobDefinition[] {
  return [
    {
      id: "relatorio-diario",
      name: "Relatório diário 08:00",
      cronExpression: "0 8 * * *",
      run: runDailyReport
    },
    {
      id: "alertas-criticos",
      name: "Verificação de casos críticos (10 em 10 min)",
      cronExpression: "*/10 * * * *",
      run: checkForCriticalUpdates
    }
  ];
}
