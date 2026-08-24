import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata/client";
import { mapDeviceToRow } from "./mapDevice";

function device(overrides: Partial<OtodataDevice>): OtodataDevice {
  return {
    Id: 1,
    Name: "Tanque teste",
    City: "Belém",
    Region: null,
    Product: "LPG",
    Status: "OK",
    LastLevel: 0.5,
    Inventory: null,
    Capacity: null,
    HoursToEmpty: null,
    LastFill: null,
    LastRead: null,
    BatteryAlarm: false,
    SignalStrength: null,
    TankName: null,
    TankNumber: null,
    ...overrides
  };
}

test("mapDeviceToRow: maps OtodataDevice fields to snake_case Supabase columns", () => {
  const row = mapDeviceToRow(
    device({ Id: 42, Name: "Cliente A", City: "Recife", Status: "CRITICAL LOW ALARM", LastLevel: 0.07 }),
    "2026-08-22T18:00:00.000Z"
  );

  assert.equal(row.otodata_device_id, 42);
  assert.equal(row.name, "Cliente A");
  assert.equal(row.city, "Recife");
  assert.equal(row.status, "CRITICAL LOW ALARM");
  assert.equal(row.last_level, 0.07);
  assert.equal(row.synced_at, "2026-08-22T18:00:00.000Z");
});

test("mapDeviceToRow: preserves nulls instead of coercing to defaults", () => {
  const row = mapDeviceToRow(device({ Name: null, City: null, LastLevel: null }), "2026-08-22T18:00:00.000Z");

  assert.equal(row.name, null);
  assert.equal(row.city, null);
  assert.equal(row.last_level, null);
});
