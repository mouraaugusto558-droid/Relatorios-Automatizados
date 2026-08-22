import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "../createInMemoryDatabase";
import { createReportsRepository } from "./reportsRepository";

test("reportsRepository: create then getById", () => {
  const db = createInMemoryDatabase();
  const repo = createReportsRepository(db);

  const id = repo.create("Relatório diário", "./storage/reports/2026-08-22.html", "generated");
  const report = repo.getById(id);

  assert.equal(report?.name, "Relatório diário");
  assert.equal(report?.status, "generated");
});

test("reportsRepository: updateStatus changes the stored status", () => {
  const db = createInMemoryDatabase();
  const repo = createReportsRepository(db);

  const id = repo.create("Relatório diário", "./storage/reports/2026-08-22.html", "generated");
  repo.updateStatus(id, "sent");

  assert.equal(repo.getById(id)?.status, "sent");
});

test("reportsRepository: list returns most recent first, respecting the limit", () => {
  const db = createInMemoryDatabase();
  const repo = createReportsRepository(db);

  repo.create("Relatório 1", "./a.html", "generated");
  repo.create("Relatório 2", "./b.html", "generated");
  repo.create("Relatório 3", "./c.html", "generated");

  const list = repo.list(2);
  assert.equal(list.length, 2);
  assert.equal(list[0]?.name, "Relatório 3");
});
