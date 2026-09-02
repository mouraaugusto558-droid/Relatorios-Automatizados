import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata";
import type { DeviceSnapshot } from "../../database/repositories/deviceSnapshotsRepository";
import type { AlertTriggerConfig } from "./alertConfig";
import { classifyTransitions, findHistoricalLevelMatches } from "./deviceTransitions";

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
  return {
    deviceId: 1,
    status: "OK",
    lastFill: null,
    lastLevel: 0.5,
    batteryAlarm: false,
    ...overrides
  };
}

function makeLog(level: number | null, date = "2026-08-28T11:03:00Z") {
  return {
    Id: 1,
    Level: level,
    LogDateUtc: date,
    BatteryLevel: null,
    Temperature: null,
    Value: null,
    ValueType: null,
    SensorTrouble: null
  };
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
  const previous = new Map([
    [1, makeSnapshot({ deviceId: 1, status: "HIGH ALARM", lastLevel: 0.93 })]
  ]);

  const result = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(result.entered.length, 0);
});

test("classifyTransitions: a device leaving the alert criteria is 'resolved' only when notifyOnResolve is on", () => {
  const device = makeDevice({ Id: 1, Status: "OK", LastLevel: 0.5 });
  const previous = new Map([
    [1, makeSnapshot({ deviceId: 1, status: "HIGH ALARM", lastLevel: 0.95 })]
  ]);

  const withoutResolve = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(withoutResolve.resolved.length, 0);

  const withResolve = classifyTransitions([device], previous, {
    ...highAlarmCriteria,
    notifyOnResolve: true
  });
  assert.equal(withResolve.resolved.length, 1);
  assert.equal(withResolve.resolved[0]?.Id, 1);
});

test("classifyTransitions: a new fill (LastFill changed) is reported only when notifyOnFill is on", () => {
  const device = makeDevice({ Id: 1, Status: "OK", LastFill: "2026-08-26T10:00:00Z" });
  const previous = new Map([[1, makeSnapshot({ deviceId: 1, status: "OK", lastFill: null })]]);

  const withoutFill = classifyTransitions([device], previous, highAlarmCriteria);
  assert.equal(withoutFill.filled.length, 0);

  const withFill = classifyTransitions([device], previous, {
    ...highAlarmCriteria,
    notifyOnFill: true
  });
  assert.equal(withFill.filled.length, 1);
  assert.equal(withFill.filled[0]?.Id, 1);
});

test("classifyTransitions: an unchanged LastFill does not repeat as a fill", () => {
  const device = makeDevice({ Id: 1, Status: "OK", LastFill: "2026-08-26T10:00:00Z" });
  const previous = new Map([
    [1, makeSnapshot({ deviceId: 1, status: "OK", lastFill: "2026-08-26T10:00:00Z" })]
  ]);

  const result = classifyTransitions([device], previous, {
    ...highAlarmCriteria,
    notifyOnFill: true
  });
  assert.equal(result.filled.length, 0);
});

