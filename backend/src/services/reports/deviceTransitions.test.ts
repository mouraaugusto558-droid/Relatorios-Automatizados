import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata";
import type { DeviceSnapshot } from "../../database/repositories/deviceSnapshotsRepository";
import type { AlertTriggerConfig } from "./alertConfig";
import { classifyTransitions } from "./deviceTransitions";

function makeDevice(overrides: Partial<OtodataDevice> = {}): OtodataDevice {
  return {
    Id: 1,
    Name: "Tanque Teste",
    City: "São Paulo",
    Region: "SP",
    Product: "GLP",
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

function makeSnapshot(overrides: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return { deviceId: 1, status: "OK", lastFill: null, lastLevel: 0.5, batteryAlarm: false, ...overrides };
}

const highAlarmCriteria: AlertTriggerConfig = {
  criteria: { statuses: ["HIGH ALARM"], levelMin: 90 },
  notifyOnFill: false,
  notifyOnResolve: false
};

test("classifyTransitions: bootstrap (no previous snapshots) never alerts, even with pre-existing alarms", () => {
  const device = makeDevice({ Status: "HIGH ALARM", LastLevel: 0.95 });
  const result = classifyTransitions([device], new Map(), highAlarmCriteria);
  assert.deepEqual(result, { entered: [], resolved: [], filled: [] });
});

test("classifyTransitions: a device that newly matches the alert criteria is 'entered'", () => {
  const device = makeDevice({ Id: 1, Status: "HIGH ALARM", LastLevel: 0.95 });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "OK", lastLevel: 0.5 })]]);

  const result = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(result.entered.length, 1);
  assert.equal(result.entered[0]?.Id, 1);
  assert.equal(result.resolved.length, 0);
});

test("classifyTransitions: a device that stays in the same alarm status does not repeat the alert", () => {
  const device = makeDevice({ Id: 1, Status: "HIGH ALARM", LastLevel: 0.95 });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "HIGH ALARM", lastLevel: 0.93 })]]);

  const result = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(result.entered.length, 0);
});

test("classifyTransitions: a device leaving the alert criteria is 'resolved' only when notifyOnResolve is on", () => {
  const device = makeDevice({ Id: 1, Status: "OK", LastLevel: 0.5 });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "HIGH ALARM", lastLevel: 0.95 })]]);

  const withoutResolve = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(withoutResolve.resolved.length, 0);

  const withResolve = classifyTransitions([device], previous, { ...highAlarmCriteria, notifyOnResolve: true });
  assert.equal(withResolve.resolved.length, 1);
  assert.equal(withResolve.resolved[0]?.Id, 1);
});

test("classifyTransitions: a new fill (LastFill changed) is reported only when notifyOnFill is on", () => {
  const device = makeDevice({ Id: 1, Status: "OK", LastFill: "2026-08-26T10:00:00Z" });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "OK", lastFill: null })]]);

  const withoutFill = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(withoutFill.filled.length, 0);

  const withFill = classifyTransitions([device], previous, { ...highAlarmCriteria, notifyOnFill: true });
  assert.equal(withFill.filled.length, 1);
  assert.equal(withFill.filled[0]?.Id, 1);
});

test("classifyTransitions: an unchanged LastFill does not repeat as a fill", () => {
  const device = makeDevice({ Id: 1, Status: "OK", LastFill: "2026-08-26T10:00:00Z" });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "OK", lastFill: "2026-08-26T10:00:00Z" })]]);

  const result = classifyTransitions([device], previous, { ...highAlarmCriteria, notifyOnFill: true });
  assert.equal(result.filled.length, 0);
});

test("classifyTransitions: a device outside the alert criteria before and after never enters", () => {
  const device = makeDevice({ Id: 1, Status: "LOW ALARM", LastLevel: 0.2 });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "LOW ALARM", lastLevel: 0.25 })]]);

  const result = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(result.entered.length, 0);
  assert.equal(result.resolved.length, 0);
});

test("classifyTransitions: a genuinely new device (not seen before, other devices already tracked) can still enter", () => {
  const knownDevice = makeDevice({ Id: 1, Status: "OK" });
  const newDevice = makeDevice({ Id: 2, Status: "HIGH ALARM", LastLevel: 0.95 });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "OK" })]]);

  const result = classifyTransitions([knownDevice, newDevice], previous, highAlarmCriteria);
  assert.equal(result.entered.length, 1);
  assert.equal(result.entered[0]?.Id, 2);
});
