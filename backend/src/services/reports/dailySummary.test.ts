import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSummaryGreeting, DEFAULT_HIGH_CRITERIA, DEFAULT_LOW_CRITERIA } from "./dailySummary";

test("buildSummaryGreeting: includes both counts and a greeting", () => {
  const text = buildSummaryGreeting(3, 7, new Date("2026-08-26T11:00:00Z"));
  assert.match(text, /Bom dia/);
  assert.match(text, /Nível alto: 3/);
  assert.match(text, /Crítico baixo: 7/);
});

test("buildSummaryGreeting: works with zero counts", () => {
  const text = buildSummaryGreeting(0, 0, new Date("2026-08-26T11:00:00Z"));
  assert.match(text, /Nível alto: 0/);
  assert.match(text, /Crítico baixo: 0/);
});

test("default criteria match the client's original example (HIGH ALARM >= 90%, CRITICAL LOW ALARM <= 15%)", () => {
  assert.deepEqual(DEFAULT_HIGH_CRITERIA, { statuses: ["HIGH ALARM"], levelMin: 90 });
  assert.deepEqual(DEFAULT_LOW_CRITERIA, { statuses: ["CRITICAL LOW ALARM"], levelMax: 15 });
});
