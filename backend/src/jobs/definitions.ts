import type { Logger } from "pino";
import type { JobDefinition } from "./scheduler";
import { runDailyReport } from "../services/reports";

export function createJobDefinitions(logger: Logger): JobDefinition[] {
  return [
    {
      id: "relatorio-diario",
      name: "Relatório diário 08:00",
      cronExpression: "0 8 * * *",
      run: runDailyReport
    },
    {
      id: "automacao-meio-dia",
      name: "Automação 12:00",
      cronExpression: "0 12 * * *",
      async run(): Promise<void> {
        logger.info("automacao-meio-dia: automação ainda não implementada");
      }
    },
    // TEMPORÁRIO: job de teste para validar que o agendamento automático (não
    // só o botão "Executar") dispara no horário certo após a correção do
    // fuso horário. Remover após a confirmação.
    {
      id: "teste-1030",
      name: "Teste 10:30",
      cronExpression: "30 10 * * *",
      run: runDailyReport
    }
  ];
}
