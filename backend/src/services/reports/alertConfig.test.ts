import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAlertConfig, DEFAULT_ALERT_CONFIG } from "./alertConfig";

test("DEFAULT_ALERT_CONFIG matches the client's original alert example (HIGH ALARM >= 90%)", () => {
  assert.deepEqual(DEFAULT_ALERT_CONFIG, {
    criteria: { statuses: ["HIGH ALARM"], levelMin: 90 },
    notifyOnFill: false,
    notifyOnResolve: false
  });
});

test("sanitizeAlertConfig: accepts a valid object and preserves its fields", () => {
  const result = sanitizeAlertConfig({
    criteria: { statuses: ["CRITICAL LOW ALARM"], levelMax: 15 },
    notifyOnFill: true,
    notifyOnResolve: true
  });
  assert.deepEqual(result.criteria.statuses, ["CRITICAL LOW ALARM"]);
  assert.equal(result.criteria.levelMax, 15);
  assert.equal(result.notifyOnFill, true);
  assert.equal(result.notifyOnResolve, true);
});

test("sanitizeAlertConfig: invalid (non-object) input returns a blank config, not DEFAULT_ALERT_CONFIG", () => {
  const blank = { criteria: {}, notifyOnFill: false, notifyOnResolve: false };
  assert.deepEqual(sanitizeAlertConfig(null), blank);
  assert.deepEqual(sanitizeAlertConfig(undefined), blank);
  assert.deepEqual(sanitizeAlertConfig("garbage"), blank);
});

test("sanitizeAlertConfig: missing fields on an object become blank/false, not the opinionated default", () => {
  const result = sanitizeAlertConfig({});
  assert.deepEqual(result, { criteria: {}, notifyOnFill: false, notifyOnResolve: false });
});
