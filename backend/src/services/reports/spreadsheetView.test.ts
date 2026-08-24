import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata";
import { buildAlarmsSpreadsheet, buildFillsSpreadsheet, MAX_ROWS_PER_PAGE } from "./spreadsheetView";

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

test("buildAlarmsSpreadsheet: includes only alarm statuses, one row per device, single page when small", () => {
  const devices = [
    device({ Id: 1, Status: "OK" }),
    device({ Id: 2, Name: "Tanque B", Status: "LOW ALARM", LastLevel: 0.1 }),
    device({ Id: 3, Status: "FILL DETECTION" })
  ];

  const tables = buildAlarmsSpreadsheet(devices);

  assert.equal(tables.length, 1);
  assert.equal(tables[0].rows.length, 1);
  assert.equal(tables[0].rows[0].cells[0], "Tanque B");
  assert.equal(tables[0].rows[0].cells[3], "10%");
  assert.equal(tables[0].title, "🚨 Alarmes ativos (1)");
});

test("buildAlarmsSpreadsheet: paginates in chunks of MAX_ROWS_PER_PAGE and labels pages", () => {
  const devices = Array.from({ length: MAX_ROWS_PER_PAGE + 5 }, (_, i) =>
    device({ Id: i, Name: `Tanque ${i}`, Status: "LOW ALARM" })
  );

  const tables = buildAlarmsSpreadsheet(devices);

  assert.equal(tables.length, 2);
  assert.equal(tables[0].rows.length, MAX_ROWS_PER_PAGE);
  assert.equal(tables[1].rows.length, 5);
  assert.match(tables[0].title, /\(1\/2\)$/);
  assert.match(tables[1].title, /\(2\/2\)$/);
});

test("buildFillsSpreadsheet: includes only FILL DETECTION devices", () => {
  const devices = [
    device({ Id: 1, Status: "OK" }),
    device({ Id: 2, Name: "Tanque C", Status: "FILL DETECTION", LastLevel: 0.95 })
  ];

  const tables = buildFillsSpreadsheet(devices);

  assert.equal(tables[0].rows.length, 1);
  assert.deepEqual(tables[0].rows[0].cells, ["Tanque C", "Belém", "95%"]);
});
