import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "../createInMemoryDatabase";
import { createDeviceSnapshotsRepository } from "./deviceSnapshotsRepository";

test("deviceSnapshotsRepository: getAll is empty when nothing was ever saved", () => {
  const db = createInMemoryDatabase();
  const repo = createDeviceSnapshotsRepository(db);

  assert.equal(repo.getAll().size, 0);
});

test("deviceSnapshotsRepository: upsertMany then getAll returns what was saved", () => {
  const db = createInMemoryDatabase();
  const repo = createDeviceSnapshotsRepository(db);

  repo.upsertMany([
    { deviceId: 1, status: "HIGH ALARM", lastFill: null, lastLevel: 0.92, batteryAlarm: false },
    { deviceId: 2, status: "OK", lastFill: "2026-08-20T10:00:00Z", lastLevel: 0.5, batteryAlarm: true }
  ]);

  const all = repo.getAll();
  assert.equal(all.size, 2);
  assert.deepEqual(all.get(1), { deviceId: 1, status: "HIGH ALARM", lastFill: null, lastLevel: 0.92, batteryAlarm: false });
  assert.deepEqual(all.get(2), {
    deviceId: 2,
    status: "OK",
    lastFill: "2026-08-20T10:00:00Z",
    lastLevel: 0.5,
    batteryAlarm: true
  });
});

test("deviceSnapshotsRepository: upserting the same device again overwrites the previous state", () => {
  const db = createInMemoryDatabase();
  const repo = createDeviceSnapshotsRepository(db);

  repo.upsertMany([{ deviceId: 1, status: "OK", lastFill: null, lastLevel: 0.8, batteryAlarm: false }]);
  repo.upsertMany([{ deviceId: 1, status: "LOW ALARM", lastFill: null, lastLevel: 0.2, batteryAlarm: true }]);

  const all = repo.getAll();
  assert.equal(all.size, 1);
  assert.equal(all.get(1)?.status, "LOW ALARM");
  assert.equal(all.get(1)?.batteryAlarm, true);
});