test("classifyTransitions: a device outside the alert criteria before and after never enters", () => {
  const device = makeDevice({ Id: 1, Status: "LOW ALARM", LastLevel: 0.2 });
  const previous = new Map([
    [1, makeSnapshot({ deviceId: 1, status: "LOW ALARM", lastLevel: 0.25 })]
  ]);

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

test("findHistoricalLevelMatches: detects a brief threshold crossing between polls", () => {
  const device = makeDevice({ LastLevel: 0.85 });
  const histories = new Map([
    [
      1,
      [
        {
          Id: 1,
          Level: 0.91,
          LogDateUtc: "2026-08-28T11:03:00Z",
          BatteryLevel: null,
          Temperature: null,
          Value: null,
          ValueType: null,
          SensorTrouble: null
        },
        {
          Id: 1,
          Level: 0.85,
          LogDateUtc: "2026-08-28T11:04:00Z",
          BatteryLevel: null,
          Temperature: null,
          Value: null,
          ValueType: null,
          SensorTrouble: null
        }
      ]
    ]
  ]);

  const result = findHistoricalLevelMatches([device], histories, {
    criteria: { levelMin: 90 },
    notifyOnFill: false,
    notifyOnResolve: false
  });

  test("findHistoricalLevelMatches: accepts exactly the minimum level", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ LastLevel: 0.5 })],
      new Map([[1, [makeLog(0.9)]]]),
      { criteria: { levelMin: 90 }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.equal(result.length, 1);
  });

  test("findHistoricalLevelMatches: rejects a level below the minimum", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ LastLevel: 0.5 })],
      new Map([[1, [makeLog(0.8999)]]]),
      { criteria: { levelMin: 90 }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.equal(result.length, 0);
  });

  test("findHistoricalLevelMatches: accepts exactly the maximum level", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ LastLevel: 0.5 })],
      new Map([[1, [makeLog(0.1)]]]),
      { criteria: { levelMax: 10 }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.equal(result.length, 1);
  });

  test("findHistoricalLevelMatches: rejects a level above the maximum", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ LastLevel: 0.5 })],
      new Map([[1, [makeLog(0.1001)]]]),
      { criteria: { levelMax: 10 }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.equal(result.length, 0);
  });

  test("findHistoricalLevelMatches: ignores null readings", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ LastLevel: 0.5 })],
      new Map([[1, [makeLog(null)]]]),
      { criteria: { levelMin: 90 }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.equal(result.length, 0);
  });

  test("findHistoricalLevelMatches: requires status and level together", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ Status: "OK", LastLevel: 0.5 })],
      new Map([[1, [makeLog(0.95)]]]),
      {
        criteria: { statuses: ["HIGH ALARM"], levelMin: 90 },
        notifyOnFill: false,
        notifyOnResolve: false
      }
    );
    assert.equal(result.length, 0);
  });

  test("findHistoricalLevelMatches: preserves static device filters", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ City: "Belém", LastLevel: 0.5 })],
      new Map([[1, [makeLog(0.95)]]]),
      {
        criteria: { cities: ["Manaus"], levelMin: 90 },
        notifyOnFill: false,
        notifyOnResolve: false
      }
    );
    assert.equal(result.length, 0);
  });

  test("findHistoricalLevelMatches: chooses the newest matching reading", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ LastLevel: 0.5 })],
      new Map([
        [1, [makeLog(0.95, "2026-08-28T11:01:00Z"), makeLog(0.92, "2026-08-28T11:04:00Z")]]
      ]),
      { criteria: { levelMin: 90 }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.equal(result[0]?.device.LastLevel, 0.92);
    assert.equal(result[0]?.device.LastRead, "2026-08-28T11:04:00Z");
  });

  test("findHistoricalLevelMatches: handles multiple device IDs independently", () => {
    const devices = [makeDevice({ Id: 1 }), makeDevice({ Id: 2 })];
    const result = findHistoricalLevelMatches(
      devices,
      new Map([
        [1, [makeLog(0.95)]],
        [2, [makeLog(0.5)]]
      ]),
      { criteria: { levelMin: 90 }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.deepEqual(
      result.map((match) => match.device.Id),
      [1]
    );
  });

  test("findHistoricalLevelMatches: does not query history when no level criterion exists", () => {
    const result = findHistoricalLevelMatches(
      [makeDevice({ Status: "OK", LastLevel: 0.95 })],
      new Map([[1, [makeLog(0.95)]]]),
      { criteria: { statuses: ["OK"] }, notifyOnFill: false, notifyOnResolve: false }
    );
    assert.equal(result.length, 0);
  });

  test("classifyTransitions: 90% is a transition from 89%", () => {
    const device = makeDevice({ LastLevel: 0.9 });
    const previous = new Map([[1, makeSnapshot({ lastLevel: 0.89 })]]);
    const result = classifyTransitions([device], previous, {
      criteria: { levelMin: 90 },
      notifyOnFill: false,
      notifyOnResolve: false
    });
    assert.deepEqual(
      result.entered.map((item) => item.Id),
      [1]
    );
  });

  test("classifyTransitions: 89.99% is not a transition for a 90% minimum", () => {
    const device = makeDevice({ LastLevel: 0.8999 });
    const previous = new Map([[1, makeSnapshot({ lastLevel: 0.89 })]]);
    const result = classifyTransitions([device], previous, {
      criteria: { levelMin: 90 },
      notifyOnFill: false,
      notifyOnResolve: false
    });
    assert.equal(result.entered.length, 0);
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.device.Id, 1);
  assert.equal(result[0]?.device.LastLevel, 0.91);
  assert.equal(result[0]?.device.LastRead, "2026-08-28T11:03:00Z");
});
