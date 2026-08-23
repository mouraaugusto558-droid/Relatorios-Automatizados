import type { Logger } from "pino";
import type { JobDefinition } from "./scheduler";
import { runDailyReport } from "../services/reports";
import { runDataSync } from "../services/dataSync";

export function createJobDefinitions(logger: Logger): JobDefinition[] {
  return [
    {
      id: "relatorio-diario",
      name: "Relatório diário 08:00",
      cronExpression: "0 8 * * *",
      run: runDailyReport
    },
    {
      id: "sincronizacao-dados",
      name: "Sincronização Supabase + Planilha",
      cronExpression: "0 * * * *",
      run: runDataSync
    },
    {
      id: "automacao-meio-dia",
      name: "Automação 12:00",
      cronExpression: "0 12 * * *",
      async run(): Promise<void> {
        logger.info("automacao-meio-dia: automação ainda não implementada");
      }
    }
  ];
}
