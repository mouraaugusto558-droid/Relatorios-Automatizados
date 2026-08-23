import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata/client";
import { buildSnapshotRows, buildHistorySummaryRow, SNAPSHOT_HEADER, HISTORY_HEADER } from "./buildRows";

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

test("buildSnapshotRows: converts LastLevel fraction to a rounded percentage", () => {
  const rows = buildSnapshotRows([device({ LastLevel: 0.073 })]);
  assert.equal(rows[0][SNAPSHOT_HEADER.indexOf("Nível (%)")], 7);
});

test("buildSnapshotRows: renders nulls as empty strings instead of the literal 'null'", () => {
  const rows = buildSnapshotRows([device({ Name: null, LastLevel: null })]);
  assert.equal(rows[0][SNAPSHOT_HEADER.indexOf("Nome")], "");
  assert.equal(rows[0][SNAPSHOT_HEADER.indexOf("Nível (%)")], "");
});

test("buildHistorySummaryRow: counts devices per status in the same column order as HISTORY_HEADER", () => {
  const devices = [
    device({ Id: 1, Status: "OK" }),
    device({ Id: 2, Status: "OK" }),
    device({ Id: 3, Status: "CRITICAL LOW ALARM" }),
    device({ Id: 4, Status: "COMM TROUBLE" })
  ];

  const row = buildHistorySummaryRow(devices, new Date("2026-08-22T12:00:00Z"));

  assert.equal(row[HISTORY_HEADER.indexOf("Total de tanques")], 4);
  assert.equal(row[HISTORY_HEADER.indexOf("Normal")], 2);
  assert.equal(row[HISTORY_HEADER.indexOf("Nível criticamente baixo")], 1);
  assert.equal(row[HISTORY_HEADER.indexOf("Falha de comunicação")], 1);
  assert.equal(row[HISTORY_HEADER.indexOf("Nível baixo")], 0);
});
