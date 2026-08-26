import type { DatabaseSync } from "node:sqlite";

export const REPORT_RECIPIENT_KEY = "report_recipient_number";
export const REPORT_FILTER_CRITERIA_KEY = "report_filter_criteria";

export interface SettingsRepository {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export function createSettingsRepository(database: DatabaseSync): SettingsRepository {
  const getStmt = database.prepare(`SELECT value FROM settings WHERE key = ?`);
  const upsertStmt = database.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );

  return {
    get(key: string): string | undefined {
      const row = getStmt.get(key) as { value: string } | undefined;
      return row?.value;
    },
    set(key: string, value: string): void {
      upsertStmt.run(key, value);
    }
  };
}
