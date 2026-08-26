import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "../createInMemoryDatabase";
import { createExcludedDevicesRepository } from "./excludedDevicesRepository";

test("excludedDevicesRepository: exclude then list returns the device", () => {
  const db = createInMemoryDatabase();
  const repo = createExcludedDevicesRepository(db);

  repo.exclude({ deviceId: 27084378, name: "Restaurante Sabor Norte", city: "Ananindeua" });

  const list = repo.list();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.deviceId, 27084378);
  assert.equal(list[0]?.name, "Restaurante Sabor Norte");
});

test("excludedDevicesRepository: getExcludedIds reflects excluded devices", () => {
  const db = createInMemoryDatabase();
  const repo = createExcludedDevicesRepository(db);

  repo.excludeMany([
    { deviceId: 1, name: "A", city: "X" },
    { deviceId: 2, name: "B", city: "Y" }
  ]);

  const ids = repo.getExcludedIds();
  assert.equal(ids.size, 2);
  assert.ok(ids.has(1));
  assert.ok(ids.has(2));
});

test("excludedDevicesRepository: restore removes the device from the excluded list", () => {
  const db = createInMemoryDatabase();
  const repo = createExcludedDevicesRepository(db);

  repo.exclude({ deviceId: 1, name: "A", city: "X" });
  repo.restore(1);

  assert.equal(repo.list().length, 0);
  assert.equal(repo.getExcludedIds().size, 0);
});

test("excludedDevicesRepository: excluding the same device twice does not duplicate rows", () => {
  const db = createInMemoryDatabase();
  const repo = createExcludedDevicesRepository(db);

  repo.exclude({ deviceId: 1, name: "A", city: "X" });
  repo.exclude({ deviceId: 1, name: "A renomeado", city: "X" });

  const list = repo.list();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.name, "A renomeado");
});
