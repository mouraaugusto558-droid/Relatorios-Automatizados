import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { createInMemoryDatabase } from "../database/createInMemoryDatabase";
import { createJobsRepository } from "../database/repositories/jobsRepository";
import { createJobRunsRepository } from "../database/repositories/jobRunsRepository";
import { createScheduler, type JobDefinition } from "./scheduler";
import { createJobDefinitions } from "./definitions";

function silentLogger() {
  return pino({ level: "silent" });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("scheduler: start seeds job definitions into the repository", () => {
  const database = createInMemoryDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);
  const definitions: JobDefinition[] = [
    { id: "job-a", name: "Job A", cronExpression: "0 8 * * *", run: async () => undefined }
  ];

  const scheduler = createScheduler(definitions, jobsRepository, jobRunsRepository, silentLogger());
  scheduler.start();

  const job = jobsRepository.findById("job-a");
  assert.ok(job);
  assert.equal(job?.enabled, true);
  assert.equal(job?.cronExpression, "0 8 * * *");

  scheduler.stop();
});

test("scheduler: critical alerts are scheduled every ten minutes", () => {
  const definition = createJobDefinitions(silentLogger()).find(
    (item) => item.id === "alertas-criticos"
  );

  assert.ok(definition);
  assert.equal(definition?.cronExpression, "*/10 * * * *");
  assert.match(definition?.name ?? "", /10 em 10 min/);
});

// O relatório diário e o resumo de níveis batem na mesma API da Otodata.
// Rodavam os dois às 08:00; foram separados para não disputar a API no mesmo
// minuto. Este teste existe para que uma mudança acidental volte a juntá-los
// sem ninguém perceber.
test("scheduler: daily report and levels summary do not run at the same time", () => {
  const definitions = createJobDefinitions(silentLogger());
  const relatorio = definitions.find((item) => item.id === "relatorio-diario");
  const resumo = definitions.find((item) => item.id === "resumo-critico-diario");

  assert.ok(relatorio);
  assert.ok(resumo);
  assert.equal(relatorio?.cronExpression, "0 8 * * *");
  assert.equal(resumo?.cronExpression, "30 8 * * *");
  assert.notEqual(relatorio?.cronExpression, resumo?.cronExpression);
});

test("scheduler: runNow records a successful run", async () => {
  const database = createInMemoryDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);
  const definitions: JobDefinition[] = [
    { id: "job-ok", name: "Job OK", cronExpression: "0 8 * * *", run: async () => undefined }
  ];

  const scheduler = createScheduler(definitions, jobsRepository, jobRunsRepository, silentLogger());
  scheduler.start();
  await scheduler.runNow("job-ok");

  const lastRun = jobRunsRepository.getLast("job-ok");
  assert.equal(lastRun?.status, "success");
  assert.equal(lastRun?.error, null);

  scheduler.stop();
});

test("scheduler: runNow records a failed run with the error message", async () => {
  const database = createInMemoryDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);
  const definitions: JobDefinition[] = [
    {
      id: "job-fail",
      name: "Job Fail",
      cronExpression: "0 8 * * *",
      run: async () => {
        throw new Error("boom");
      }
    }
  ];

  const scheduler = createScheduler(definitions, jobsRepository, jobRunsRepository, silentLogger());
  scheduler.start();

  // O erro tem de chegar em quem chamou: é assim que a rota HTTP consegue devolver o
  // motivo real ao painel, em vez do antigo "Job finalizado!" para toda execução.
  await assert.rejects(() => scheduler.runNow("job-fail"), /boom/);

  const lastRun = jobRunsRepository.getLast("job-fail");
  assert.equal(lastRun?.status, "error");
  assert.equal(lastRun?.error, "boom");

  scheduler.stop();
});

// O disparo agendado não tem ninguém para receber a exceção. Ela precisa ficar
// registrada em `job_runs` sem virar uma rejeição não tratada que derruba o processo.
test("scheduler: a scheduled run that fails does not produce an unhandled rejection", async () => {
  const database = createInMemoryDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);
  const definitions: JobDefinition[] = [
    {
      id: "job-cron-fail",
      // A cada segundo, para o teste não precisar esperar um minuto.
      cronExpression: "* * * * * *",
      name: "Job Cron Fail",
      run: async () => {
        throw new Error("falha no disparo agendado");
      }
    }
  ];

  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", onRejection);

  const scheduler = createScheduler(definitions, jobsRepository, jobRunsRepository, silentLogger());
  scheduler.start();

  await delay(1300);
  scheduler.stop();
  // Uma rejeição não tratada só é reportada no tick seguinte ao descarte da promise.
  await delay(50);
  process.off("unhandledRejection", onRejection);

  const lastRun = jobRunsRepository.getLast("job-cron-fail");
  assert.equal(lastRun?.status, "error");
  assert.equal(lastRun?.error, "falha no disparo agendado");
  assert.deepEqual(rejections, []);
});

test("scheduler: skips a run that overlaps with one already in progress", async () => {
  const database = createInMemoryDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);
  const definitions: JobDefinition[] = [
    {
      id: "job-slow",
      name: "Job Slow",
      cronExpression: "0 8 * * *",
      run: async () => {
        await delay(50);
      }
    }
  ];

  const scheduler = createScheduler(definitions, jobsRepository, jobRunsRepository, silentLogger());
  scheduler.start();

  const first = scheduler.runNow("job-slow");
  await delay(5);
  // O disparo sobreposto agora avisa em vez de sumir em silêncio.
  await assert.rejects(() => scheduler.runNow("job-slow"), /já está em execução/);
  await first;

  assert.equal(jobRunsRepository.listRecent("job-slow").length, 1);

  scheduler.stop();
});

test("scheduler: runNow rejects for an unknown job id", async () => {
  const database = createInMemoryDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);

  const scheduler = createScheduler([], jobsRepository, jobRunsRepository, silentLogger());

  await assert.rejects(() => scheduler.runNow("nope"));
});

test("scheduler: setEnabled persists the flag and allows re-enabling", () => {
  const database = createInMemoryDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);
  const definitions: JobDefinition[] = [
    {
      id: "job-toggle",
      name: "Job Toggle",
      cronExpression: "0 8 * * *",
      run: async () => undefined
    }
  ];

  const scheduler = createScheduler(definitions, jobsRepository, jobRunsRepository, silentLogger());
  scheduler.start();

  scheduler.setEnabled("job-toggle", false);
  assert.equal(jobsRepository.findById("job-toggle")?.enabled, false);

  scheduler.setEnabled("job-toggle", true);
  assert.equal(jobsRepository.findById("job-toggle")?.enabled, true);

  scheduler.stop();
});
