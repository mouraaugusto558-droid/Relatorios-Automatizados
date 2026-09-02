import type { Logger } from "pino";
import type { JobDefinition } from "./scheduler";
import { runDailyReport } from "../services/reports";
import { checkForCriticalUpdates } from "../services/reports/monitor";
import { runCriticalLevelsSummary } from "../services/reports/dailySummary";

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
    },
    {
      // 08:30, e não 08:00, para não disputar a API da Otodata com o
      // "relatorio-diario" acima — os dois batem na mesma API e rodavam
      // no mesmo minuto.
      id: "resumo-critico-diario",
      name: "Resumo diário — nível alto e baixo (08:30)",
      cronExpression: "30 8 * * *",
      run: runCriticalLevelsSummary
    }
  ];
}
