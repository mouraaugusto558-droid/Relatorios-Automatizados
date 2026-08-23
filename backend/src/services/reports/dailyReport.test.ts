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

test("buildDailyReportText: lists alarms and fills separately from OK devices, with translated labels", () => {
  const devices = [
    device({ Id: 1, Name: "Cliente A", Status: "OK" }),
    device({ Id: 2, Name: "Cliente B", Status: "CRITICAL LOW ALARM", LastLevel: 0.05 }),
    device({ Id: 3, Name: "Cliente C", Status: "FILL DETECTION", LastLevel: 0.95 })
  ];

  const report = buildDailyReportText(devices, new Date("2026-08-22T12:00:00Z"));

  assert.match(report, /ALARMES ATIVOS\*? \(1\)/);
  assert.match(report, /Cliente B[\s\S]*Nível criticamente baixo[\s\S]*5%/);
  assert.match(report, /ABASTECIMENTOS DETECTADOS\*? \(1\)/);
  assert.match(report, /Cliente C[\s\S]*95%/);
  assert.match(report, /RESUMO GERAL\*? \(3 tanques\)/);
  assert.match(report, /✅ Normal: 1/);
});

test("buildDailyReportText: handles the no-events case gracefully", () => {
  const devices = [device({ Status: "OK" }), device({ Id: 2, Status: "OK" })];

  const report = buildDailyReportText(devices, new Date("2026-08-22T12:00:00Z"));

  assert.match(report, /Nenhum tanque em alarme\./);
  assert.match(report, /Nenhum abastecimento detectado\./);
});

test("buildDailyReportText: orders alarms by severity, most urgent first", () => {
  const devices = [
    device({ Id: 1, Name: "Baixo", Status: "LOW ALARM" }),
    device({ Id: 2, Name: "Vazio", Status: "EMPTY ALARM" }),
    device({ Id: 3, Name: "Comunicação", Status: "COMM TROUBLE" })
  ];

  const report = buildDailyReportText(devices, new Date("2026-08-22T12:00:00Z"));

  const posVazio = report.indexOf("Vazio");
  const posBaixo = report.indexOf("Baixo");
  const posComunicacao = report.indexOf("Comunicação");
  assert.ok(posVazio < posBaixo);
  assert.ok(posBaixo < posComunicacao);
});

test("buildDailyReportText: flags low battery devices and sanitizes markdown from device data", () => {
  const devices = [
    device({ Id: 1, Name: "Cliente *E*_bold", City: "Cidade_teste", Status: "LOW ALARM", BatteryAlarm: true })
  ];

  const report = buildDailyReportText(devices, new Date("2026-08-22T12:00:00Z"));

  assert.match(report, /bateria fraca/);
  assert.doesNotMatch(report, /\*E\*/);
  assert.match(report, /Cliente Ebold \(Cidadeteste\)/);
});
