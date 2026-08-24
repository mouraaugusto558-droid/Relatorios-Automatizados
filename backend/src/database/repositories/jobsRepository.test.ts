import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "../createInMemoryDatabase";
import { createJobsRepository } from "./jobsRepository";
import { createJobRunsRepository } from "./jobRunsRepository";

test("jobsRepository: upsert creates then updates a job", () => {
  const db = createInMemoryDatabase();
  const repo = createJobsRepository(db);

  repo.upsert({ id: "daily-report", name: "Relatório diário", cronExpression: "0 8 * * *", enabled: true });
  assert.deepEqual(repo.findById("daily-report"), {
    id: "daily-report",
    name: "Relatório diário",
    cronExpression: "0 8 * * *",
    enabled: true
  });

  repo.upsert({ id: "daily-report", name: "Relatório diário (v2)", cronExpression: "0 9 * * *", enabled: true });
  assert.equal(repo.findById("daily-report")?.name, "Relatório diário (v2)");
  assert.equal(repo.list().length, 1);
});

test("jobsRepository: setEnabled toggles a job without touching other fields", () => {
  const db = createInMemoryDatabase();
  const repo = createJobsRepository(db);

  repo.upsert({ id: "daily-report", name: "Relatório diário", cronExpression: "0 8 * * *", enabled: true });
  repo.setEnabled("daily-report", false);

  const job = repo.findById("daily-report");
  assert.equal(job?.enabled, false);
  assert.equal(job?.cronExpression, "0 8 * * *");
});

test("jobsRepository: findById returns undefined for unknown id", () => {
  const db = createInMemoryDatabase();
  const repo = createJobsRepository(db);
  assert.equal(repo.findById("nope"), undefined);
});

test("jobsRepository: deleteNotIn removes jobs (and their runs) absent from the id list", () => {
  const db = createInMemoryDatabase();
  const repo = createJobsRepository(db);
  const runs = createJobRunsRepository(db);

  repo.upsert({ id: "keep-me", name: "Fica", cronExpression: "0 8 * * *", enabled: true });
  repo.upsert({ id: "remove-me", name: "Sai", cronExpression: "0 * * * *", enabled: true });
  runs.start("remove-me");

  repo.deleteNotIn(["keep-me"]);

  assert.ok(repo.findById("keep-me"));
  assert.equal(repo.findById("remove-me"), undefined);
  assert.equal(runs.listRecent("remove-me").length, 0);
});

test("jobsRepository: deleteNotIn does nothing when given an empty list", () => {
  const db = createInMemoryDatabase();
  const repo = createJobsRepository(db);

  repo.upsert({ id: "daily-report", name: "Relatório diário", cronExpression: "0 8 * * *", enabled: true });
  repo.deleteNotIn([]);

  assert.ok(repo.findById("daily-report"));
});
