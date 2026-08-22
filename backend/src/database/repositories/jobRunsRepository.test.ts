import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "../createInMemoryDatabase";
import { createJobsRepository } from "./jobsRepository";
import { createJobRunsRepository } from "./jobRunsRepository";

function seedJob(db: ReturnType<typeof createInMemoryDatabase>) {
  createJobsRepository(db).upsert({
    id: "daily-report",
    name: "Relatório diário",
    cronExpression: "0 8 * * *",
    enabled: true
  });
}

test("jobRunsRepository: start marks a run as running", () => {
  const db = createInMemoryDatabase();
  seedJob(db);
  const repo = createJobRunsRepository(db);

  const runId = repo.start("daily-report");
  assert.equal(repo.isRunning("daily-report"), true);

  const last = repo.getLast("daily-report");
  assert.equal(last?.id, runId);
  assert.equal(last?.status, "running");
  assert.equal(last?.finishedAt, null);
});

test("jobRunsRepository: finish clears the running state and records duration", () => {
  const db = createInMemoryDatabase();
  seedJob(db);
  const repo = createJobRunsRepository(db);

  const runId = repo.start("daily-report");
  repo.finish(runId, "success");

  assert.equal(repo.isRunning("daily-report"), false);
  const last = repo.getLast("daily-report");
  assert.equal(last?.status, "success");
  assert.notEqual(last?.finishedAt, null);
  assert.equal(typeof last?.durationMs, "number");
});

test("jobRunsRepository: finish with error records the error message", () => {
  const db = createInMemoryDatabase();
  seedJob(db);
  const repo = createJobRunsRepository(db);

  const runId = repo.start("daily-report");
  repo.finish(runId, "error", "falha ao gerar relatório");

  const last = repo.getLast("daily-report");
  assert.equal(last?.status, "error");
  assert.equal(last?.error, "falha ao gerar relatório");
});

test("jobRunsRepository: listRecent respects the limit and ordering", () => {
  const db = createInMemoryDatabase();
  seedJob(db);
  const repo = createJobRunsRepository(db);

  for (let i = 0; i < 3; i += 1) {
    const runId = repo.start("daily-report");
    repo.finish(runId, "success");
  }

  const recent = repo.listRecent("daily-report", 2);
  assert.equal(recent.length, 2);
});
