import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata";
import { buildDailyReportText } from "./dailyReport";

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

test("buildDailyReportText: lists alarms and fills separately from OK devices", () => {
  const devices = [
    device({ Id: 1, Name: "Cliente A", Status: "OK" }),
    device({ Id: 2, Name: "Cliente B", Status: "CRITICAL LOW ALARM", LastLevel: 0.05 }),
    device({ Id: 3, Name: "Cliente C", Status: "FILL DETECTION", LastLevel: 0.95 })
  ];

  const report = buildDailyReportText(devices, new Date("2026-08-22T12:00:00Z"));

  assert.match(report, /Alarmes ativos \(1\)/);
  assert.match(report, /Cliente B.*CRITICAL LOW ALARM.*5%/);
  assert.match(report, /Abastecimentos detectados \(1\)/);
  assert.match(report, /Cliente C.*95%/);
  assert.match(report, /Resumo geral \(3 tanques\)/);
  assert.match(report, /OK: 1/);
});

test("buildDailyReportText: handles the no-events case gracefully", () => {
  const devices = [device({ Status: "OK" }), device({ Id: 2, Status: "OK" })];

  const report = buildDailyReportText(devices, new Date("2026-08-22T12:00:00Z"));

  assert.match(report, /Nenhum tanque em alarme\./);
  assert.match(report, /Nenhum abastecimento detectado\./);
});
