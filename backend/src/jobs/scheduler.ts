import { Cron } from "croner";
import type { Logger } from "pino";
import type { JobsRepository } from "../database/repositories/jobsRepository";
import type { JobRunsRepository } from "../database/repositories/jobRunsRepository";

export interface JobDefinition {
  id: string;
  name: string;
  cronExpression: string;
  run(): Promise<void>;
}

type ExecutionOutcome = "executed" | "skipped";

export interface Scheduler {
  start(): void;
  stop(): void;
  runNow(jobId: string): Promise<void>;
  setEnabled(jobId: string, enabled: boolean): void;
  getNextRun(jobId: string): Date | null;
}

export function createScheduler(
  definitions: JobDefinition[],
  jobsRepository: JobsRepository,
  jobRunsRepository: JobRunsRepository,
  logger: Logger
): Scheduler {
  const tasks = new Map<string, Cron>();

  function seedDefinitions(): void {
    for (const definition of definitions) {
      const existing = jobsRepository.findById(definition.id);
      jobsRepository.upsert({
        id: definition.id,
        name: definition.name,
        cronExpression: definition.cronExpression,
        enabled: existing?.enabled ?? true
      });
    }
    jobsRepository.deleteNotIn(definitions.map((definition) => definition.id));
  }

  /**
   * Registra a execução em `job_runs` e **relança** qualquer falha. Quem chama decide
   * o que fazer com ela: o disparo agendado só engole (não há ninguém para receber),
   * e o `runNow` propaga até a rota HTTP para o painel mostrar o erro de verdade —
   * antes, o erro morria aqui e a tela dizia "Job finalizado!" mesmo quando quebrava.
   */
  async function executeJob(definition: JobDefinition): Promise<ExecutionOutcome> {
    if (jobRunsRepository.isRunning(definition.id)) {
      logger.warn(`job "${definition.id}" já está em execução, disparo ignorado`);
      return "skipped";
    }

    const runId = jobRunsRepository.start(definition.id);
    try {
      await definition.run();
      jobRunsRepository.finish(runId, "success");
      return "executed";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      jobRunsRepository.finish(runId, "error", message);
      logger.error(error, `job "${definition.id}" falhou`);
      throw error;
    }
  }

  function scheduleTask(definition: JobDefinition, cronExpression: string): void {
    // O container roda em UTC por padrão (não há TZ configurado no ambiente).
    // Fixamos o fuso aqui para que os horários definidos em `definitions.ts`
    // (ex.: "08:00") disparem no horário de Brasília real, e não 3h adiantados.
    const task = new Cron(cronExpression, { timezone: "America/Sao_Paulo" }, () => {
      // O Cron chama sem await: sem este catch, uma falha vira rejeição não tratada.
      // O erro já foi gravado em `job_runs` e logado dentro do executeJob.
      void executeJob(definition).catch(() => undefined);
    });
    tasks.set(definition.id, task);
  }

  return {
    start(): void {
      seedDefinitions();

      for (const definition of definitions) {
        const job = jobsRepository.findById(definition.id);
        if (!job?.enabled) continue;
        scheduleTask(definition, job.cronExpression);
      }
    },

    stop(): void {
      for (const task of tasks.values()) {
        task.stop();
      }
      tasks.clear();
    },

    async runNow(jobId: string): Promise<void> {
      const definition = definitions.find((item) => item.id === jobId);
      if (!definition) {
        throw new Error(`job desconhecido: ${jobId}`);
      }

      const outcome = await executeJob(definition);
      if (outcome === "skipped") {
        throw new Error(
          `O job "${definition.name}" já está em execução — aguarde a execução atual terminar.`
        );
      }
    },

    setEnabled(jobId: string, enabled: boolean): void {
      const definition = definitions.find((item) => item.id === jobId);
      if (!definition) {
        throw new Error(`job desconhecido: ${jobId}`);
      }

      jobsRepository.setEnabled(jobId, enabled);
      const existingTask = tasks.get(jobId);

      if (enabled) {
        if (!existingTask) {
          const job = jobsRepository.findById(jobId);
          if (job) scheduleTask(definition, job.cronExpression);
        }
      } else if (existingTask) {
        existingTask.stop();
        tasks.delete(jobId);
      }
    },

    getNextRun(jobId: string): Date | null {
      return tasks.get(jobId)?.nextRun() ?? null;
    }
  };
}
