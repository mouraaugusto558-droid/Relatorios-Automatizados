import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSpreadsheetImage } from "./renderSpreadsheetImage";
import type { SpreadsheetTable } from "./spreadsheetView";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function table(overrides: Partial<SpreadsheetTable> = {}): SpreadsheetTable {
  return {
    title: "🚨 Alarmes ativos (1)",
    columns: [
      { header: "Tanque", width: 3 },
      { header: "Nível", width: 1 }
    ],
    rows: [{ cells: ["Tanque A", "10%"], color: "#dc2626" }],
    page: 1,
    totalPages: 1,
    ...overrides
  };
}

test("renderSpreadsheetImage: returns a buffer starting with the PNG signature", () => {
  const buffer = renderSpreadsheetImage(table());

  assert.ok(Buffer.isBuffer(buffer));
  assert.deepEqual(buffer.subarray(0, 8), PNG_SIGNATURE);
});

test("renderSpreadsheetImage: does not throw when the table has zero rows", () => {
  const buffer = renderSpreadsheetImage(table({ rows: [] }));

  assert.deepEqual(buffer.subarray(0, 8), PNG_SIGNATURE);
});
