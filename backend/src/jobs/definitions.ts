import type { Logger } from "pino";
import type { JobDefinition } from "./scheduler";

export function createJobDefinitions(logger: Logger): JobDefinition[] {
  return [
    {
      id: "relatorio-manha",
      name: "Relatório 08:00",
      cronExpression: "0 8 * * *",
      async run(): Promise<void> {
        logger.info("relatorio-manha: geração de relatório ainda não implementada (Fase 5)");
      }
    },
    {
      id: "automacao-meio-dia",
      name: "Automação 12:00",
      cronExpression: "0 12 * * *",
      async run(): Promise<void> {
        logger.info("automacao-meio-dia: automação ainda não implementada");
      }
    },
    {
      id: "relatorio-noite",
      name: "Relatório 18:00",
      cronExpression: "0 18 * * *",
      async run(): Promise<void> {
        logger.info("relatorio-noite: geração de relatório ainda não implementada (Fase 5)");
      }
    }
  ];
}
