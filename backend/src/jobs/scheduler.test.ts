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

test("scheduler: critical alerts are scheduled every five minutes", () => {
  const definition = createJobDefinitions(silentLogger()).find(
    (item) => item.id === "alertas-criticos"
  );

  assert.ok(definition);
  assert.equal(definition?.cronExpression, "*/5 * * * *");
  assert.match(definition?.name ?? "", /5 em 5 min/);
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
  await scheduler.runNow("job-fail");

  const lastRun = jobRunsRepository.getLast("job-fail");
  assert.equal(lastRun?.status, "error");
  assert.equal(lastRun?.error, "boom");

  scheduler.stop();
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
  const second = scheduler.runNow("job-slow");
  await Promise.all([first, second]);

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
