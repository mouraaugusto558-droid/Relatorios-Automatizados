import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "../createInMemoryDatabase";
import { createAlertCooldownsRepository } from "./alertCooldownsRepository";

void test("alert cooldowns: stores and reads the last alert time by device ID", () => {
  const database = createInMemoryDatabase();
  const repository = createAlertCooldownsRepository(database);

  assert.equal(repository.getLastAlertAt(123), null);
  repository.markAlertSent([123], "2026-08-27T20:00:00.000Z");

  assert.equal(repository.getLastAlertAt(123), "2026-08-27T20:00:00.000Z");
});

void test("alert cooldowns: updates multiple IDs and replaces an existing timestamp", () => {
  const database = createInMemoryDatabase();
  const repository = createAlertCooldownsRepository(database);

  repository.markAlertSent([123, 456], "2026-08-27T20:00:00.000Z");
  repository.markAlertSent([123], "2026-08-29T20:00:00.000Z");

  assert.equal(repository.getLastAlertAt(123), "2026-08-29T20:00:00.000Z");
  assert.equal(repository.getLastAlertAt(456), "2026-08-27T20:00:00.000Z");
});

void test("alert cooldowns: an empty ID list does not create rows", () => {
  const database = createInMemoryDatabase();
  const repository = createAlertCooldownsRepository(database);

  repository.markAlertSent([]);

  const row = database.prepare("SELECT COUNT(*) AS count FROM alert_cooldowns").get() as
    { count: number } | undefined;
  assert.equal(row?.count, 0);
});

void test("alert cooldowns: different IDs never overwrite one another", () => {
  const database = createInMemoryDatabase();
  const repository = createAlertCooldownsRepository(database);

  repository.markAlertSent([100], "2026-08-27T20:00:00.000Z");
  repository.markAlertSent([200], "2026-08-28T20:00:00.000Z");

  assert.equal(repository.getLastAlertAt(100), "2026-08-27T20:00:00.000Z");
  assert.equal(repository.getLastAlertAt(200), "2026-08-28T20:00:00.000Z");
});
