import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata";
import type { TransitionResult } from "./deviceTransitions";
import { buildAlertMessage, summarizeTransitions } from "./alertMessage";

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

const empty: TransitionResult = { entered: [], resolved: [], filled: [] };

test("buildAlertMessage: all-empty result returns an empty string", () => {
  assert.equal(buildAlertMessage(empty), "");
});

test("buildAlertMessage: only shows sections that have content", () => {
  const result: TransitionResult = {
    entered: [device({ Id: 1, Name: "Cliente A", Status: "HIGH ALARM", LastLevel: 0.95 })],
    resolved: [],
    filled: []
  };

  const text = buildAlertMessage(result, new Date("2026-08-26T12:00:00Z"));
  assert.match(text, /NOVOS CASOS CRÍTICOS\*? \(1\)/);
  assert.match(text, /Cliente A/);
  assert.doesNotMatch(text, /ABASTECIMENTOS/);
  assert.doesNotMatch(text, /RESOLVIDOS/);
});

test("buildAlertMessage: shows all three sections when all have content", () => {
  const result: TransitionResult = {
    entered: [device({ Id: 1, Name: "Entrou", Status: "HIGH ALARM", LastLevel: 0.95 })],
    resolved: [device({ Id: 2, Name: "Resolveu", Status: "OK" })],
    filled: [device({ Id: 3, Name: "Abasteceu", LastFill: "2026-08-26T09:00:00Z" })]
  };

  const text = buildAlertMessage(result, new Date("2026-08-26T12:00:00Z"));
  assert.match(text, /NOVOS CASOS CRÍTICOS\*? \(1\)/);
  assert.match(text, /NOVOS ABASTECIMENTOS\*? \(1\)/);
  assert.match(text, /RESOLVIDOS\*? \(1\)/);
  assert.match(text, /Entrou/);
  assert.match(text, /Abasteceu/);
  assert.match(text, /Resolveu/);
});

test("summarizeTransitions: describes counts, or says there's nothing", () => {
  assert.equal(summarizeTransitions(empty), "Nenhuma atualização");
  assert.equal(
    summarizeTransitions({
      entered: [device({ Id: 1 })],
      resolved: [],
      filled: [device({ Id: 2 })]
    }),
    "1 novo(s) caso(s) crítico(s), 1 abastecimento(s)"
  );
});
