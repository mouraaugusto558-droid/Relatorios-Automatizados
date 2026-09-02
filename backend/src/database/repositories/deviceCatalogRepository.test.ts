import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "../createInMemoryDatabase";
import { createDeviceCatalogRepository } from "./deviceCatalogRepository";
import type { OtodataDevice } from "../../services/otodata";

const device: OtodataDevice = {
  Id: 27002990,
  Name: "Cliente",
  City: "Cidade",
  Region: "SP",
  Product: "Propane",
  Status: "OK",
  LastLevel: 0.91,
  Inventory: null,
  Capacity: null,
  HoursToEmpty: null,
  LastFill: null,
  LastRead: null,
  BatteryAlarm: false,
  SignalStrength: null,
  TankName: "Tanque",
  TankNumber: "1"
};

void test("deviceCatalogRepository: starts empty", () => {
  const repo = createDeviceCatalogRepository(createInMemoryDatabase());
  assert.equal(repo.get(), null);
});

void test("deviceCatalogRepository: replaces and restores the complete catalog", () => {
  const repo = createDeviceCatalogRepository(createInMemoryDatabase());
  repo.replace([device]);

  const cached = repo.get();
  assert.ok(cached);
  assert.deepEqual(cached.devices, [device]);
  assert.ok(Number.isFinite(new Date(cached.savedAt).getTime()));
});
