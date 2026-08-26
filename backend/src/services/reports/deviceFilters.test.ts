import { test } from "node:test";
import assert from "node:assert/strict";
import type { OtodataDevice } from "../otodata";
import { filterDevices, parseFilterQuery, sanitizeCriteria } from "./deviceFilters";

function makeDevice(overrides: Partial<OtodataDevice>): OtodataDevice {
  return {
    Id: 1,
    Name: "Tanque teste",
    City: "Belém",
    Region: "Norte",
    Product: "Diesel",
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

test("filterDevices: sem critérios devolve todos os devices", () => {
  const devices = [makeDevice({ Id: 1 }), makeDevice({ Id: 2 })];
  assert.equal(filterDevices(devices, {}).length, 2);
});

test("filterDevices: exemplo do cliente — status HIGH ALARM E nível >= 90", () => {
  const devices = [
    makeDevice({ Id: 1, Status: "HIGH ALARM", LastLevel: 0.95 }),
    makeDevice({ Id: 2, Status: "HIGH ALARM", LastLevel: 0.5 }),
    makeDevice({ Id: 3, Status: "OK", LastLevel: 0.95 })
  ];

  const result = filterDevices(devices, { statuses: ["HIGH ALARM"], levelMin: 90 });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.Id, 1);
});

test("filterDevices: LastLevel nulo não passa quando há filtro de nível", () => {
  const devices = [makeDevice({ Id: 1, LastLevel: null })];
  assert.equal(filterDevices(devices, { levelMin: 10 }).length, 0);
});

test("filterDevices: cidade/região/produto são case-insensitive e combinam com OU dentro da categoria", () => {
  const devices = [
    makeDevice({ Id: 1, City: "Belém" }),
    makeDevice({ Id: 2, City: "Ananindeua" }),
    makeDevice({ Id: 3, City: "Manaus" })
  ];

  const result = filterDevices(devices, { cities: ["belém", "ANANINDEUA"] });
  assert.deepEqual(
    result.map((d) => d.Id),
    [1, 2]
  );
});

test("filterDevices: busca livre testa Name/TankName/TankNumber", () => {
  const devices = [
    makeDevice({ Id: 1, Name: "Restaurante Sabor Norte" }),
    makeDevice({ Id: 2, Name: null, TankNumber: "SABOR-02" }),
    makeDevice({ Id: 3, Name: "Outro" })
  ];

  const result = filterDevices(devices, { search: "sabor" });
  assert.deepEqual(
    result.map((d) => d.Id),
    [1, 2]
  );
});

test("filterDevices: batteryAlarm filtra por igualdade exata", () => {
  const devices = [makeDevice({ Id: 1, BatteryAlarm: true }), makeDevice({ Id: 2, BatteryAlarm: false })];
  assert.deepEqual(
    filterDevices(devices, { batteryAlarm: true }).map((d) => d.Id),
    [1]
  );
});

test("parseFilterQuery: separa listas por vírgula e ignora campos ausentes", () => {
  const criteria = parseFilterQuery({
    status: "HIGH ALARM,LOW ALARM",
    city: "Belém, Ananindeua",
    levelMin: "90",
    batteryAlarm: "true"
  });

  assert.deepEqual(criteria.statuses, ["HIGH ALARM", "LOW ALARM"]);
  assert.deepEqual(criteria.cities, ["Belém", "Ananindeua"]);
  assert.equal(criteria.levelMin, 90);
  assert.equal(criteria.levelMax, undefined);
  assert.equal(criteria.batteryAlarm, true);
  assert.equal(criteria.regions, undefined);
});

test("sanitizeCriteria: aceita um objeto válido e preserva os campos", () => {
  const criteria = sanitizeCriteria({
    statuses: ["HIGH ALARM"],
    levelMin: 90,
    levelMax: 100,
    cities: ["Belém"],
    batteryAlarm: true,
    search: "  sabor  "
  });

  assert.deepEqual(criteria.statuses, ["HIGH ALARM"]);
  assert.equal(criteria.levelMin, 90);
  assert.equal(criteria.levelMax, 100);
  assert.deepEqual(criteria.cities, ["Belém"]);
  assert.equal(criteria.batteryAlarm, true);
  assert.equal(criteria.search, "sabor");
});

test("sanitizeCriteria: descarta campos com tipo errado em vez de falhar", () => {
  const criteria = sanitizeCriteria({
    statuses: "HIGH ALARM", // deveria ser array
    levelMin: "90", // deveria ser number
    batteryAlarm: "true", // deveria ser boolean
    cities: [1, 2, "Belém"], // só o item string é válido
    lixo: "campo desconhecido"
  });

  assert.equal(criteria.statuses, undefined);
  assert.equal(criteria.levelMin, undefined);
  assert.equal(criteria.batteryAlarm, undefined);
  assert.deepEqual(criteria.cities, ["Belém"]);
});

test("sanitizeCriteria: entrada nula/vazia/não-objeto vira critério vazio", () => {
  assert.deepEqual(sanitizeCriteria(null), {});
  assert.deepEqual(sanitizeCriteria(undefined), {});
  assert.deepEqual(sanitizeCriteria("string qualquer"), {});
  assert.deepEqual(sanitizeCriteria(42), {});
});
