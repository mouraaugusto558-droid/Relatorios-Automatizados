import pino, { type Logger } from "pino";
import { env } from "../config/env";

export const loggerOptions = {
  level: env.logLevel,
  transport: env.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" }
      }
};

/**
 * Logger silencioso (nível "warn") usado por serviços internos que não devem
 * poluir os logs em nível info (ex. WhatsApp manager, scheduler de jobs).
 * Centralizado aqui para evitar múltiplas instâncias `pino({ level: "warn" })`
 * criadas ad-hoc em cada módulo.
 */
export function createServiceLogger(): Logger {
  return pino({ level: "warn" });
}
